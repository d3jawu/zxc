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

import ollama from "../ollama";

import { modelRef } from "../index";

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
    createPromptBlock(textarea.plainText, prelude.content);
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
});

let contextLength: number | undefined;
export const setContextUsed = async (contextUsed: number) => {
  if (contextUsed === undefined) {
    contextUsed = 0;
  }
  if (contextLength === undefined) {
    const ps = await ollama.ps();
    const foundModel = ps.models.find(({ model: m }) => m === modelRef.current);
    if (
      foundModel &&
      "context_length" in foundModel &&
      typeof foundModel.context_length === "number"
    ) {
      contextLength = foundModel.context_length;
    }
  }

  let contextString;
  if (!contextLength) {
    contextString = "--";
  } else {
    contextString =
      (parseFloat((contextUsed / contextLength).toFixed(3)) * 100).toFixed(1) +
      "%, " +
      (contextUsed / 1000).toFixed(1) +
      "k";
  }

  prelude.content = t`${fg(colors.purple)(userInfo().username + "(")}${fg(colors.gray)(contextString)}${fg(colors.purple)(")")}: `;
};
setContextUsed(0);

const box = new BoxRenderable(renderer, {
  flexDirection: "row",
  onMouseDown: () => {
    textarea.focus();
  },
});
box.add(prelude);
box.add(textarea);

export default box;
