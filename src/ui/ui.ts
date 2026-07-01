import ansi from "ansi-escape-sequences";
import type { AgentEvent } from "../agent";
import glow from "./glow";
import { write, log, section } from "./output";
import colors from "./colors";
import { setContextUsed } from "./prompt";
import summary from "./summary";

type State = "prompt" | "progress" | "tool" | "response";

let state: State = "prompt";

type StatePayloads = {
  prompt: undefined;
  progress: "read" | "list" | "token" | undefined;
  tool: string;
  response: string;
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
  prompt: {},
  progress: {
    enter: () => {
      summary.start();
    },
    tick: (type) => {
      if (type) {
        summary.add(type);
      }
    },
    exit: () => {
      summary.end();
    },
  },
  tool: {
    tick: (payload) => {
      section();
      write(
        `${colors.green("tool(")}${colors.gray(payload)}${colors.green(")")}: `,
      );
    },
  },
  response: {
    enter: (text) => {
      section();
      write(modelPrelude("response"));
      if (text) {
        section();
        glow(text);
      }
    },
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
    case "prompt":
      onState("prompt", undefined);
      break;
    case "start":
      onState("progress", undefined);
      break;
    case "context":
      setContextUsed(event.count);
      break;
    case "token":
      onState("progress", "token");
      break;
    case "tool":
      if (event.tool === "read") {
        onState("progress", "read");
      } else if (event.tool === "list") {
        onState("progress", "list");
      } else {
        onState("tool", event.tool);
      }
      break;
    case "error":
      // TODO: fold errors into summaries
      section();
      log(`ERROR: ${event.message}`);
      break;
    case "response":
      onState("response", event.text);
      break;
  }
}
