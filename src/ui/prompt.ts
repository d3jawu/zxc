import { ps as ops, listModels } from "../ollama";
import { userInfo } from "os";
import readline from "readline/promises";
import { getHistory } from "../history";
import { log, section, reset } from "./output";
import glow from "./glow";
import colors from "./colors";
import config, { setConfig } from "../config";
import { select } from "@inquirer/prompts";

let contextUsed = 0;

export const setContextUsed = (val: number) => {
  contextUsed = val;
};

export default async function prompt(): Promise<string | null> {
  section();
  let contextLength: number | undefined;
  const ps = await ops();
  const foundModel = ps.models.find(({ model: m }) => m === config.model);
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
        const selectedModel = await select({
          message: `Select a model (currently using ${colors.blue(config.model)})`,
          choices: models.map((name) => ({ name, value: name })),
          theme: {
            prefix: {
              idle: "",
              done: "",
            },
          },
        });
        log(`Model set to ${colors.blue(selectedModel)}.`);
        setConfig("model", selectedModel);
      } else if (command === "/md") {
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
    reset(false);
    return line;
  }
}
