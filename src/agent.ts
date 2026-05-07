import ollama from "./ollama";
import type { Message, Tool } from "ollama";
import type { Ui } from "./ui";
export type ToolSet = {
  definitions: Tool[];
  implementations: Record<string, (args: any) => string>;
};
type AgentOptions = {
  systemPrompt: string;
  model: string;
  toolset: ToolSet;
  ui: Ui;
};
export default async function run({
  model,
  systemPrompt,
  toolset,
  ui,
}: AgentOptions) {
  const messages: Message[] = [{ role: "system", content: systemPrompt }];
  let mode: "thinking" | "response" | "tool" | "prompt" | undefined;
  while (true) {
    if (mode !== "tool") {
      mode = "prompt";
      let line: string | null = null;
      while (!line) {
        line = await ui.onPrompt(model);
      }
      messages.push({ role: "user", content: line });
    }
    ui.onTtftStart();
    const response = await ollama.chat({
      model,
      stream: true,
      messages,
      tools: toolset.definitions,
      think: true,
    });
    ui.onTtftEnd();
    let fullResponse = "";
    for await (const part of response) {
      ui.onContextUsed(part.prompt_eval_count);
      if (part.done) {
        continue;
      }
      fullResponse += part.message.content;
      if (part.message.thinking) {
        if (mode !== "thinking") {
          ui.onThinkingStart();
          mode = "thinking";
        }
        ui.onThinkingChunk(part.message.thinking);
      } else if (part.message.tool_calls) {
        messages.push(part.message);
        for (const toolCall of part.message.tool_calls) {
          ui.onToolStart(toolCall.function.name);
          const toolFn =
            toolset.implementations[toolCall.function.name] ||
            (() => {
              ui.onToolError(
                `Attempted to call invalid tool: ${toolCall.function.name}`,
              );
              return "";
            });
          const toolResponse: string = await toolFn(
            toolCall.function.arguments,
          );
          messages.push({
            role: "tool",
            tool_name: toolCall.function.name,
            content: toolResponse,
          });
        }
        mode = "tool";
      } else if (part.message.content) {
        if (mode !== "response") {
          ui.onResponseStart();
          mode = "response";
        }
        ui.onResponseChunk(part.message.content);
      } else {
        ui.onDone();
        console.log("Warning: unrecognized message");
        console.log(part);
      }
    }
    ui.onDone();
    if (fullResponse) {
      messages.push({ role: "assistant", content: fullResponse });
      ui.onDone();
    }
  }
}
