import { listModels } from "../api";
import { userInfo } from "os";
import readline from "readline/promises";
import { loadHistory } from "../history";
import { readdirSync } from "fs";
import { join } from "path";
import { configDir } from "../config";
import { log, section, reset } from "./output";
import colors from "./colors";
import config, { setConfig } from "../config";
import { select } from "@inquirer/prompts";

let contextUsed = 0;

export const setContextUsed = (val: number) => {
  contextUsed = val;
};

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
        const models = await listModels();
        let selectedModel;
        try {
          selectedModel = await select({
            message: `Select a model (currently using ${colors.blue(config.model)})`,
            choices: models.map((name) => ({ name, value: name })),
            theme: {
              prefix: {
                idle: "",
                done: "",
              },
            },
          });
        } catch {
          continue;
        }
        log(`Model set to ${colors.blue(selectedModel)}.`);
        setConfig("model", selectedModel);
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
            theme: {
              prefix: {
                idle: "",
                done: "",
              },
            },
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
