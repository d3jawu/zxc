import { getModel } from "./config";
import { getHistory } from "./history";
import tools from "./tools";
import type { OpenAI } from "openai";

type Message = OpenAI.ChatCompletionMessageParam;

interface ReasoningDelta extends OpenAI.ChatCompletionChunk.Choice.Delta {
  reasoning_content?: string;
}

export type ChatEvent = {
  prompt_eval_count?: number;
  content?: string;
  reasoning?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    function: { name?: string; arguments?: string };
  }>;
};

export async function chat(): Promise<AsyncGenerator<ChatEvent>> {
  const active = getModel();
  if (!active) {
    throw new Error("No model configured. Use /model add to configure one.");
  }
  const { baseUrl, model, apiKey } = active;

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: getHistory() as Message[],
      tools: Object.values(tools).map((t) => ({
        type: t.type,
        function: t.function,
      })),
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Request failed: ${res.status} ${res.statusText}\n${await res.text()}`,
    );
  }

  if (!res.body) {
    throw new Error("No response body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function* processLines(flush = false): Generator<ChatEvent> {
    const lines = buffer.split("\n");
    buffer = flush ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (json === "[DONE]") continue;

      const chunk: OpenAI.ChatCompletionChunk & {
        choices?: Array<
          OpenAI.ChatCompletionChunk.Choice & { delta?: ReasoningDelta }
        >;
        usage?: OpenAI.CompletionUsage;
      } = JSON.parse(json);

      if (chunk.choices && chunk.choices[0]) {
        const delta = chunk.choices[0].delta as ReasoningDelta | undefined;
        if (delta) {
          const content = delta.content;
          const reasoning = delta.reasoning_content;
          const toolCalls = delta.tool_calls;

          if (content || reasoning || toolCalls) {
            yield {
              content: content || undefined,
              reasoning,
              tool_calls: toolCalls?.map((tc) => ({
                index: tc.index,
                id: tc.id,
                function: {
                  name: tc.function?.name,
                  arguments: tc.function?.arguments,
                },
              })),
            };
          }
        }
      }

      if (chunk.usage) {
        yield { prompt_eval_count: chunk.usage.prompt_tokens };
      }
    }
  }

  async function* stream(): AsyncGenerator<ChatEvent> {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      yield* processLines();
    }
    yield* processLines(true);
  }

  return stream();
}

export async function summary(): Promise<string> {
  const active = getModel();
  if (!active) {
    throw new Error("No model configured. Use /model add to configure one.");
  }
  const { baseUrl, model, apiKey } = active;

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(getHistory() as Message[]),
        {
          role: "user",
          content:
            "Respond immediately with a valid hyphen-delimited filename summarizing this chat, e.g. 'refactor-api-layer'. Up to six words is acceptable. Do not output anything else. Do not add an extension. Do not perform tool calls or do further investigation.",
        },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Request failed: ${res.status} ${res.statusText}\n${await res.text()}`,
    );
  }

  const body = (await res.json()) as OpenAI.ChatCompletion;
  const raw = body.choices[0]?.message.content ?? "";

  const match = raw.match(/^[a-z][a-z0-9-]*$/);
  return match ? match[0] : "session";
}
