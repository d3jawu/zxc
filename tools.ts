import { readFileSync, readdirSync, writeFileSync } from "fs";
import { spawnSync } from "bun";
import type { Tool } from "ollama";

export const definitions: Tool[] = [
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

export const tools: Record<string, (args: any) => string> = {
  read: ({ file }: { file: string }) => {
    const contents = readFileSync(file, "utf-8");
    return contents;
  },
  list: ({ path }: { path?: string }) => {
    if (!path) {
      path = process.cwd();
    }

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
      console.log("Error: Target string not found.");
      return "String to replace was not found. Ensure target matches exactly.";
    }

    const reason = denyReason();
    if (reason !== null) {
      return `Edit operation denied. Reason: ${reason}`;
    }

    writeFileSync(file, content.replace(target, replacement), {
      encoding: "utf-8",
    });
    return "Edit succeeded.";
  },
  write: ({ file, contents }: { file: string; contents: string }) => {
    const lines = contents.split("\n");

    console.log(`WRITE:\n${lines}\n...\n`);

    const reason = denyReason();
    if (reason !== null) {
      return `Write operation denied. Reason: ${reason}`;
    }

    writeFileSync(file, contents, { encoding: "utf-8" });
    return "Write succeeded.";
  },
  bash: ({ command }: { command: string }) => {
    console.log(`RUN: ${command}\n`);

    const reason = denyReason();
    if (reason !== null) {
      return `Bash operation denied. Reason: ${reason}`;
    }

    try {
      const proc = spawnSync(command.split(" "));
      if (proc.exitCode === 0) {
        return proc.stdout.toString();
      } else {
        return proc.stderr.toString();
      }
    } catch (e) {
      console.log(e);
      console.log(JSON.stringify(e));
      return `Bash operation failed: ${e}`;
    }
  },
};

// Reusable function to get confirmation or denial reason
function denyReason(): string | null {
  const input = prompt(
    "Press Enter to confirm, or provide a reason for denial: ",
  );
  return input?.trim() || null;
}
