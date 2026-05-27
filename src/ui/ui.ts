import chalk from "chalk";
import type { AgentEvent } from "../agent";

import { getPromise, resolve } from "./prompt";

let contextUsed = 0;

import {
  createCliRenderer,
  Text,
  InputRenderableEvents,
  InputRenderable,
  ScrollBoxRenderable,
  TextRenderable,
  t,
  bg,
  BoxRenderable,
  MarkdownRenderable,
  SyntaxStyle,
} from "@opentui/core";

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
});

const input = new InputRenderable(renderer, {
  id: "prompt-input",
});
input.on(InputRenderableEvents.ENTER, (value) => {
  input.value = "";
  history.add(Text({ content: value }));
  resolve(value);
});
input.focus();

const history = new ScrollBoxRenderable(renderer, {
  stickyScroll: true,
  stickyStart: "bottom",
});

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

let currentBlock: TextRenderable | MarkdownRenderable;

const createThinkingBlock = () => {
  const box = new BoxRenderable(renderer, {
    title: "Thinking",
    border: true,
    borderStyle: "single",
    borderColor: "#999",
  });

  const block = new TextRenderable(renderer, {
    content: "",
    fg: "#666",
  });

  box.add(block);
  history.add(box);
  return block;
};

const createResponseBlock = () => {
  const box = new BoxRenderable(renderer, {
    title: "Response",
    border: true,
    borderStyle: "single",
  });

  const block = new MarkdownRenderable(renderer, {
    content: "",
    syntaxStyle: SyntaxStyle.fromStyles({}),
    streaming: true,
  });
  box.add(block);
  history.add(box);
  return block;
};

const createPromptBlock = (prompt: string) => {};

let mode: "thinking" | "response" | "tool" | "prompt" | undefined;

export const on = (event: AgentEvent) => {
  switch (event.type) {
    case "ttft_start":
      history.add(Text({ content: "Start waiting for tokens..." }));
      break;
    case "ttft_end":
      history.add(Text({ content: "Done waiting for tokens" }));
      break;
    case "context_used":
      contextUsed = event.count;
      break;
    case "thinking_chunk":
      if (mode !== "thinking") {
        currentBlock = createThinkingBlock();
        mode = "thinking";
      }

      if (typeof currentBlock.content === "string") {
        currentBlock.content = currentBlock.content + event.text;
      } else {
        const content = currentBlock.content.chunks.map((c) => c.text).join("");
        currentBlock.content = content + event.text;
      }
      break;
    case "response_chunk":
      if (mode !== "response") {
        currentBlock = createResponseBlock();
        mode = "response";
      }

      if (typeof currentBlock.content === "string") {
        currentBlock.content = currentBlock.content + event.text;
      } else {
        const content = currentBlock.content.chunks.map((c) => c.text).join("");
        currentBlock.content = content + event.text;
      }
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
