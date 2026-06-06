import type { Message } from "ollama";
import { readFileSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";

const HISTORY_FILE = join(process.cwd(), ".history.json");

const history: Message[] = [];

if (existsSync(HISTORY_FILE)) {
  const fileHistory = JSON.parse(
    readFileSync(HISTORY_FILE, "utf-8"),
  ) as Message[];
  history.push(...fileHistory);
  console.log("Resuming interrupted session.");
}

export function pushHistory(message: Message): void {
  history.push(message);
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

export function getHistory(): Message[] {
  return history;
}

export function clearHistory(): void {
  if (existsSync(HISTORY_FILE)) {
    console.log("Ending session.");
    rmSync(HISTORY_FILE);
  }
}
