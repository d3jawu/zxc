import { userInfo } from "os";
import readline from "readline/promises";
import { loadHistory } from "../history";
import { readdirSync } from "fs";
import { join } from "path";
import { configDir } from "../config";
import { log, section, reset } from "./output";
import colors from "./colors";
import config, { setConfig, setModel, getModel } from "../config";
import { input, password, select } from "@inquirer/prompts";

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
  setConfig("models", [
    ...config.models,
    { baseUrl, model: selectedModel, apiKey },
  ]);
  setModel(config.models.length - 1);
  log(`Model set to ${colors.blue(selectedModel)} at ${colors.blue(baseUrl)}.`);
}

async function switchModel(): Promise<void> {
  if (config.models.length === 0) {
    log("No models configured. Use /model add to configure one.");
    return;
  }
  let index: number;
  try {
    index = await select({
      message: `Select a model (currently using ${colors.blue(getModel().model)})`,
      choices: config.models.map((m, i) => ({
        name: `${m.model} (${m.baseUrl})`,
        value: i,
      })),
      theme: selectTheme,
    });
  } catch {
    return;
  }
  const active = config.models[index]!;
  setModel(index);
  log(`Model set to ${colors.blue(active.model)}.`);
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
        const files = readdirSync(configDir);
        const historyFiles = files
          .filter((f) => f.startsWith("history-") && f.endsWith(".json"))
          .map((f) => {
            const parts = f.replace(".json", "").split("-");
            const timestamp = parts[1];
            const summary = parts.slice(2).join(" ");
            const date = new Date(Number(timestamp));
            return {
              name: `${date.toLocaleString()} - ${summary}`,
              value: join(configDir, f),
              timestamp: Number(timestamp),
            };
          })
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
