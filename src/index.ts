#!/usr/bin/env bun
import run from "./agent";
import { definitions, implementations } from "./tools";
import * as ui from "./ui";

const modelRef = { current: "qwen3.6:27b-coding-nvfp4" };

const systemPrompt = `You are an expert coding assistant. You help users by reading files, executing commands, editing code, and writing new files.
Your context window is small, so you must be as concise as possible in both thinking and responding.
Available tools:
   - read: Read file contents
   - list: List files in directory
   - edit: Replace text to changes to an existing file
   - write: Create or overwrite a file
   - bash: Execute commands
Tool calls that fail will respond with a message that begins with "Error:" followed by the reason.

Guidelines:
- Do not leave comments in code, instead strive to make the code itself self-explanatory
- Use read to examine files before editing
- Use edit for precise changes (target text must match exactly including whitespace)
- Do not end output until the user request has been addressed
- Use write only for new files or complete rewrites
- When summarizing your actions, output plain text directly - do not use cat or bash to display what you did
- Be very concise in your responses
- Show file paths clearly when working with files
- If a user request is unclear, stop and ask for clarification instead of guessing or assuming what is expected`;

let contextUsed = 0;
let mode: "thinking" | "response" | "tool" | "prompt" | undefined;

const agent = run({
  systemPrompt,
  model: modelRef.current,
  toolset: {
    definitions,
    implementations,
  },
  promptProvider: async (model) => {
    return await ui.promptUser(model, contextUsed, modelRef);
  },
});

for await (const event of agent) {
  switch (event.type) {
    case "ttft_start":
      ui.startTtft();
      break;
    case "ttft_end":
      ui.endTtft();
      break;
    case "context_used":
      contextUsed = event.count;
      break;
    case "thinking_chunk":
      if (mode !== "thinking") {
        ui.printThinkingHeader();
        mode = "thinking";
      }
      ui.renderThinkingChunk(event.text);
      break;
    case "response_chunk":
      if (mode !== "response") {
        ui.printResponseHeader();
        mode = "response";
      }
      ui.renderResponseChunk(event.text);
      mode = "response";
      break;
    case "tool_start":
      ui.renderToolStart(event.name);
      mode = "tool";
      break;
    case "tool_error":
      ui.renderToolError(event.message);
      break;
    case "done":
      ui.finishResponse();
      mode = "prompt";
      break;
  }
}
