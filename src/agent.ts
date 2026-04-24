import { Ollama } from "ollama";
import type { Message, Tool } from "ollama";
import chalk from "chalk";
import { userInfo } from "os";
import { showError, showTimer, hideTimer } from "./util";

const ollama = new Ollama({
  host: process.env["OLLAMA_API_BASE"] || undefined,
});
export type ToolSet = {
  definitions: Tool[];
  implementations: Record<string, (args: any) => string>;
};
type AgentOptions = { systemPrompt: string; model: string; toolset: ToolSet };
export default async function run({
  model,
  systemPrompt,
  toolset,
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
      let line = null;
      while (!line) {
        line = prompt(
          `${chalk.blueBright(userInfo().username + "(")}${chalk.gray(contextString)}${chalk.blueBright(")")}:`,
        );
        if (line && line.startsWith("/")) {
          const [command, ...args] = line.split(" ");
          if (command === "/model") {
            const models = (await ollama.list()).models.map(
              (model) => model.name,
            );
            if (args.length === 0) {
              console.log("Available models:\n");
              console.log(models.join("\n"));
            } else {
              const newModel = args[0] as string;
              if (!models.includes(newModel)) {
                console.log(`Model not found: ${newModel}`);
              } else {
                console.log(`Model set to ${newModel}.`);
                model = newModel;
              }
            }
          } else {
            console.log(`Invalid command: ${command}`);
          }
          line = null;
        }
      }
      messages.push({ role: "user", content: line });
    }
    showTimer();
    const response = await ollama.chat({
      model,
      stream: true,
      messages,
      tools: toolset.definitions,
      think: false,
    });
    hideTimer();
    let fullResponse = "";
    for await (const part of response) {
      contextUsed = part.prompt_eval_count;
      if (part.done) {
        continue;
      }
      fullResponse += part.message.content;
      if (part.message.thinking) {
        if (mode !== "thinking") {
          process.stdout.write(
            `\n${chalk.yellow("model(")}${chalk.gray("thinking")}${chalk.yellow(")")}: `,
          );
          mode = "thinking";
        }
        process.stdout.write(chalk.gray(part.message.thinking));
      } else if (part.message.tool_calls) {
        messages.push(part.message);
        for (const toolCall of part.message.tool_calls) {
          process.stdout.write(
            `\n${chalk.green("tool(")}${chalk.gray(toolCall.function.name)}${chalk.green(")")}\n`,
          );
          const toolResponse: string = await (
            toolset.implementations[toolCall.function.name] ||
            (() => {
              showError(
                `Attempted to call invalid tool: ${toolCall.function.name}`,
              );
              return "";
            })
          )(toolCall.function.arguments);
          messages.push({
            role: "tool",
            tool_name: toolCall.function.name,
            content: toolResponse,
          });
        }
        mode = "tool";
      } else if (part.message.content) {
        if (mode !== "response") {
          process.stdout.write(
            `\n${chalk.yellow("model(")}${chalk.gray("response")}${chalk.yellow(")")}: `,
          );
          mode = "response";
        }
        process.stdout.write(part.message.content);
      } else {
        console.log("Warning: unrecognized message");
        console.log(part);
      }
    }
    process.stdout.write("\n");
    if (fullResponse) {
      messages.push({ role: "assistant", content: fullResponse });
      process.stdout.write("\n");
    }
  }
}
