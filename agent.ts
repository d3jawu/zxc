import { Ollama } from "ollama";
import type { Message, Tool } from "ollama";
import chalk from "chalk";
import { userInfo } from "os";
import { readFileSync, readdirSync } from "fs";

const ollama = new Ollama({
  host: process.env["OLLAMA_API_BASE"] || undefined,
});

const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "read",
      description:
        "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.",
      parameters: {
        type: "object",
        required: ["file"],
        properties: {
          file: {
            type: "string",
            description: "Path to the file to read.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list",
      description:
        "List files and directories at a given path. If no path is provided, lists files in the current directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the directory to list.",
          },
        },
      },
    },
  },
];

const messages: Message[] = [
  {
    role: "system",
    content: `You are an expert coding assistant. You help users with coding tasks by reading files, executing commands, editing code, and writing new files.
  Your context window is small, so be as concise as possible in both thinking and responding.
  Available tools:
  - read: Read file contents

  Guidelines:
  - Use bash for file operations like ls, grep, find
  - Use read to examine files before editing
  - Use edit for precise changes (old text must match exactly)
  - Use write only for new files or complete rewrites
  - When summarizing your actions, output plain text directly - do NOT use cat or bash to display what you did
  - Be concise in your responses
  - Show file paths clearly when working with files`,
  },
];

const TOOLS: Record<string, Function> = {
  read: ({ file }: { file: string }) => {
    const contents = readFileSync(file).toString();
    const lines = contents.split("\n");
    console.log(lines.slice(0, 10).join("\n"));
    if (lines.length > 10) {
      console.log("...");
    }
    return contents;
  },
  list: ({ path }: { path?: string }) => {
    if (!path) {
      path = process.cwd();
    }

    const files = readdirSync(path);
    console.log(files);

    return readdirSync(path).join(",");
  },
};

const userPrompt = `${chalk.blueBright(userInfo().username)}:`;
let shouldPrompt = true; // Switched off when the assistant is talking to tools.
while (true) {
  if (shouldPrompt) {
    let line = null;
    while (!line) {
      line = prompt(userPrompt);
    }
    messages.push({ role: "user", content: line });
  }

  const response = await ollama.chat({
    model: "qwen3:14b",
    stream: true,
    messages,
    tools,
    think: true,
  });

  let fullResponse = "";
  let mode: "thinking" | "response" | "tool" | undefined;
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
      shouldPrompt = true;
    } else if (part.message.tool_calls) {
      messages.push(part.message);
      for (const toolCall of part.message.tool_calls) {
        process.stdout.write(
          `\n${chalk.green("tool(")}${chalk.gray(toolCall.function.name)}${chalk.green(")")}: ${JSON.stringify(toolCall.function.arguments)}\n`,
        );
        const toolResponse: string = (
          TOOLS[toolCall.function.name] ||
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
      shouldPrompt = false;
    } else if (part.message.content) {
      if (mode !== "response") {
        process.stdout.write(
          `\n${chalk.yellow("agent(")}${chalk.gray("response")}${chalk.yellow(")")}: `,
        );
        mode = "response";
      }
      process.stdout.write(part.message.content);
      shouldPrompt = true;
    } else {
    }
  }
  process.stdout.write("\n");
  if (fullResponse) {
    messages.push({ role: "assistant", content: fullResponse });
    process.stdout.write("\n");
  }
}
