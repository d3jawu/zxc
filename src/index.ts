#!/usr/bin/env bun
import run from "./agent";
import { tools } from "./tools";
import { write } from "./ui/output";
import { trigger } from "./ui/ui";
import prompt from "./ui/prompt";

export const modelRef = { current: "qwen3.6:27b-coding-nvfp4" };

write(`Using model ${modelRef.current}.`);

const agent = run({
  model: modelRef.current,
  toolset: tools,
  prompt,
});

for await (const event of agent) {
  trigger(event);
}
