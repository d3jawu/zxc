import { Ollama } from "ollama";
import type { Message, Tool } from "ollama";
import chalk from "chalk";
import { userInfo } from "os";
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { spawnSync } from "bun";

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
  {
    type: "function",
    function: {
      name: "edit",
      description:
        "Replace all occurrences of a string in a file with another string. Use this for precise text replacement in files.",
      parameters: {
        type: "object",
        required: ["file", "target", "replacement"],
        properties: {
          file: {
            type: "string",
            description: "Path to the file to edit.",
          },
          target: {
            type: "string",
            description: "The exact string to match and replace.",
          },
          replacement: {
            type: "string",
            description: "The string to replace the 'replace' string with.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description:
        "Write content to a specified file. Use this for creating new files or overwriting existing ones.",
      parameters: {
        type: "object",
        required: ["file", "contents"],
        properties: {
          file: {
            type: "string",
            description: "Path to the file to be written",
          },
          contents: {
            type: "string",
            description: "The content to be written to the file",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description:
        "Execute a bash command. Use this to run shell commands directly.",
      parameters: {
        type: "object",
        required: ["command"],
        properties: {
          command: {
            type: "string",
            description: "The command (with arguments) to be run",
          },
        },
      },
    },
  },
];

const messages: Message[] = [
  {
    role: "system",
    content: `You are an expert coding assistant. You help users by reading files, executing commands, editing code, and writing new files.
  Your context window is small, so be as concise as possible in both thinking and responding.
  If you ever use the word "wait" while thinking, stop thinking and begin responding instead.
  Available tools:
  - read: Read file contents
  - list: List files in directory
  - edit: Make changes to an existing file
  - write: Create or overwrite a file
  - bash: Execute commands

  Guidelines:
  - Use read to examine files before editing
  - Use edit for precise changes (old text must match exactly)
  - Use write only for new files or complete rewrites
  - When summarizing your actions, output plain text directly - do NOT use cat or bash to display what you did
  - Be very concise in your responses
  - Show file paths clearly when working with files`,
  },
];

const TOOLS: Record<string, Function> = {
  read: ({ file }: { file: string }) => {
    const contents = readFileSync(file, "utf-8");
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
  edit: ({
    file,
    target,
    replacement,
  }: {
    file: string;
    target: string;
    replacement: string;
  }) => {
    const content = readFileSync(file, "utf-8");

    console.log(
      `REPLACE:\n...\n${target}\n...\n\nWITH:\n...\n${replacement}\n...\n`,
    );

    if (!content.includes(target)) {
      console.log("Error: String to replace was not found.");
      return "String to replace was not found. Try another";
    }

    const confirm = prompt("Confirm (y/n): ")?.toLowerCase();
    if (confirm !== "y" && confirm !== "yes") {
      return "Operation denied. Try a different input or tool.";
    }

    writeFileSync(file, content.replace(target, replacement), {
      encoding: "utf-8",
    });
  },
  write: ({ file, contents }: { file: string; contents: string }) => {
    const confirm = prompt("Confirm (y/n): ")?.toLowerCase();
    if (confirm !== "y" && confirm !== "yes") {
      return "Operation denied. Try a different input or tool.";
    }
    const lines = contents.split("\n");
    console.log(
      `WRITE:\n${lines.slice(0, 10).join("\n")}\n${lines.length > 10 ? "..." : ""}\n`,
    );

    writeFileSync(file, contents, { encoding: "utf-8" });
  },
  bash: ({ command }: { command: string }) => {
    const confirm = prompt("Confirm (y/n): ")?.toLowerCase();
    if (confirm !== "y" && confirm !== "yes") {
      return "Operation denied. Try a different input or tool.";
    }

    console.log(`EXECUTE: ${command}\n`);
    try {
      const proc = spawnSync(command.split(" "));
      if (proc.exitCode === 0) {
        console.log(proc.stdout.toString());
        return proc.stdout.toString();
      } else {
        console.log(`Error: status ${proc.exitCode}`);
        console.log(proc.stdout.toString());
        console.log(proc.stderr.toString());
        return proc.stderr.toString();
      }
    } catch (e) {
      console.log(e);
      console.log(JSON.stringify(e));
    }
  },
};

const MODEL = "qwen3:32b";

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
    tools,
    think: true,
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
