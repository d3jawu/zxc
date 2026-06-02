export type AgentEvent =
  | { type: "ttft_start" }
  | { type: "ttft_end" }
  | { type: "context_used"; count: number }
  | { type: "thinking_chunk"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_event"; text: string }
  | { type: "tool_error"; message: string }
  | { type: "response_chunk"; text: string }
  | { type: "done" };

export type ConfirmResult = string | null;
