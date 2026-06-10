import ansi from "ansi-escape-sequences";
import type { AgentEvent } from "../agent";
import glow from "./glow";
import { write, log, section } from "./output";
import colors from "./colors";
import { setContextUsed } from "./prompt";
import quiet from "./quiet";
import { showTimer, hideTimer } from "./timer";

type State = "thinking" | "response" | "tool" | "prompt" | "timer";

let state: State;

const onState = (newState: State, payload?: string) => {
  const oldState = state;

  if (oldState !== newState) {
    // Leaving state
    switch (oldState) {
      case "thinking": {
        quiet.reset();
        break;
      }
      case "response": {
        if (quiet.enabled) {
          section();
          if (glow) {
            glow(quiet.buffer);
          } else {
            write(quiet.buffer);
          }
        }
        quiet.reset();
        break;
      }
      case "tool": {
        break;
      }
      case "prompt": {
        break;
      }
      case "timer": {
        hideTimer();
        break;
      }
      case undefined: {
        break;
      }
    }

    // Entering state
    switch (newState) {
      case "thinking": {
        const prelude = `${colors.yellow("model(")}${colors.gray("thinking")}${colors.yellow(")")}: `;
        section();
        write(prelude);
        quiet.reset();
        break;
      }
      case "response": {
        const prelude = `${colors.yellow("model(")}${colors.gray("response")}${colors.yellow(")")}: `;
        section();
        write(prelude);
        quiet.reset();
        break;
      }
      case "tool": {
        section();
        write(
          `${colors.green("tool(")}${colors.gray(payload)}${colors.green(")")}: `,
        );
        break;
      }
      case "prompt": {
        break;
      }
      case "timer": {
        write("\n");
        showTimer();
        break;
      }
      case undefined: {
        break;
      }
    }
  }

  // Triggered every time state entered regardless of change
  switch (newState) {
    case "thinking": {
      const prelude = `${colors.yellow("model(")}${colors.gray("thinking")}${colors.yellow(")")}: `;
      if (quiet.enabled) {
        write(
          `${ansi.cursor.back(1000)}${prelude}${colors.gray(`${quiet.count} tokens`)}`,
        );

        quiet.add(payload || "");
      } else {
        write(colors.gray(payload));
      }
      break;
    }
    case "response": {
      const prelude = `${colors.yellow("model(")}${colors.gray("response")}${colors.yellow(")")}: `;
      if (quiet.enabled) {
        write(
          `${ansi.cursor.back(1000)}${prelude}${colors.gray(`${quiet.count} tokens`)}`,
        );

        quiet.add(payload || "");
      } else {
        write(payload || "");
      }
      break;
    }
    case "tool": {
      break;
    }
    case "prompt": {
      quiet.reset();
      break;
    }
    case "timer": {
      break;
    }
    case undefined: {
      break;
    }
  }

  state = newState;
};

export function trigger(event: AgentEvent) {
  switch (event.type) {
    case "ttft_start":
      onState("timer");
      break;
    case "ttft_end":
      break;
    case "context_used":
      setContextUsed(event.count);
      break;
    case "thinking_chunk": {
      onState("thinking", event.text);
      break;
    }
    case "response_chunk": {
      onState("response", event.text);
      break;
    }
    case "tool_start":
      onState("tool", event.name);
      break;
    case "tool_error":
      log(`ERROR: ${event.message}`);
      break;
    case "done":
      onState("prompt");
      break;
  }
}
