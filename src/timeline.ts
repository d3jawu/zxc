type TimelineElement = (
  | {
      type: "timer";
    }
  | {
      type: "prompt";
    }
  | {
      type: "thinking";
    }
  | {
      type: "response";
    }
  | {
      type: "tool";
    }
) & {
  close: () => void;
};

const createThinkingBlock = (): { type: "thinking" } => {};
