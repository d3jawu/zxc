import {
  BoxRenderable,
  InputRenderable,
  TextareaRenderable,
  TextRenderable,
} from "@opentui/core";
import renderer from "./renderer";

import type { ConfirmResult } from "../types";

let resolver: (
  value: ConfirmResult | PromiseLike<ConfirmResult>,
) => void = () => {};

let promptPromise = new Promise<ConfirmResult>((resolve) => {
  resolver = resolve;
});

export const getPromise = () => promptPromise;

export const resolve = (value: ConfirmResult | PromiseLike<ConfirmResult>) => {
  resolver(value);
  promptPromise = new Promise<ConfirmResult>((resolve) => {
    resolver = resolve;
  });
};

const textarea = new TextareaRenderable(renderer, {
  cursorStyle: {
    style: "line",
  },
  paddingLeft: 2,
  onSubmit: () => {
    if (textarea.plainText === "") {
      resolve(null);
    } else {
      resolve(textarea.plainText);
    }
  },
  keyBindings: [
    {
      name: "return",
      action: "submit",
    },
  ],
});

const box = new BoxRenderable(renderer, {
  id: "input",
  flexDirection: "row",
  onMouseDown: () => {
    textarea.focus();
  },
});

box.add(
  new TextRenderable(renderer, {
    content: "Confirm (↵) or deny (give reason): ",
  }),
);
box.add(textarea);

export default box;
