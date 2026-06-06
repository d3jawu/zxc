export type HistoryElement =
  | { type: "prompt" }
  | Timer
  | ToolUse
  | Thinking
  | Response;

export type Timer = {
  type: "timer";
  stop: () => void;
};

export type Tool =
  | {
      name: "read";
      file: string;
    }
  | {
      name: "list";
      path: string;
    }
  | {
      name: "edit";
      file: string;
      target: string;
      replacement: string;
    }
  | {
      name: "write";
      file: string;
      contents: string;
    }
  | {
      name: "bash";
      command: string;
    };

export type ToolUse = {
  type: "tool";

  response: (response: ToolResponse) => void;
};

export type ToolResponse =
  | {
      type: "success";
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "file";
      contents: string;
    }
  | {
      type: "text";
      contents: string;
    };

export type Thinking = {
  type: "thinking";
  append: (text: string) => void;
};

export type Response = {
  type: "response";
  append: (text: string) => void;
};
