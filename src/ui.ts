import chalk from "chalk";
import type { AgentEvent } from "./agent";
import { clearHistory } from "./history";

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

// Promise-holding for prompt
let resolvePromptPromise: (
  value: string | PromiseLike<string>,
) => void = () => {};
let promptPromise = new Promise<string>((resolve) => {
  resolvePromptPromise = resolve;
});

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
});

const input = new InputRenderable(renderer, {
  id: "prompt-input",
});
input.on(InputRenderableEvents.ENTER, (value) => {
  input.value = "";
  history.add(Text({ content: value }));
  resolvePromptPromise(value);
  promptPromise = new Promise<string>((resolve) => {
    resolvePromptPromise = resolve;
  });
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
  return promptPromise;
}

let currentBlock: TextRenderable | MarkdownRenderable;

const createThinkingBlock = () => {
  const box = new BoxRenderable(renderer, {
    title: "Thinking",
    border: true,
    borderStyle: "single",
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
