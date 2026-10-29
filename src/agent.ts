import { OpenAI } from "openai";
import { pushHistory, setHistoryFile } from "./history";
import { chat } from "./api";
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

type AccumulatedToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export default async function* run(): AsyncGenerator<AgentEvent> {
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
        yield { type: "error", message: `Request failed, retrying.\n${e}` };
      }
    }

    let fullResponse = "";
    tool = false;
    const toolCallAccum: AccumulatedToolCall[] = [];

    for await (const part of response) {
      if (part.prompt_eval_count !== undefined) {
        yield { type: "context", count: part.prompt_eval_count };
      }

      if (part.content) {
        fullResponse += part.content;
        yield { type: "token" };
      }

      if (part.tool_calls) {
        for (const tc of part.tool_calls) {
          const idx = tc.index;
          if (!toolCallAccum[idx]) {
            toolCallAccum[idx] = {
              id: tc.id || `call_${Date.now()}_${idx}`,
              name: tc.function.name || "",
              arguments: "",
            };
          }
          const acc = toolCallAccum[idx];
          if (tc.id) acc.id = tc.id;
          if (tc.function.name) acc.name = tc.function.name;
          acc.arguments += tc.function.arguments || "";
        }
      }
    }

    if (fullResponse) {
      pushHistory({ role: "assistant", content: fullResponse });
      gotResponse = true;
      yield { type: "response", text: fullResponse };

      setHistoryFile();
    }

    if (toolCallAccum.some((x) => x !== undefined)) {
      tool = true;
      const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = toolCallAccum
        .filter((x) => x !== undefined)
        .map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(JSON.parse(tc.arguments || "{}")),
          },
        })) as OpenAI.ChatCompletionMessageToolCall[];

      pushHistory({
        role: "assistant",
        content: null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        const toolDef = toolset[toolCall.function.name as ToolName];
        if (!toolDef) {
          yield {
            type: "error",
            message: `Attempted to call invalid tool: ${toolCall.function.name}`,
          };
          pushHistory({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Invalid tool: ${toolCall.function.name}`,
          });
          continue;
        }
        yield { type: "tool", tool: toolCall.function.name as ToolName };
        const parsedArgs = JSON.parse(toolCall.function.arguments);
        const toolResponse = await toolDef.run(parsedArgs);
        pushHistory({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResponse,
        });
      }
    }
  }
}
