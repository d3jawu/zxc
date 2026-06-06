import ollama from "./ollama";
import chalk from "chalk";
import { userInfo } from "os";
import readline from "readline/promises";
import { showError, showTimer, hideTimer } from "./util";
import type { AgentEvent } from "./agent";
import { modelRef } from "./index";
import { clearHistory, getHistory } from "./history";
import { spawnSync } from "child_process";

const glowAvailable =
  spawnSync("glow", ["--version"], { encoding: "utf-8" }).status === 0;
if (!glowAvailable) {
  console.error(
    "Warning: 'glow' is not installed. MarkDown preview (/md) will be unavailable.",
  );
}

let contextUsed = 0;

export async function prompt(): Promise<string | null> {
  process.stdout.write("\n");
  let contextLength: number | undefined;
  const ps = await ollama.ps();
  const foundModel = ps.models.find(({ model: m }) => m === modelRef.current);
  if (
    foundModel &&
    "context_length" in foundModel &&
    typeof foundModel.context_length === "number"
  ) {
    contextLength = foundModel.context_length;
  }
  const contextString = !contextLength
    ? "--"
    : (parseFloat((contextUsed / contextLength).toFixed(3)) * 100).toFixed(1) +
      "%, " +
      (contextUsed / 1000).toFixed(1) +
      "k";

  while (true) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on("SIGINT", () => {
      clearHistory();
      process.exit(0);
    });

    const line = await rl.question(
      `${chalk.blueBright(userInfo().username + "(")}${chalk.gray(contextString)}${chalk.blueBright(")")}: `,
    );
    rl.close();

    if (line && line.startsWith("/")) {
      const [command, ...args] = line.split(" ");
      if (command === "/model") {
        const models = (await ollama.list()).models.map((model) => model.name);
        if (args.length === 0) {
          console.log("Available models:\n");
          console.log(models.join("\n"));
        } else {
          const newModel = args[0] as string;
          if (!models.includes(newModel)) {
            console.log(`Model not found: ${newModel}`);
          } else {
            console.log(`Model set to ${newModel}.`);
            modelRef.current = newModel;
          }
        }
      } else if (command === "/md") {
        if (!glowAvailable) {
          console.log("'glow' is unavailable, cannot display MarkDown.");
        }
        const history = getHistory();
        const lastMessage = history[history.length - 1];
        if (lastMessage) {
          spawnSync("glow", [], {
            input: lastMessage.content,
            encoding: "utf-8",
            stdio: "inherit",
          });
        }
      } else {
        console.log(`Invalid command: ${command}`);
      }
      continue;
    }
    return line;
  }
}

let mode: "thinking" | "response" | "tool" | "prompt" | undefined;

export function on(event: AgentEvent) {
  switch (event.type) {
    case "ttft_start":
      process.stdout.write("\n");
      showTimer();
      break;
    case "ttft_end":
      hideTimer();
      break;
    case "context_used":
      contextUsed = event.count;
      break;
    case "thinking_chunk":
      if (mode !== "thinking") {
        process.stdout.write(
          `\n\n${chalk.yellow("model(")}${chalk.gray("thinking")}${chalk.yellow(")")}: `,
        );
        mode = "thinking";
      }
      process.stdout.write(chalk.gray(event.text));
      break;
    case "response_chunk":
      if (mode !== "response") {
        process.stdout.write(
          `\n\n${chalk.yellow("model(")}${chalk.gray("response")}${chalk.yellow(")")}: `,
        );
        mode = "response";
      }
      process.stdout.write(event.text);
      break;
    case "tool_start":
      process.stdout.write(
        `\n\n${chalk.green("tool(")}${chalk.gray(event.name)}${chalk.green(")")}\n`,
      );
      mode = "tool";
      break;
    case "tool_error":
      showError(event.message);
      break;
    case "done":
      mode = "prompt";
      break;
  }
}
