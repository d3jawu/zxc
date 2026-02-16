import { Ollama } from "ollama";
import type { Message } from "ollama";
import chalk from "chalk";
import { userInfo } from "os";
import { definitions, tools } from "./tools.ts";

const MODEL = "hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:UD-Q4_K_XL";

const ollama = new Ollama({
  host: process.env["OLLAMA_API_BASE"] || undefined,
});

const messages: Message[] = [
  {
    role: "system",
    content: `You are an expert coding assistant. You help users by reading files, executing commands, editing code, and writing new files.
  Your context window is small, so you must be as concise as possible in both thinking and responding.
  Available tools:
  - read: Read file contents
  - list: List files in directory
  - edit: Replace text to changes to an existing file
  - write: Create or overwrite a file
  - bash: Execute commands
For each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:
<tool_call>
{"name": <function-name>, "arguments": <args-json-object>}
</tool_call>

  Guidelines:
  - Do not leave comments in code, instead strive to make the code itself self-explanatory
  - Use read to examine files before editing
  - Use edit for precise changes (old text must match exactly including indentation)
  - Do not end output until the user request has been addressed
  - Use write only for new files or complete rewrites
  - When summarizing your actions, output plain text directly - do NOT use cat or bash to display what you did
  - Be very concise in your responses
  - Show file paths clearly when working with files`,
  },
];

let mode: "thinking" | "response" | "tool" | undefined;
while (true) {
  if (mode !== "tool") {
    const tokenCount = messages
      .map((m) => m.content)
      .join(" ")
      .split(" ").length;

    let contextLength: number | undefined;
    {
      const ps = await ollama.ps();
      const model = ps.models.find((model) => model.model === MODEL);
      if (
        model &&
        "context_length" in model &&
        typeof model.context_length === "number"
      ) {
        contextLength = model.context_length;
      }
    }

    const contextString = !!contextLength
      ? (parseFloat((tokenCount / contextLength).toFixed(3)) * 100).toFixed(1) +
        "%"
      : `${tokenCount} tokens`;

    let line = null;
    while (!line) {
      line = prompt(
        `${chalk.blueBright(userInfo().username + "(")}${chalk.gray(contextString)}${chalk.blueBright(")")}:`,
      );
    }
    messages.push({ role: "user", content: line });
  }

  const response = await ollama.chat({
    model: MODEL,
    stream: true,
    messages,
    tools: definitions,
    think: false,
  });

  let fullResponse = "";
  for await (const part of response) {
    if (part.done) {
      continue;
    }

    fullResponse += part.message.content;
    if (part.message.thinking) {
      if (mode !== "thinking") {
        process.stdout.write(
          `\n${chalk.yellow("agent(")}${chalk.gray("thinking")}${chalk.yellow(")")}: `,
        );
        mode = "thinking";
      }

      process.stdout.write(chalk.gray(part.message.thinking));
    } else if (part.message.tool_calls) {
      messages.push(part.message);
      for (const toolCall of part.message.tool_calls) {
        process.stdout.write(
          `\n${chalk.green("tool(")}${chalk.gray(toolCall.function.name)}${chalk.green(")")}: ${JSON.stringify(toolCall.function.arguments)}\n`,
        );
        const toolResponse: string = await (
          tools[toolCall.function.name] ||
          (() => {
            console.log(
              `${chalk.red("error")}: Attempted to call invalid tool ${toolCall.function.name}`,
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
          `\n${chalk.yellow("agent(")}${chalk.gray("response")}${chalk.yellow(")")}: `,
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
