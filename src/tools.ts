import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { spawnSync } from "bun";
import type { Tool } from "ollama";
import chalk from "chalk";

import { confirm, on } from "./ui/ui";

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
        "Replace the first occurrence of a string in a file with another string. Use this for precise text replacement in files.",
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
            description:
              "The string to match and replace. Must match the source text exactly, including whitespace.",
          },
          replacement: {
            type: "string",
            description: "The string to replace the 'target' string with.",
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

export const implementations: Record<string, (args: any) => Promise<string>> = {
  read: async ({ file }: { file: string }) => {
    on({ type: "tool_event", text: `READ: ${file}` });
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
      // showError(`${file} does not exist, or is not a file.`);
      return `Error: "${file}" does not exist, or is not a file.`;
    }
    const contents = readFileSync(file, "utf-8");
    return contents;
  },
  list: async ({ path }: { path?: string }) => {
    if (!path) {
      path = process.cwd();
    }
    on({ type: "tool_event", text: `LIST: ${path}` });
    if (!statSync(path, { throwIfNoEntry: false })?.isDirectory()) {
      // showError(`${path} does not exist, or is not a directory.`);
      return `Error: "${path}" does not exist, or is not a directory.`;
    }
    return readdirSync(path).join(",");
  },
  edit: async ({
    file,
    target,
    replacement,
  }: {
    file: string;
    target: string;
    replacement: string;
  }) => {
    on({
      type: "tool_event",
      text: `EDIT: ${file}:\n...\n${target}\n...\n\nINTO:\n...\n${replacement}\n...\n`,
    });
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
      // showError(`${file} does not exist, or is not a file.`);
      return `Error: File "${file}" does not exist.`;
    }
    const content = readFileSync(file, "utf-8");

    if (target === replacement) {
      // showError(`Replacement text is the same as target text.`);
      return `Error: replacement text is unchanged from the target text. This edit will accomplish nothing.`;
    }

    if (!content.includes(target)) {
      // Attempt whitespace correction
      const correctedTarget = target.replaceAll(/^(  )* (?=\S)/gm, (match) =>
        match.slice(0, -1),
      );
      if (content.includes(correctedTarget)) {
        on({
          type: "tool_event",
          text: "Whitespace was corrected in target text.",
        });
        target = correctedTarget;
        on({
          type: "tool_event",
          text: `EDIT: ${file}:\n...\n${target}\n...\n\nINTO:\n...\n${replacement}\n...\n`,
        });
      } else {
        // showError(`Target text not found in ${file}.`);
        return `Error: match for target text not found. Target text must match exactly, including whitespace.`;
      }
    }

    target = target.trim();
    replacement = replacement.trim();

    const reason = await confirm();
    if (reason !== null) {
      return `Error: Edit operation denied by user because: ${reason}`;
    }

    writeFileSync(file, content.replace(target, replacement), {
      encoding: "utf-8",
    });
    return "Edit succeeded.";
  },
  write: async ({ file, contents }: { file: string; contents: string }) => {
    on({ type: "tool_event", text: `WRITE: ${file}\n${contents}\n` });

    const reason = await confirm();
    if (reason !== null) {
      return `Error: Write operation denied by user because: ${reason}`;
    }

    writeFileSync(file, contents, { encoding: "utf-8" });
    return "Write succeeded.";
  },
  bash: async ({ command }: { command: string }) => {
    on({ type: "tool_event", text: `RUN: ${command}\n` });

    const reason = await confirm();
    if (reason !== null) {
      return `Error: Bash operation denied by user because: ${reason}`;
    }

    try {
      const proc = spawnSync({
        cmd: ["bash", "-c", command],
      });
      let output = "";
      if (proc.exitCode === 0) {
        output = proc.stdout.toString();
      } else {
        output = proc.stderr.toString();
      }
      on({ type: "tool_event", text: "\n" + chalk.gray(output) });
      return output;
    } catch (e) {
      on({ type: "tool_event", text: String(e) });
      on({ type: "tool_event", text: JSON.stringify(e) });
      return `Bash operation failed: ${e}`;
    }
  },
};
