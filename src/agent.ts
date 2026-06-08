import { pushHistory, getHistory } from "./history";
import ollama from "./ollama";
import type { Tool } from "ollama";
import { write } from "./output";

export type ToolSet = {
  definitions: Tool[];
  implementations: Record<string, (args: any) => Promise<string> | string>;
};

export type AgentEvent =
  | { type: "ttft_start" }
  | { type: "ttft_end" }
  | { type: "context_used"; count: number }
  | { type: "thinking_chunk"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_error"; message: string }
  | { type: "response_chunk"; text: string }
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
  write(`Using ${model}.`);
  // const messages: Message[] = [{ role: "system", content: systemPrompt }];
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
    const response = await ollama.chat({
      model,
      stream: true,
      messages: getHistory(),
      tools: toolset.definitions,
      think: true,
      keep_alive: "20m",
    });
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
          const toolFn = toolset.implementations[toolCall.function.name];
          if (!toolFn) {
            yield {
              type: "tool_error",
              message: `Attempted to call invalid tool: ${toolCall.function.name}`,
            };
            pushHistory({
              role: "tool",
              tool_name: toolCall.function.name,
              content: "",
            });
            continue;
          }
          const toolResponse = await toolFn(toolCall.function.arguments);
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
