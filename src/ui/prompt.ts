import ollama from "../ollama";
import { userInfo } from "os";
import readline from "readline/promises";
import { modelRef } from "../index";
import { clearHistory, getHistory } from "../history";
import { write, log } from "./output";
import glow from "./glow";
import colors from "./colors";
let contextUsed = 0;

export const setContextUsed = (val: number) => {
  contextUsed = val;
};

export default async function prompt(): Promise<string | null> {
  write("\n\n");
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
      `${colors.purple(userInfo().username + "(")}${colors.gray(contextString)}${colors.purple(")")}: `,
    );
    rl.close();

    if (line && line.startsWith("/")) {
      const [command, ...args] = line.split(" ");
      if (command === "/model") {
        const models = (await ollama.list()).models.map((model) => model.name);
        if (args.length === 0) {
          log("Available models:");
          log(models.join("\n"));
        } else {
          const newModel = args[0] as string;
          if (!models.includes(newModel)) {
            log(`Model not found: ${newModel}`);
          } else {
            log(`Model set to ${newModel}.`);
            modelRef.current = newModel;
          }
        }
      } else if (command === "/md") {
        if (!glow) {
          log("'glow' is unavailable, cannot display MarkDown.");
          continue;
        }
        const history = getHistory();
        const lastMessage = history[history.length - 1];
        if (!lastMessage) {
          log("Nothing to show.");
          continue;
        }
        glow(lastMessage.content);
      } else {
        log(`Invalid command: ${command}`);
      }
      continue;
    }
    write(""); // Tell output it needs a newline
    return line;
  }
}
