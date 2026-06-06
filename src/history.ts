import type { Message } from "ollama";
import { readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";

const HISTORY_FILE = join(process.cwd(), ".history.json");

export function createMessageHistory() {
  let messages: Message[] = [];

  if (existsSync(HISTORY_FILE)) {
    const history = JSON.parse(
      readFileSync(HISTORY_FILE, "utf-8"),
    ) as Message[];
    messages.push(...history);
    console.log("Resuming interrupted session.");
  }

  return {
    push(message: Message): void {
      messages.push(message);
      writeFileSync(HISTORY_FILE, JSON.stringify(messages, null, 2), "utf-8");
    },

    get messages(): Message[] {
      return messages;
    },

    clear(): void {
      messages = [];
    },
  };
}

export function clearHistory() {
  if (!existsSync(HISTORY_FILE)) {
    return;
  }
  rmSync(HISTORY_FILE);
}
