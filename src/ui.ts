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

export type Ui = {
  shouldPrompt: boolean;
  onPrompt: (model: string) => Promise<string | null>;
  onContextUsed: (contextUsed: number) => void;
  onTtftStart: () => void;
  onTtftEnd: () => void;
  onThinkingChunk: (text: string) => void;
  onToolStart: (toolName: string) => void;
  onToolError: (message: string) => void;
  onResponseChunk: (text: string) => void;
  onDone: () => void;
};
export function ui(modelRef: { current: string }): Ui {
  let contextUsed = 0;
  let mode: "thinking" | "response" | "tool" | "prompt" | undefined;
  return {
    get shouldPrompt() {
      return mode !== "tool";
    },
    onPrompt: async (model: string): Promise<string | null> => {
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
      let line: string | null = null;
      while (line === null) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.on("SIGINT", () => {
          console.log("\nBye!");
          process.exit(0);
        });
        line = await rl.question(
          `${chalk.blueBright(userInfo().username + "(")}${chalk.gray(contextString)}${chalk.blueBright(")")}: `,
        );
        rl.close();

        if (line && line.startsWith("/")) {
          const [command, ...args] = line.split(" ");
          if (command === "/model") {
            const models = (await ollama.list()).models.map(
              (model) => model.name,
            );
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
            line = null;
          } else {
            console.log(`Invalid command: ${command}`);
            line = null;
          }
        }
      }
      return line;
    },
    onContextUsed: (ctxUsed: number) => {
      contextUsed = ctxUsed;
    },
    onTtftStart: () => {
      showTimer();
    },
    onTtftEnd: () => {
      hideTimer();
    },
    onThinkingChunk: (text: string) => {
      if (mode !== "thinking") {
        process.stdout.write(
          `\n${chalk.yellow("model(")}${chalk.gray("thinking")}${chalk.yellow(")")}: `,
        );
        mode = "thinking";
      }
      process.stdout.write(chalk.gray(text));
    },
    onToolStart: (toolName: string) => {
      mode = "tool";
      process.stdout.write(
        `\n${chalk.green("tool(")}${chalk.gray(toolName)}${chalk.green(")")}\n`,
      );
    },
    onToolError: (message: string) => {
      showError(message);
    },
    onResponseChunk: (text: string) => {
      if (mode !== "response") {
        process.stdout.write(
          `\n${chalk.yellow("model(")}${chalk.gray("response")}${chalk.yellow(")")}: `,
        );
        mode = "response";
      }
      process.stdout.write(text);
    },
    onDone: () => {
      process.stdout.write("\n");
     },
  };
}
