import chalk from "chalk";
import type { AgentEvent } from "./agent";
import { clearHistory } from "./history";

import {
  Box,
  createCliRenderer,
  Text,
  InputRenderableEvents,
  InputRenderable,
  ScrollBoxRenderable,
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
  flexDirection: "column",
});

const container = Box(
  {
    flexDirection: "column",
  },
  history,
  input,
);

renderer.root.add(container);

export async function prompt(): Promise<string | null> {
  return promptPromise;
}

export function renderThinkingChunk(text: string) {
  // process.stdout.write(chalk.gray(text));
  history.add(Text({ content: chalk.gray(text) }));
}

export function renderResponseChunk(text: string) {
  // process.stdout.write(text);
  history.add(Text({ content: text }));
}

export function renderToolStart(toolName: string) {
  // process.stdout.write(
  //   `\n${chalk.green("tool(")}${chalk.gray(toolName)}${chalk.green(")")}\n`,
  // );
  history.add(
    Text({
      content: `\n${chalk.green("tool(")}${chalk.gray(toolName)}${chalk.green(")")}\n`,
    }),
  );
}

export function renderToolError(message: string) {
  // showError(message);
  history.add(Text({ content: `Tool error: ${message}` }));
}

export function startTtft() {
  // showTimer();
  history.add(Text({ content: "Start waiting for tokens..." }));
}

export function endTtft() {
  // hideTimer();
  history.add(Text({ content: "Done waiting for tokens" }));
}

export function finishResponse() {
  // process.stdout.write("\n");
}

export function printThinkingHeader() {
  // process.stdout.write(
  //   `\n${chalk.yellow("model(")}${chalk.gray("thinking")}${chalk.yellow(")")}: `,
  // );
  history.add(Text({ content: "Start thinking" }));
}

export function startResponse() {
  // process.stdout.write(
  //   `\n${chalk.yellow("model(")}${chalk.gray("response")}${chalk.yellow(")")}: `,
  // );
  history.add(Text({ content: "Start response" }));
}

let mode: "thinking" | "response" | "tool" | "prompt" | undefined;

export function on(event: AgentEvent) {
  switch (event.type) {
    case "ttft_start":
      startTtft();
      break;
    case "ttft_end":
      endTtft();
      break;
    case "context_used":
      contextUsed = event.count;
      break;
    case "thinking_chunk":
      if (mode !== "thinking") {
        printThinkingHeader();
        mode = "thinking";
      }
      renderThinkingChunk(event.text);
      break;
    case "response_chunk":
      if (mode !== "response") {
        startResponse();
        mode = "response";
      }
      renderResponseChunk(event.text);
      mode = "response";
      break;
    case "tool_start":
      renderToolStart(event.name);
      mode = "tool";
      break;
    case "tool_error":
      renderToolError(event.message);
      break;
    case "done":
      finishResponse();
      mode = "prompt";
      break;
  }
}
