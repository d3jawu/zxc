import { pushHistory, getHistory } from "./history";
import ollama from "./ollama";
import type { ToolName, ToolSet } from "./tools";

export type AgentEvent =
  | { type: "ttft_start" }
  | { type: "ttft_end" }
  | { type: "context_used"; count: number }
  | { type: "thinking_chunk"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "response_chunk"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

type AgentOptions = {
  systemPrompt: string;
  model: string;
  toolset: ToolSet;
  prompt: () => Promise<string | null>;
};

export default async function* run({
  model,
  systemPrompt,
  toolset,
  prompt,
}: AgentOptions): AsyncGenerator<AgentEvent> {
  if (getHistory().length === 0) {
    pushHistory({ role: "system", content: systemPrompt });
  }
  // Whether to loop again for a tool call.
  let tool = false;

  while (true) {
    if (!tool) {
      let line: string | null = null;
      while (!line) {
        line = await prompt();
      }
      pushHistory({ role: "user", content: line });
    }

    yield { type: "ttft_start" };
    let response;
    while (true) {
      try {
        response = await ollama.chat({
          model,
          stream: true,
          messages: getHistory(),
          tools: Object.values(toolset).map((t) => ({
            type: t.type,
            function: t.function,
          })),
          think: true,
          keep_alive: "20m",
        });
        break;
      } catch (e) {
        yield { type: "error", message: `Ollama failed, retrying.\n${e}` };
      }
    }
    yield { type: "ttft_end" };

    let fullResponse = "";
    for await (const part of response) {
      if (part.prompt_eval_count !== undefined) {
        yield { type: "context_used", count: part.prompt_eval_count };
      }
      if (part.done) continue;

      fullResponse += part.message.content;
      tool = false;
      if (part.message.thinking) {
        yield { type: "thinking_chunk", text: part.message.thinking };
      } else if (part.message.tool_calls) {
        tool = true;
        pushHistory(part.message);
        for (const toolCall of part.message.tool_calls) {
          yield { type: "tool_start", name: toolCall.function.name };
          const toolDef = toolset[toolCall.function.name as ToolName];
          if (!toolDef) {
            yield {
              type: "error",
              message: `Attempted to call invalid tool: ${toolCall.function.name}`,
            };
            pushHistory({
              role: "tool",
              tool_name: toolCall.function.name,
              content: "",
            });
            continue;
          }
          const toolResponse = await toolDef.run(toolCall.function.arguments);
          pushHistory({
            role: "tool",
            tool_name: toolCall.function.name,
            content: toolResponse,
          });
        }
      } else if (part.message.content) {
        yield { type: "response_chunk", text: part.message.content };
      }
    }
    yield { type: "done" };

    if (fullResponse) {
      pushHistory({ role: "assistant", content: fullResponse });
    }
  }
}
