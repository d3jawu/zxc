import type { ToolCall } from "ollama";
import { pushHistory, getHistory } from "./history";
import { chat } from "./ollama";
import type { ToolName } from "./tools";
import toolset from "./tools";
import prompt from "./ui/prompt";

export type AgentEvent =
  | { type: "prompt" }
  | { type: "start" }
  | { type: "context"; count: number }
  | { type: "tool"; tool: ToolName }
  | { type: "token" }
  | { type: "response"; text: string }
  | { type: "error"; message: string };

export default async function* run(): AsyncGenerator<AgentEvent> {
  // Whether to loop again for a tool call.
  let tool = false;
  let gotResponse = true;

  while (true) {
    if (!tool && gotResponse) {
      yield { type: "prompt" };
      let line: string | null = null;
      while (!line) {
        line = await prompt();
      }
      pushHistory({ role: "user", content: line });
    }
    gotResponse = false;

    yield { type: "start" };
    let response;
    while (true) {
      try {
        response = await chat();
        break;
      } catch (e) {
        yield { type: "error", message: `Ollama failed, retrying.\n${e}` };
      }
    }

    let fullResponse = "";
    tool = false;
    let toolCalls: ToolCall[] = [];
    for await (const part of response) {
      if (part.prompt_eval_count !== undefined) {
        yield { type: "context", count: part.prompt_eval_count };
      }

      if (part.message.thinking) {
        yield { type: "token" };
      }

      if (part.message.tool_calls) {
        pushHistory(part.message);
        toolCalls = part.message.tool_calls;
      }

      if (part.message.content) {
        fullResponse += part.message.content;
        yield { type: "token" };
      }
    }

    if (fullResponse) {
      pushHistory({ role: "assistant", content: fullResponse });
      gotResponse = true;
      yield { type: "response", text: fullResponse };
    }

    for (const toolCall of toolCalls) {
      tool = true;
      const toolDef = toolset[toolCall.function.name as ToolName];
      if (!toolDef) {
        yield {
          type: "error",
          message: `Attempted to call invalid tool: ${toolCall.function.name}`,
        };
        pushHistory({
          role: "tool",
          tool_name: toolCall.function.name,
          content: `Invalid tool: ${toolCall.function.name}`,
        });
        continue;
      }
      yield { type: "tool", tool: toolCall.function.name as ToolName };
      const toolResponse = await toolDef.run(toolCall.function.arguments);
      pushHistory({
        role: "tool",
        tool_name: toolCall.function.name,
        content: toolResponse,
      });
    }
  }
}
