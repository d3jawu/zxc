import type { Message } from "ollama";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { log } from "./ui/output";
import config, { configDir } from "./config";

let history: Message[] = [];

export let historyFile: undefined | string = undefined;

export async function setHistoryFile() {
  if (historyFile) {
    return;
  }

  const { summary } = await import("./ollama");
  const slug = await summary();

  historyFile = join(configDir, `history-${Date.now()}-${slug}.json`);
  writeFileSync(historyFile, JSON.stringify(history), "utf-8");
}

export function pushHistory(message: Message): void {
  history.push(message);
  if (historyFile) {
    writeFileSync(historyFile, JSON.stringify(history), "utf-8");
  }
}

export const getHistory = (): Message[] => history;

export function loadHistory(filePath: string): void {
  history = JSON.parse(readFileSync(filePath, "utf-8")) as Message[];
  historyFile = filePath;
  log(`Loaded history from ${filePath}`);
}

pushHistory({ role: "system", content: config.systemPrompt });

const AGENTS_FILE = join(process.cwd(), "AGENTS.md");
if (existsSync(AGENTS_FILE)) {
  pushHistory({
    role: "user",
    content: readFileSync(AGENTS_FILE, "utf-8"),
  });
  log(`Loaded AGENTS.md.`);
}
