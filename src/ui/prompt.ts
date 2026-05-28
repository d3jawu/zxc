import { InputRenderable, InputRenderableEvents } from "@opentui/core";

import renderer from "./renderer";
import { createPromptBlock } from "./history";

let resolver: (value: string | PromiseLike<string>) => void = () => {};

let promptPromise = new Promise<string>((resolve) => {
  resolver = resolve;
});

export const getPromise = () => promptPromise;

export const resolve = (value: string | PromiseLike<string>) => {
  resolver(value);
  promptPromise = new Promise<string>((resolve) => {
    resolver = resolve;
  });
};

const input = new InputRenderable(renderer, {
  cursorStyle: {
    style: "line",
  },
});

input.on(InputRenderableEvents.ENTER, (value) => {
  input.value = "";
  createPromptBlock(value);
  resolve(value);
});
input.focus();

export default input;
