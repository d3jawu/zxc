import type { Message } from "ollama";
import { readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { log, section } from "./ui/output";

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
- When suggesting fixes, stop and ask the user first before implementing
- If a user request is unclear, stop and ask for clarification instead of guessing or assuming what is expected`;

const HISTORY_FILE = join(process.cwd(), ".history.json");

const history: Message[] = [];

if (existsSync(HISTORY_FILE)) {
  const fileHistory = JSON.parse(
    readFileSync(HISTORY_FILE, "utf-8"),
  ) as Message[];
  history.push(...fileHistory);
  log("Resuming interrupted session.");
  const lastMessage = history[history.length - 1];
  log(
    `Left off at ${lastMessage?.role}: "${lastMessage?.content.slice(0, 80)}..."`,
  );
}
if (history.length === 0) {
  pushHistory({ role: "system", content: systemPrompt });
}

export function pushHistory(message: Message): void {
  history.push(message);
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

export const getHistory = (): Message[] => history;

export function clearHistory(): void {
  if (existsSync(HISTORY_FILE)) {
    section();
    log("Ending session.");
    rmSync(HISTORY_FILE);
  }
}
