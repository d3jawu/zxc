import ollama from "./ollama";
import chalk from "chalk";
import { userInfo } from "os";
import readline from "readline/promises";
import { showError, showTimer, hideTimer } from "./util";

export type Ui = {
  onPrompt: (contextString: string) => Promise<string | null>;
  onTtftStart: () => void;
  onTtftEnd: () => void;
  onThinkingStart: () => void;
  onThinkingChunk: (text: string) => void;
  onToolStart: (toolName: string) => void;
  onToolError: (message: string) => void;
  onResponseStart: () => void;
  onResponseChunk: (text: string) => void;
  onDone: () => void;
};
export function ui(modelRef: { current: string }): Ui {
  return {
    onPrompt: async (contextString: string): Promise<string | null> => {
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
    onTtftStart: () => {
      showTimer();
    },
    onTtftEnd: () => {
      hideTimer();
    },
    onThinkingStart: () => {
      process.stdout.write(
        `\n${chalk.yellow("model(")}${chalk.gray("thinking")}${chalk.yellow(")")}: `,
      );
    },
    onThinkingChunk: (text: string) => {
      process.stdout.write(chalk.gray(text));
    },
    onToolStart: (toolName: string) => {
      process.stdout.write(
        `\n${chalk.green("tool(")}${chalk.gray(toolName)}${chalk.green(")")}\n`,
      );
    },
    onToolError: (message: string) => {
      showError(message);
    },
    onResponseStart: () => {
      process.stdout.write(
        `\n${chalk.yellow("model(")}${chalk.gray("response")}${chalk.yellow(")")}: `,
      );
    },
    onResponseChunk: (text: string) => {
      process.stdout.write(text);
    },
    onDone: () => {
      process.stdout.write("\n");
    },
  };
}
