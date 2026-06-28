import ansi from "ansi-escape-sequences";
import type { AgentEvent } from "../agent";
import glow from "./glow";
import { write, log, section } from "./output";
import colors from "./colors";
import { setContextUsed } from "./prompt";
import quiet from "./quiet";
import { showTimer, hideTimer } from "./timer";

type State = "thinking" | "response" | "tool" | "prompt" | "timer";

let state: State = "prompt";

type StatePayloads = {
  thinking: string;
  response: string;
  tool: { name: string };
  prompt: undefined;
  timer: undefined;
};

type StateHandler<S extends State> = {
  enter?: (payload: StatePayloads[S]) => void;
  exit?: () => void;
  tick?: (payload: StatePayloads[S]) => void;
};

const modelPrelude = (label: State) =>
  `${colors.yellow("model(")}${colors.gray(label)}${colors.yellow(")")}: `;

const stateHandlers: {
  [K in State]: StateHandler<K>;
} = {
  thinking: {
    enter: () => {
      section();
      write(modelPrelude("thinking"));
      quiet.reset();
    },
    exit: () => quiet.reset(),
    tick: (text) => {
      if (quiet.enabled) {
        write(
          `${ansi.cursor.back(1000)}${modelPrelude("thinking")}${colors.gray(`${quiet.count} tokens`)}`,
        );
        quiet.add(text);
      } else {
        write(colors.gray(text));
      }
    },
  },
  response: {
    enter: () => {
      section();
      write(modelPrelude("response"));
      quiet.reset();
    },
    exit: () => {
      if (quiet.enabled) {
        section();
        if (glow) {
          glow(quiet.buffer);
        } else {
          write(quiet.buffer);
        }
      }
      quiet.reset();
    },
    tick: (text) => {
      if (quiet.enabled) {
        write(
          `${ansi.cursor.back(1000)}${modelPrelude("response")}${colors.gray(`${quiet.count} tokens`)}`,
        );
        quiet.add(text);
      } else {
        write(text);
      }
    },
  },
  tool: {
    enter: (payload) => {
      section();
      write(
        `${colors.green("tool(")}${colors.gray(payload.name)}${colors.green(")")}: `,
      );
    },
  },
  prompt: {
    tick: () => quiet.reset(),
  },
  timer: {
    enter: () => {
      write("\n");
      showTimer();
    },
    exit: () => hideTimer(),
  },
};

const onState = <S extends State>(newState: S, payload: StatePayloads[S]) => {
  const oldState = state;
  const handler = stateHandlers[newState];

  if (oldState !== newState) {
    stateHandlers[oldState].exit?.();
    handler.enter?.(payload);
  }

  handler.tick?.(payload);
  state = newState;
};

export function trigger(event: AgentEvent) {
  switch (event.type) {
    case "ttft_start":
      onState("timer", undefined);
      break;
    case "context_used":
      setContextUsed(event.count);
      break;
    case "thinking_chunk":
      onState("thinking", event.text);
      break;
    case "response_chunk":
      onState("response", event.text);
      break;
    case "tool_start":
      onState("tool", { name: event.name });
      break;
    case "error":
      log(`ERROR: ${event.message}`);
      break;
    case "done":
      onState("prompt", undefined);
      break;
  }
}
