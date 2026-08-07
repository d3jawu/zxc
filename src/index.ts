#!/usr/bin/env bun
import run from "./agent";
import { tools } from "./tools";
import { write } from "./ui/output";
import { trigger } from "./ui/ui";
import config from "./config";

write(`Using model ${config.model}.`);

const agent = run({
  model: config.model,
  toolset: tools,
});

for await (const event of agent) {
  trigger(event);
}
