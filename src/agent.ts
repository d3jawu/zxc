import { createMessageHistory } from "./history";
import ollama from "./ollama";
import type { Message, Tool } from "ollama";
import type { AgentEvent } from "./types";

export type ToolSet = {
  definitions: Tool[];
  implementations: Record<string, (args: any) => Promise<string> | string>;
};

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
  console.log(`Using ${model}.`);
  // const messages: Message[] = [{ role: "system", content: systemPrompt }];
  const history = createMessageHistory();
  if (history.messages.length === 0) {
    history.push({ role: "system", content: systemPrompt });
  }
  // Whether to loop again for a tool call.
  let tool = false;

  while (true) {
    if (!tool) {
      let line: string | null = null;
      while (!line) {
        line = await prompt();
      }
      history.push({ role: "user", content: line });
    }

    yield { type: "ttft_start" };
    const response = await ollama.chat({
      model,
      stream: true,
      messages: history.messages,
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
        history.push(part.message);
        for (const toolCall of part.message.tool_calls) {
          yield { type: "tool_start", name: toolCall.function.name };
          const toolFn = toolset.implementations[toolCall.function.name];
          if (!toolFn) {
            yield {
              type: "tool_error",
              message: `Attempted to call invalid tool: ${toolCall.function.name}`,
            };
            history.push({
              role: "tool",
              tool_name: toolCall.function.name,
              content: "",
            });
            continue;
          }
          const toolResponse = await toolFn(toolCall.function.arguments);
          history.push({
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
      history.push({ role: "assistant", content: fullResponse });
    }
  }
}
