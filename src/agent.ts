import ollama from "./ollama";
import type { Message, Tool } from "ollama";
export type ToolSet = {
  definitions: Tool[];
  implementations: Record<string, (args: any) => string>;
};
export type AgentCallbacks = {
  onPrompt: (contextString: string) => Promise<string | null>;
  onTtftStart: () => void;
  onTtftEnd: () => void;
  onThinkingStart: () => void;
  onThinkingChunk: (text: string) => void;
  onToolStart: (toolName: string) => void;
  onToolError: (message: string) => void;
  onResponseStart: () => void;
  onResponseChunk: (text: string) => void;
  onDone: () => void;
};
type AgentOptions = {
  systemPrompt: string;
  model: string;
  toolset: ToolSet;
  ui: AgentCallbacks;
};
export default async function run({
  model,
  systemPrompt,
  toolset,
  ui,
}: AgentOptions) {
  const messages: Message[] = [{ role: "system", content: systemPrompt }];
  let contextLength: number | undefined;
  let contextUsed = 0;
  let mode: "thinking" | "response" | "tool" | "prompt" | undefined;
  while (true) {
    if (mode !== "tool") {
      mode = "prompt";
      if (!contextLength) {
        const ps = await ollama.ps();
        const foundModel = ps.models.find(({ model: m }) => m === model);
        if (
          foundModel &&
          "context_length" in foundModel &&
          typeof foundModel.context_length === "number"
        ) {
          contextLength = foundModel.context_length;
        }
      }
      const contextString = !!contextLength
        ? (parseFloat((contextUsed / contextLength).toFixed(3)) * 100).toFixed(
            1,
          ) +
          "%, " +
          (contextUsed / 1000).toFixed(1) +
          "k"
        : "--";
      let line: string | null = null;
      while (!line) {
        line = await ui.onPrompt(contextString);
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
      contextUsed = part.prompt_eval_count;
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
            ((() => {
              ui.onToolError(
                `Attempted to call invalid tool: ${toolCall.function.name}`,
              );
              return "";
            }) as (args: any) => string);
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
