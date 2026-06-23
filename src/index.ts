#!/usr/bin/env bun
import run from "./agent";
import { tools } from "./tools";
import { write } from "./ui/output";
import { trigger } from "./ui/ui";
import prompt from "./ui/prompt";

export const modelRef = { current: "qwen3.6:27b-coding-nvfp4" };

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
- Work in the current directory, do not cd into others
- If a user request is unclear, stop and ask for clarification instead of guessing or assuming what is expected`;

write(`Using model ${modelRef.current}.`);

const agent = run({
  systemPrompt,
  model: modelRef.current,
  toolset: tools,
  prompt,
});

for await (const event of agent) {
  trigger(event);
}
