import type { AgentEvent, ConfirmResult } from "../types";

import promptRenderable, {
  getPromise as getPromptPromise,
  setContextUsed,
} from "./prompt";

import confirmRenderable, { getPromise as getConfirmPromise } from "./confirm";

import renderer from "./renderer";
import history, {
  createResponseBlock,
  createThinkingBlock,
  createTimerBlock,
  createToolBlock,
} from "./history";
import type { ActiveBlock } from "./history";

import { Text, BoxRenderable } from "@opentui/core";

const container = new BoxRenderable(renderer, {
  flexDirection: "column",
  padding: 1,
});
container.add(history);
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
  container.remove("input");
  container.add(promptRenderable);
  return getPromptPromise();
}

export async function confirm(): Promise<ConfirmResult> {
  container.remove("input");
  container.add(confirmRenderable);
  return getConfirmPromise();
}

let activeBlock: ActiveBlock;

let mode: "thinking" | "response" | "tool" | "prompt" | undefined;

export const on = (event: AgentEvent) => {
  switch (event.type) {
    case "ttft_start":
      container.remove("input");
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
        container.remove("input");
        activeBlock = createThinkingBlock();
        mode = "thinking";
      }
      activeBlock.append(event.text);
      break;
    case "response_chunk":
      if (mode !== "response") {
        container.remove("input");
        activeBlock = createResponseBlock();
        mode = "response";
      }

      activeBlock.append(event.text);
      break;
    case "tool_start":
      container.remove("input");
      activeBlock = createToolBlock(event.name);
      mode = "tool";
      break;
    case "tool_event":
      activeBlock.append(event.text);
      break;
    case "tool_error":
      history.add(Text({ content: `Tool error: ${event.message}` }));
      activeBlock.close();
      break;
    case "done":
      mode = "prompt";
      container.add(promptRenderable);
      activeBlock.close();
      break;
  }
};
