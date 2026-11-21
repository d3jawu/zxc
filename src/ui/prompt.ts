import { userInfo } from "os";
import readline from "readline/promises";
import { loadHistory, describeHistoryFile } from "../history";
import { readdirSync } from "fs";
import { join } from "path";
import { configDir } from "../config";
import { log, section, reset } from "./output";
import colors from "./colors";
import config, { setConfig, setModel, getModel } from "../config";
import { input, password, select, confirm } from "@inquirer/prompts";

let contextUsed = 0;

export const setContextUsed = (val: number) => {
  contextUsed = val;
};

const selectTheme = {
  prefix: {
    idle: "",
    done: "",
  },
};

export async function addModel(): Promise<void> {
  let baseUrl: string;
  let apiKey: string;
  try {
    baseUrl = await input({
      message: "Base URL for the model provider",
      default: process.env.LLAMA_BASE_URL ?? "http://localhost:8000",
      validate: (v: string) => v.trim().length > 0 || "Base URL is required",
    });
    apiKey = await password({
      message: "API key",
    });
  } catch {
    return;
  }
  baseUrl = baseUrl.trim().replace(/\/+$/, "");
  let models: string[];
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { data: { id: string }[] };
    models = data.data.map((m) => m.id);
  } catch (e) {
    log(`Failed to fetch models: ${e}`);
    return;
  }
  let selectedModel: string;
  try {
    selectedModel = await select({
      message: "Select a model",
      choices: models.map((name) => ({ name, value: name })),
      theme: selectTheme,
    });
  } catch {
    return;
  }
  let trusted: boolean;
  try {
    trusted = await confirm({
      message: `Trust ${selectedModel}? Untrusted models will ask before sharing command output`,
      default: false,
      theme: selectTheme,
    });
  } catch {
    return;
  }
  setConfig("models", [
    ...config.models,
    { baseUrl, model: selectedModel, apiKey, trusted },
  ]);
  setModel(config.models.length - 1);
  log(
    `Model set to ${colors.blue(selectedModel)} at ${colors.blue(baseUrl)} (${trusted ? colors.green("trusted") : colors.yellow("untrusted")}).`,
  );
}

async function switchModel(): Promise<void> {
  const current = getModel();
  if (!current) {
    log("No model configured. Use /model add to configure one.");
    return;
  }
  let index: number;
  try {
    index = await select({
      message: `Select a model (currently using ${colors.blue(current.model)})`,
      choices: config.models.map((m, i) => ({
        name: `${m.model} (${m.baseUrl})${m.trusted ? " (trusted)" : " (untrusted)"}`,
        value: i,
      })),
      theme: selectTheme,
    });
  } catch {
    return;
  }
  const active = config.models[index]!;
  setModel(index);
  log(
    `Model set to ${colors.blue(active.model)} (${active.trusted ? colors.green("trusted") : colors.yellow("untrusted")}).`,
  );
}

export default async function prompt(): Promise<string | null> {
  section();
  const contextString = "--";

  while (true) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on("SIGINT", () => {
      log("\n");
      process.exit(0);
    });

    const line = await rl.question(
      `${colors.purple(userInfo().username + "(")}${colors.gray(contextString)}${colors.purple(")")}: `,
    );
    rl.close();

    if (line && line.startsWith("/")) {
      const [command, ...args] = line.split(" ");
      if (command === "/model") {
        if (args[0] === "add") {
          await addModel();
        } else if (args.length > 0) {
          log("Usage: /model or /model add");
        } else {
          await switchModel();
        }
      } else if (command === "/resume") {
        const historyFiles = readdirSync(configDir)
          .filter((f) => f.startsWith("history-") && f.endsWith(".json"))
          .map(describeHistoryFile)
          .sort((a, b) => b.timestamp - a.timestamp);
        if (historyFiles.length === 0) {
          log("No history files found.");
          continue;
        }
        let selected;
        try {
          selected = await select({
            message: "Select a history file to resume",
            choices: historyFiles,
            theme: selectTheme,
          });
        } catch {
          continue;
        }
        if (selected) {
          loadHistory(selected);
        }
      } else {
        log(`Invalid command: ${command}`);
      }
      continue;
    }
    reset(false);
    return line;
  }
}
