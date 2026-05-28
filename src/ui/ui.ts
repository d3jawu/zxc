import chalk from "chalk";
import type { AgentEvent } from "../agent";

import input, { getPromise } from "./prompt";

import renderer from "./renderer";
import history, {
  createResponseBlock,
  createThinkingBlock,
  createTimerBlock,
} from "./history";
import type { ActiveBlock } from "./history";

let contextUsed = 0;

import {
  Text,
  InputRenderableEvents,
  InputRenderable,
  BoxRenderable,
} from "@opentui/core";

const container = new BoxRenderable(renderer, {
  flexDirection: "column",
  padding: 1,
});
container.add(history);
container.add(input);

renderer.root.add(container);

export async function prompt(): Promise<string | null> {
  /*
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
  */
  return getPromise();
}

let activeBlock: ActiveBlock;

let mode: "thinking" | "response" | "tool" | "prompt" | undefined;

export const on = (event: AgentEvent) => {
  switch (event.type) {
    case "ttft_start":
      activeBlock = createTimerBlock();
      break;
    case "ttft_end":
      activeBlock.close();
      break;
    case "context_used":
      contextUsed = event.count;
      break;
    case "thinking_chunk":
      if (mode !== "thinking") {
        activeBlock = createThinkingBlock();
        mode = "thinking";
      }
      activeBlock.append(event.text);
      break;
    case "response_chunk":
      if (mode !== "response") {
        activeBlock = createResponseBlock();
        mode = "response";
      }

      activeBlock.append(event.text);
      break;
    case "tool_start":
      history.add(
        Text({
          content: `\n${chalk.green("tool(")}${chalk.gray(event.name)}${chalk.green(")")}\n`,
        }),
      );
      mode = "tool";
      break;
    case "tool_error":
      history.add(Text({ content: `Tool error: ${event.message}` }));
      break;
    case "done":
      mode = "prompt";
      break;
  }
};
