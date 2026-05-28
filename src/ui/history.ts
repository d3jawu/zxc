import {
  t,
  fg,
  TextRenderable,
  BoxRenderable,
  MarkdownRenderable,
  ScrollBoxRenderable,
  SyntaxStyle,
} from "@opentui/core";

import renderer from "./renderer";

import colors from "./colors";

const history = new ScrollBoxRenderable(renderer, {
  stickyScroll: true,
  stickyStart: "bottom",
});

export type ActiveBlock = {
  renderable: TextRenderable | MarkdownRenderable;
  append: (text: string) => void; // appends text to current block, if applicable
  close: () => void; // close-out function to be called when the block is done being written to.
};

const commonProperties = {
  marginBottom: 1,
};

// TODO move these into their own module
let runtimes: number[] = [];
let maxRuntime = 0;
export const createTimerBlock = (): ActiveBlock => {
  const text = new TextRenderable(renderer, {
    content: "",
    ...commonProperties,
  });

  const startTime = Date.now();
  let elapsed = 0;

  const averageRunTime =
    runtimes.reduce((val, sum) => val + sum, 0) / runtimes.length;

  const intervalId = setInterval(() => {
    elapsed = (Date.now() - startTime) / 1000;
    let color: string;
    if (elapsed <= averageRunTime) {
      color = colors.green;
    } else if (elapsed <= maxRuntime) {
      color = colors.yellow;
    } else {
      color = colors.red;
    }
    text.content = t`Model running: ${fg(color)(`${elapsed.toFixed(2)}s`)}`;
  }, 10);

  const close = () => {
    clearInterval(intervalId);
    let color: string;
    if (elapsed <= averageRunTime) {
      color = colors.green;
    } else if (elapsed <= maxRuntime) {
      color = colors.yellow;
    } else {
      color = colors.red;
    }
    text.content = t`${fg(colors.gray)("Model ran for:")} ${fg(color)(`${elapsed.toFixed(2)}s`)}`;
    if (elapsed > maxRuntime) {
      maxRuntime = elapsed;
    }
    runtimes.push(elapsed);
  };

  history.add(text);

  return {
    renderable: text,
    append: () => {},
    close,
  };
};

export const createThinkingBlock = (): ActiveBlock => {
  let content = "";
  const block = new TextRenderable(renderer, {
    content: "",
    fg: colors.gray,
    ...commonProperties,
  });

  history.add(block);
  return {
    renderable: block,
    append: (text) => {
      content += text;
      block.content = t`${fg(colors.yellow)("model(")}${fg(colors.gray)("thinking")}${fg(colors.yellow)(")")}: ${content}`;
    },
    close: () => {},
  };
};

export const createResponseBlock = (): ActiveBlock => {
  let content = "";
  const box = new BoxRenderable(renderer, {
    ...commonProperties,
  });

  box.add(
    new TextRenderable(renderer, {
      content: t`${fg(colors.yellow)("model(")}${fg(colors.gray)("response")}${fg(colors.yellow)(")")}:`,
    }),
  );

  const block = new MarkdownRenderable(renderer, {
    content: "",
    syntaxStyle: SyntaxStyle.fromStyles({}),
    streaming: true,
  });
  box.add(block);

  history.add(box);
  return {
    renderable: block,
    append: (text) => {
      content += text;
      block.content = content;
    },
    close: () => {
      block.streaming = false;
    },
  };
};

export const createPromptBlock = (prompt: string) => {
  const block = new TextRenderable(renderer, {
    content: prompt,
    ...commonProperties,
  });
  history.add(block);
};

export default history;
