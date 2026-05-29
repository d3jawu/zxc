import {
  t,
  fg,
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  TextRenderable,
  TextareaRenderable,
} from "@opentui/core";

import renderer from "./renderer";
import { createPromptBlock } from "./history";

import { userInfo } from "os";
import colors from "./colors";

import history from "./history";

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

const textarea = new TextareaRenderable(renderer, {
  cursorStyle: {
    style: "line",
  },
  onSubmit: () => {
    createPromptBlock(textarea.plainText);
    resolve(textarea.plainText);
    textarea.setText("");
  },
  keyBindings: [
    {
      name: "return",
      action: "submit",
    },
  ],
});

textarea.focus();

const prelude = new TextRenderable(renderer, {
  fg: colors.gray,
  content: t`${fg(colors.purple)(userInfo().username)}: `,
});

const box = new BoxRenderable(renderer, {
  flexDirection: "row",
  onMouseDown: () => {
    textarea.focus();
  },
});
box.add(prelude);
box.add(textarea);

export default box;
