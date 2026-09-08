# Plan: Port from Ollama to OpenAI Chat Completions API (llama.cpp)

## Overview

Replace the `ollama` SDK with a direct `fetch`-based client targeting the OpenAI-compatible `/v1` endpoint that llama.cpp exposes. Raw `fetch` keeps runtime dependencies minimal. For compile-time type safety, add `openai` as a dev dependency and use its types (`ChatCompletionMessageParam`, `ChatCompletionChunk`, `ChatCompletionMessageToolCall`, `Tool`, etc.) as the canonical shape definitions.

---

## 1. `src/ollama.ts` → `src/api.ts`

Rename and rework. Export the same three functions plus types.

### Dependencies removed

- Remove `import { Ollama } from "ollama"` — replaced with `fetch`.

### `listModels(): Promise<string[]>`

- `GET {baseUrl}/v1/models`
- Parse response as `OpenAI.ModelList` (from `openai`), map `data[].id`.
- Same signature and behavior as before.
- **Base URL resolution:** `listModels()` must resolve `baseUrl` directly from `process.env.LLAMA_BASE_URL ?? "http://localhost:8080"`, **not** from `config`. This is because `config.ts` calls `listModels()` at module-init time (see §2), before the `config` object exists — reading `config.baseUrl` there would be undefined and create a circular init dependency (`config` → `api` → `config`).

### `chat()`

- `POST {baseUrl}/v1/chat/completions` with `stream: true`.
- Request body:

  ```json
  {
    "model": config.model,
    "messages": getHistory(),
    "tools": <tool definitions>,
    "stream": true,
    "stream_options": { "include_usage": true }
  }
  ```

- Drop `keep_alive` — no equivalent in the OpenAI API spec. Drop `think` — Ollama-specific. Instead, handle `reasoning_content` in the response (see below).
- Response: parse SSE stream. Each `data:` line is a JSON chunk typed as `ChatCompletionChunk` (from `openai`), augmented with an optional `reasoning_content` field on `delta`:

  ```ts
  interface ReasoningDelta extends ChatCompletionChunk.Choice.Delta {
    reasoning_content?: string;
  }
  ```

- **Guard every chunk before accessing `choices[0]`.** The final chunk (emitted because of `stream_options.include_usage`) has `choices: []` — an empty array. Accessing `choices[0].delta` on it throws. The stream processor must check `if (chunk.choices?.[0])` before reading `delta`, and handle the usage-only chunk in a separate branch.
- In chunks where `choices[0]` exists:
  - `choices[0].delta.content` — text fragments (yield as "token" events)
  - `choices[0].delta.reasoning_content` — internal reasoning tokens, present when the model/endpoint supports it (e.g. Qwen3 via llama.cpp, DeepSeek R1). Yield as "token" events when present. Absent for models/endpoints that don't produce reasoning — the check `if (delta.reasoning_content)` simply skips it, no error.
  - `choices[0].delta.tool_calls` — partial tool call JSON that must be accumulated
- In the final chunk where `choices` is empty (or absent):
  - `usage` — token counts. May include `completion_tokens_details.reasoning_tokens` when the endpoint supports it.
  - This is the only place `usage` appears; no `delta` is present.
- Tool call accumulation: OpenAI streams tool calls as fragments across multiple chunks. Each fragment carries an `index` field (required) and an optional `id` (only present on the first fragment for that call). Accumulate fragments by `index`, not by `id`. Parse accumulated `function.arguments` strings into objects when the stream ends.
- Return an async iterable that the agent loop consumes.

### `summary(): Promise<string>`

- Same logic as before: one non-streaming call, extract filename from response.
- Implemented as its own inline `fetch` to `{baseUrl}/v1/chat/completions` with `stream: false`.
- Request body: same shape as `chat()` minus `stream` and `stream_options`.
- Response: parse the single JSON body as `ChatCompletion` (from `openai`), extract `choices[0].message.content`.
- No reuse of the `chat()` function, which returns a streaming async iterable.

### `ps()` — dropped

- No OpenAI equivalent. Remove the export.
- **Note:** `ps()` is imported as `ops` in `src/ui/prompt.ts` (line 1, used at line 22) to fetch `context_length` for the context-usage display in the prompt banner. It is **not** called in `index.ts` or `agent.ts`, but `prompt.ts` **does** use it. `prompt.ts` also imports `listModels` from `../ollama`. See §6.5 for the required changes.

### `thinking` / `reasoning_content`

- Drop the Ollama-specific `think` request field — no equivalent in the OpenAI spec.
- Replace Ollama's `message.thinking` with the OpenAI-compatible `delta.reasoning_content` field (a vendor extension used by Qwen3 / DeepSeek R1 and surfaced through llama.cpp).
- **Graceful degradation**: `reasoning_content` is optional. The stream processor checks `if (delta.reasoning_content)` before yielding a `"token"` event. When the field is absent (most models), nothing happens — no error, no special path. No config flag or capability detection needed; presence is inferred from the stream itself.
- Reasoning tokens are surfaced identically to text tokens (both yield `"token"`), matching the prior Ollama behavior where thinking was indistinguishable from output tokens to the UI. No separate event type.
- The `AgentEvent` interface is unchanged — the UI layer still just sees `"token"` events.

### Tool definitions

- OpenAI API expects: `{ type: "function", function: { name, description, parameters } }`
- Current `tools.ts` definitions already match this shape. No structural change needed.

---

## 2. `src/config.ts`

- **Import**: replace `const { listModels } = await import("./ollama")` with `const { listModels } = await import("./api")`.
- **Base URL**: add a `baseUrl` field to the `Config` type. Its default in `defaultConfig` must be the expression `process.env.LLAMA_BASE_URL ?? "http://localhost:8080"` — the same expression used in `listModels()` (§1). Both code paths must resolve to the identical value, otherwise a user who sets `LLAMA_BASE_URL` but omits `baseUrl` from `~/.zxc/zxc.json` would have `listModels()` talk to the env-var host while `chat()` / `summary()` silently fall back to `localhost:8080`. The `config`-file value (if present) overrides the default at the usual merge step.
- **API key**: not needed for llama.cpp. Omit the `Authorization` header entirely. No config field, no env var required.
- **Default model**: call `listModels()` at init (same as before) and pick the first result. Note this runs **before** the `config` object is constructed, so `listModels()` must obtain `baseUrl` from `process.env.LLAMA_BASE_URL` / default itself (see §1) — it cannot read `config.baseUrl`. The `config.baseUrl` field is only used by later request paths (`chat`, `summary`) after config exists.
- **`systemPrompt`**: unchanged.
- **Migration of existing config files**: if `~/.zxc/zxc.json` exists, merge as before. Old files won't have `baseUrl` — the default covers it. No migration code needed.

---

## 3. `src/history.ts`

- **Message type**: replace `import type { Message } from "ollama"` with the OpenAI API type:
  ```ts
  import type { ChatCompletionMessageParam } from "openai";
  type Message = ChatCompletionMessageParam;
  ```
- **Runtime import**: replace `const { summary } = await import("./ollama")` (line 17, inside `setHistoryFile`) with `const { summary } = await import("./api")`.

- **Tool result messages**: change from `{ role: "tool", tool_name: "...", content: "..." }` to `{ role: "tool", tool_call_id: "...", content: "..." }`. The `tool_call_id` is the `id` field from the accumulated fragment — the one that arrived on the first chunk for that call's `index` (the `id` is optional per-fragment but always present on the first).
- **`ToolCall` type**: use the OpenAI API type:
  ```ts
  import type { ChatCompletionMessageToolCall } from "openai";
  type ToolCall = ChatCompletionMessageToolCall;
  ```
  Note: `arguments` is a JSON string in OpenAI (not an object). The agent loop will parse it.
- **Clean break**: existing Ollama-format history files on disk will not load. No migration. `loadHistory` will fail on old files — acceptable.
- Everything else (`pushHistory`, `setHistoryFile`, `getHistory`, `historyFile`) stays the same.

---

## 4. `src/agent.ts`

- **Imports**: replace `ToolCall` import from `ollama` with the OpenAI type from `openai`.
- **Stream processing loop**: rewrite for OpenAI SSE format.
  - Parse `data: {...}` lines from the stream (split on `\n\n`, skip `data: [DONE]`).
  - Each parsed chunk is typed as `ChatCompletionChunk` (from `openai`).
  - **Guard before accessing `choices[0]`**: the final chunk (emitted because of `stream_options.include_usage`) has `choices: []`. Check `if (chunk.choices?.[0])` before reading `delta`; process the usage-only chunk in a separate branch.
  - In chunks with `choices[0]`:
    - Accumulate `delta.content` into `fullResponse`.
    - Accumulate `delta.tool_calls[]` fragments **by `index`** (required on every fragment; `id` is optional and only present on the first). Track an array indexed by  
      `index` — each entry holds `{ id, name, arguments }`. Since `index` is a dense sequence starting from 0, no sort is needed.
  - In the usage-only final chunk (`choices` is empty or absent):
    - `usage` → map to `prompt_eval_count` equivalent for the `"context"` event. This is the only chunk that carries `usage`; no `delta` is present.
  - On stream end, parse accumulated argument strings into objects.
- **Tool call handling**: on stream end, the array of accumulated fragments **is** the `tool_calls` array — just fill in `type: "function"` on each entry. Push a **single** assistant message with the full `tool_calls` array to history (not per-chunk). Then for each call, push a `{ role: "tool", tool_call_id: id, content: result }` message, where `id` is the `id` field from that call's first fragment (the one that arrived with `index` 0, 1, 2, …). The OpenAI API requires `tool_call_id` on the result to match the `id` on the corresponding `tool_calls` entry, or it will reject the next request with a 400.
- **Assistant tool-call message `content`**: when the assistant message carries `tool_calls`, it must have `content: null` (omitted). Do **not** attach the accumulated `fullResponse` text to a message that also has `tool_calls` — several OpenAI-compatible endpoints reject a subsequent request with 400 when a tool-call message has non-null/empty `content`. `fullResponse`/`content` is only used in the non-tool response branch (pushing the plain assistant message).
- **`reasoning_content` handling**: in the SSE stream loop, check `chunk.choices[0].delta?.reasoning_content` in addition to `delta.content`. When present, yield a `"token"` event (same as text tokens). When absent, skip silently — no error, no config flag. No type augmentation needed at the runtime level (the field is simply undefined); at the type level, augment `ChatCompletionChunk.Choice.Delta` with an optional `reasoning_content?: string` for compile-time access.
- **Error handling**: the retry loop stays the same. Error message text changes from `"Ollama failed"` to `"Request failed"` (or similar).
- **`AgentEvent` interface**: unchanged. The UI layer does not need to know the backend changed.
- **`gotResponse` / `tool` loop logic**: unchanged structurally.

---

## 5. `src/tools.ts`

- **Type import**: replace `import type { Tool } from "ollama"` with the OpenAI type:
  ```ts
  import type { Tool as OpenAITool } from "openai";
  ```
  Use `OpenAITool` as the base type for `ToolWithImplementation`. The tool definition objects (`name`, `description`, `parameters`) already match the `function` field shape — no structural change needed.
- **Tool definitions**: already OpenAI-compatible. No changes to the actual tool logic.
- **`run` signature**: `ToolCall.function.arguments` is a JSON string. Each tool's `run` receives parsed args. The agent loop handles `JSON.parse` before calling `run`. Keep passing objects to `run` — parse in the agent loop.

---

## 6. `src/index.ts`

- No changes needed. It calls `run()` and forwards events to `trigger()`. The event interface is unchanged.

---

### 6.5. `src/ui/prompt.ts`

- **Imports**: replace `import { ps as ops, listModels } from "../ollama"` with `import { listModels } from "../api"`. The `ps`/`ops` import is removed entirely.
- **Context length display** (lines 22–30): the current code calls `ops()` to fetch `ps.models[].context_length` for the prompt banner. With `ps()` dropped, this logic must be removed or replaced. Options:
  - **Simple**: remove the `contextLength` lookup entirely. The banner will always show `--` for the context percentage. Acceptable for a first pass.
  - **Better**: add a `contextLength` field to `Config` and let the user set it manually. Requires UI changes.
  - **Deferred**: implement later. For now, drop the lookup and hardcode `contextLength = undefined`.
- **`/model` command** (line 47): `listModels()` import is retained, just repointed to `../api`. No other changes.
- **No other changes**: the prompt loop, `/resume` logic, and readline handling stay the same.

---

## 7. `package.json`

- Remove `"ollama"` from `dependencies`.
- Add `"openai"` to `devDependencies` (for types only — no runtime import of the SDK).
- No new runtime dependency needed (raw `fetch` is built into Bun).
- No other changes.

---

## 8. Feature Mappings Summary

| Ollama Feature       | OpenAI / llama.cpp Equivalent                     | Action                             |
| -------------------- | ------------------------------------------------- | ---------------------------------- |
| `list()`             | `GET /v1/models`                                  | Reimplement with `fetch`           |
| `chat()` stream      | `POST /v1/chat/completions` with `stream: true`   | Reimplement with `fetch` + SSE     |
| `chat()` non-stream  | Same endpoint, `stream: false`                    | Reimplement with `fetch`           |
| `prompt_eval_count`  | `usage.prompt_tokens` (final chunk)               | Map to `"context"` event           |
| `thinking` / `think` | `delta.reasoning_content` (optional, vendor ext.) | Use when present, skip when absent |
| `keep_alive: "20m"`  | No equivalent                                     | Drop                               |
| `ps()`               | No equivalent                                     | Drop                               |
| `tool_name` in msgs  | `tool_call_id` in msgs                            | Change format                      |
| Tool call args       | JSON string (accumulated in stream)               | Parse in agent loop                |
| API key              | Not needed (llama.cpp)                            | Omit                               |
| Base URL             | `http://localhost:8080` default                   | Add to config                      |

---

## 9. Out of Scope / Deferred

- **Thinking tokens**: handled via optional `delta.reasoning_content`. When the endpoint/model doesn't produce it, the field is simply absent and processing skips it. No deferred work.
- **History migration**: clean break. Old files become unreadable.
- **Multiple backend support**: complete replacement only.

---

## 10. File Change Summary

| File               | Action                                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| `src/ollama.ts`    | Rename to `src/api.ts`, rewrite internals with `fetch`                   |
| `src/config.ts`    | Update import to `./api`, add `baseUrl` field                            |
| `src/history.ts`   | Update import to `./api`, use `openai` types, `tool_call_id` format      |
| `src/agent.ts`     | Rewrite stream loop for SSE, use `openai` types                          |
| `src/tools.ts`     | Replace `Tool` type import with `openai` type                            |
| `src/ui/prompt.ts` | Update import to `../api`, remove `ps` usage, drop context-length lookup |
| `src/index.ts`     | No changes                                                               |
| `package.json`     | Remove `ollama` dep, add `openai` dev dep                                |
