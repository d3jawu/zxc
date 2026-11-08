#!/usr/bin/env bun
import run from "./agent";
import { log, write } from "./ui/output";
import { trigger } from "./ui/ui";
import config, { getModel } from "./config";
import colors from "./ui/colors";
import { addModel } from "./ui/prompt";

if (config.models.length === 0) {
  log("No models are configured. Configure your first one now:");
  await addModel();
}

const active = getModel();
if (!active) {
  log("No model configured. Exiting.");
  process.exit(1);
}

log(`Using model ${colors.blue(active.model)}.`);

const agent = run();

for await (const event of agent) {
  trigger(event);
}
