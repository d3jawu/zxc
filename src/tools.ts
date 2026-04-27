import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { spawnSync } from "bun";
import type { Tool } from "ollama";
import { showError } from "./util";
import chalk from "chalk";


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
      name: "replace",
      description:
        "Replace lines in a file with new text. Takes beginning and end line numbers (1-based, inclusive) and new text to replace those lines with.",
      parameters: {
        type: "object",
        required: ["file", "startLine", "endLine", "newText"],
        properties: {
          file: {
            type: "string",
            description: "Path to the file to modify.",
          },
          startLine: {
            type: "number",
            description: "Beginning line number (1-based, inclusive).",
          },
          endLine: {
            type: "number",
            description: "End line number (1-based, inclusive).",
          },
          newText: {
            type: "string",
            description: "New text to replace the specified lines with.",
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

export const implementations: Record<string, (args: any) => string> = {
  read: ({ file }: { file: string }) => {
    console.log(`READ: ${file}`);
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
      showError(`${file} does not exist, or is not a file.`);
      return `Error: "${file}" does not exist, or is not a file.`;
    }
    const contents = readFileSync(file, "utf-8");
    return contents;
  },
  list: ({ path }: { path?: string }) => {
    if (!path) {
      path = process.cwd();
    }
    console.log(`LIST: ${path}`);
    if (!statSync(path, { throwIfNoEntry: false })?.isDirectory()) {
      showError(`${path} does not exist, or is not a directory.`);
      return `Error: "${path}" does not exist, or is not a directory.`;
    }
    return readdirSync(path).join(",");
  },
  write: ({ file, contents }: { file: string; contents: string }) => {
    console.log(`WRITE: ${file}\n${contents}\n`);

    const reason = denyReason();
    if (reason !== null) {
      return `Error: Write operation denied by user because: ${reason}`;
    }

    writeFileSync(file, contents, { encoding: "utf-8" });
    return "Write succeeded.";
  },
  replace: ({
    file,
    startLine,
    endLine,
    newText,
  }: {
    file: string;
    startLine: number;
    endLine: number;
    newText: string;
  }) => {
    console.log(`REPLACE: ${file} lines ${startLine}-${endLine}`);

    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
      showError(`${file} does not exist, or is not a file.`);
      return `Error: "${file}" does not exist, or is not a file.`;
    }

    const contents = readFileSync(file, "utf-8");
    const lines = contents.split("\n");

    if (startLine < 1 || endLine < startLine || endLine > lines.length) {
      return `Error: Invalid line range. startLine: ${startLine}, endLine: ${endLine}, file has ${lines.length} lines.`;
    }

    const linesToReplace = lines.slice(startLine - 1, endLine);

    console.log("\n--- FROM: ---");
    linesToReplace.forEach((line, index) => {
      console.log(`${chalk.red(startLine + index)}: ${line}`);
    });
    console.log(chalk.green("\n--- TO: ---"));
    newText.split("\n").forEach((line, index) => {
      console.log(`${chalk.green(startLine + index)}: ${line}`);
    });

    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(endLine);
    const newLines = newText.split("\n");

    const updatedLines = [...before, ...newLines, ...after];
    const updatedContent = updatedLines.join("\n");

    const reason = denyReason();
    if (reason !== null) {
      return `Error: Replace operation denied by user because: ${reason}`;
    }

    writeFileSync(file, updatedContent, { encoding: "utf-8" });
    return "Replace succeeded.";
  },
  bash: ({ command }: { command: string }) => {
    console.log(`RUN: ${command}\n`);

    const reason = denyReason();
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
      console.log("\n" + chalk.gray(output));
      return output;
    } catch (e) {
      console.log(e);
      console.log(JSON.stringify(e));
      return `Bash operation failed: ${e}`;
    }
  },
};

// Reusable function to get confirmation or denial reason
function denyReason(): string | null {
  const input = prompt("Confirm (↵) or deny (give reason):");
  return input?.trim() || null;
}
