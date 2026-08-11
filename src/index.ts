#!/usr/bin/env bun
import run from "./agent";
import { write } from "./ui/output";
import { trigger } from "./ui/ui";
import config from "./config";
import colors from "./ui/colors";

write(`Using model ${colors.blue(config.model)}.`);

const agent = run();

for await (const event of agent) {
  trigger(event);
}
