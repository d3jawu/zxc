import ollama from "./ollama";
import chalk from "chalk";
import { userInfo } from "os";
import readline from "readline/promises";
import { showError, showTimer, hideTimer } from "./util";

function computeContextString(
  contextUsed: number,
  contextLength: number | undefined,
): string {
  if (!contextLength) return "--";
  return (
    (parseFloat((contextUsed / contextLength).toFixed(3)) * 100).toFixed(1) +
    "%, " +
    (contextUsed / 1000).toFixed(1) +
    "k"
  );
}

export async function promptUser(
  model: string,
  contextUsed: number,
  modelRef: { current: string },
): Promise<string | null> {
  let contextLength: number | undefined;
  const ps = await ollama.ps();
  const foundModel = ps.models.find(({ model: m }) => m === model);
  if (
    foundModel &&
    "context_length" in foundModel &&
    typeof foundModel.context_length === "number"
  ) {
    contextLength = foundModel.context_length;
  }
  const contextString = computeContextString(contextUsed, contextLength);

  while (true) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on("SIGINT", () => {
      console.log("\nBye!");
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
      } else {
        console.log(`Invalid command: ${command}`);
      }
      continue;
    }
    return line;
  }
}

export function renderThinkingChunk(text: string) {
  process.stdout.write(chalk.gray(text));
}

export function renderResponseChunk(text: string) {
  process.stdout.write(text);
}

export function renderToolStart(toolName: string) {
  process.stdout.write(
    `\n${chalk.green("tool(")}${chalk.gray(toolName)}${chalk.green(")")}\n`,
  );
}

export function renderToolError(message: string) {
  showError(message);
}

export function startTtft() {
  showTimer();
}

export function endTtft() {
  hideTimer();
}

export function finishResponse() {
  process.stdout.write("\n");
}

export function printThinkingHeader() {
  process.stdout.write(
    `\n${chalk.yellow("model(")}${chalk.gray("thinking")}${chalk.yellow(")")}: `,
  );
}

export function printResponseHeader() {
  process.stdout.write(
    `\n${chalk.yellow("model(")}${chalk.gray("response")}${chalk.yellow(")")}: `,
  );
}
