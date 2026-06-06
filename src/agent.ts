import ollama from "./ollama";
import type { Message, Tool } from "ollama";

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
  promptProvider: (model: string) => Promise<string | null>;
};

export default async function* run({
  model,
  systemPrompt,
  toolset,
  promptProvider,
}: AgentOptions): AsyncGenerator<AgentEvent> {
  const messages: Message[] = [{ role: "system", content: systemPrompt }];
  let mode: "thinking" | "response" | "tool" | "prompt" | undefined;

  while (true) {
    if (mode !== "tool") {
      let line: string | null = null;
      while (!line) {
        line = await promptProvider(model);
      }
      messages.push({ role: "user", content: line });
    }

    yield { type: "ttft_start" };
    const response = await ollama.chat({
      model,
      stream: true,
      messages,
      tools: toolset.definitions,
      think: true,
      keep_alive: "20m",
    });
    yield { type: "ttft_end" };

    let fullResponse = "";
    for await (const part of response) {
      yield { type: "context_used", count: part.prompt_eval_count };
      if (part.done) continue;

      fullResponse += part.message.content;
      if (part.message.thinking) {
        mode = "thinking";
        yield { type: "thinking_chunk", text: part.message.thinking };
      } else if (part.message.tool_calls) {
        mode = "tool";
        messages.push(part.message);
        for (const toolCall of part.message.tool_calls) {
          yield { type: "tool_start", name: toolCall.function.name };
          const toolFn = toolset.implementations[toolCall.function.name];
          if (!toolFn) {
            yield {
              type: "tool_error",
              message: `Attempted to call invalid tool: ${toolCall.function.name}`,
            };
            messages.push({
              role: "tool",
              tool_name: toolCall.function.name,
              content: "",
            });
            continue;
          }
          const toolResponse = await toolFn(toolCall.function.arguments);
          messages.push({
            role: "tool",
            tool_name: toolCall.function.name,
            content: toolResponse,
          });
        }
      } else if (part.message.content) {
        mode = "response";
        yield { type: "response_chunk", text: part.message.content };
      }
    }
    yield { type: "done" };

    if (fullResponse) {
      messages.push({ role: "assistant", content: fullResponse });
    }
  }
}
