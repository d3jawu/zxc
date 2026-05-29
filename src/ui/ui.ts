import chalk from "chalk";
import type { AgentEvent } from "../agent";

import textarea, { getPromise, setContextUsed } from "./prompt";

import renderer from "./renderer";
import history, {
  createResponseBlock,
  createThinkingBlock,
  createTimerBlock,
  createToolBlock,
} from "./history";
import type { ActiveBlock } from "./history";

let contextUsed = 0;

import { Text, BoxRenderable } from "@opentui/core";

const container = new BoxRenderable(renderer, {
  flexDirection: "column",
  padding: 1,
});
container.add(history);
container.add(textarea);

renderer.root.add(container);

export async function prompt(): Promise<string | null> {
  /*
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
      setContextUsed(event.count);
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
      createToolBlock(event.name);
      mode = "tool";
      break;
    case "tool_error":
      history.add(Text({ content: `Tool error: ${event.message}` }));
      activeBlock.close();
      break;
    case "done":
      mode = "prompt";
      activeBlock.close();
      break;
  }
};
