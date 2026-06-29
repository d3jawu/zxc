import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from "fs";
import { spawnSync } from "bun";
import type { Tool } from "ollama";
import chalk from "chalk";
import glow from "./ui/glow";
import { log } from "./ui/output";

export type ToolName = "read" | "list" | "edit" | "write" | "bash";

export type ToolSet = Record<ToolName, ToolWithImplementation>;

export type ReadArgs = { file: string };
export type ListArgs = { path?: string };
export type EditArgs = { file: string; target: string; replacement: string };
export type WriteArgs = { file: string; contents: string };
export type BashArgs = { command: string };

export type ToolWithImplementation<T = any> = Tool & {
  run: (args: T) => string | Promise<string>;
};

function denyReason(): string | null {
  const input = prompt("Confirm (↵) or deny (give reason):");
  return input?.trim() || null;
}

const requirePath = (path: string, type: "file" | "directory") => {
  const stat = statSync(path, { throwIfNoEntry: false });
  const check = type === "file" ? stat?.isFile() : stat?.isDirectory();
  if (!check) {
    log(
      `${chalk.white.bgRed("ERROR")} ${path} does not exist, or is not a ${type}.`,
    );
    return `Error: "${path}" does not exist, or is not a ${type}.`;
  }
};

export const tools: ToolSet = {
  read: {
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
    run: ({ file }: ReadArgs) => {
      log(`READ: ${file}`);
      const err = requirePath(file, "file");
      if (err) return err;
      return readFileSync(file, "utf-8");
    },
  },
  list: {
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
    run: ({ path }: ListArgs) => {
      const resolvedPath = path ?? process.cwd();
      log(`LIST: ${resolvedPath}`);
      const err = requirePath(resolvedPath, "directory");
      if (err) return err;
      return readdirSync(resolvedPath).join("\n");
    },
  },
  edit: {
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
    run: ({ file, target: targetText, replacement }: EditArgs) => {
      log(`EDIT: ${file}`);
      const err = requirePath(file, "file");
      if (err) return err;

      const originalContent = readFileSync(file, "utf-8");

      if (targetText === replacement) {
        log(
          `${chalk.white.bgRed("ERROR")} Replacement text is the same as target text.`,
        );
        return `Error: replacement text is unchanged from the target text. This edit will accomplish nothing.`;
      }

      let target = targetText;
      if (!originalContent.includes(target)) {
        // Attempt whitespace correction
        const correctedTarget = target
          .trim()
          .replaceAll(/^(   )* (?=\S)/gm, (match: string) =>
            match.slice(0, -1),
          );
        if (originalContent.includes(correctedTarget)) {
          log("Whitespace was corrected in target text.");
          target = correctedTarget;
        } else {
          const ext = file.split(".").at(-1);
          log(`FROM`);
          glow(`${"```"}${ext}\n${targetText}`);
          log(`INTO`);
          glow(`${"```"}${ext}\n${replacement}`);
          log(
            "Failed to match target text. Perform edit by hand then hit enter, or deny with reason:",
          );
          const reason = denyReason();
          if (reason !== null) {
            return `Error: Edit operation denied by user because: ${reason}`;
          }
          return "Edit succeeded.";
        }
      }

      writeFileSync(file, originalContent.replace(target, replacement), {
        encoding: "utf-8",
      });

      const reason = denyReason();
      if (reason !== null) {
        writeFileSync(file, originalContent, { encoding: "utf-8" });
        return `Error: Edit operation denied by user because: ${reason}`;
      }

      return "Edit succeeded.";
    },
  },
  write: {
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
    run: ({ file, contents }: WriteArgs) => {
      const originalContent = statSync(file, {
        throwIfNoEntry: false,
      })?.isFile()
        ? readFileSync(file, "utf-8")
        : null;

      writeFileSync(file, contents, { encoding: "utf-8" });

      const reason = denyReason();
      if (reason !== null) {
        if (originalContent !== null) {
          writeFileSync(file, originalContent, { encoding: "utf-8" });
        } else {
          unlinkSync(file);
        }
        return `Error: Write operation denied by user because: ${reason}`;
      }

      return "Write succeeded.";
    },
  },
  bash: {
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
    run: ({ command }: BashArgs) => {
      log(`RUN: ${command}`);

      const reason = denyReason();
      if (reason !== null) {
        return `Error: Bash operation denied by user because: ${reason}`;
      }

      try {
        const proc = spawnSync({
          cmd: ["bash", "-c", command],
        });
        const output = proc.stdout.toString();
        const error = proc.stderr.toString();
        const exitCode = proc.exitCode ?? -1;

        if (exitCode === 0) {
          log(chalk.gray(output));
          return output;
        }

        log(chalk.gray(error || output));
        return `Error: Command failed with exit code ${exitCode}.\n${error || output}`;
      } catch (e) {
        log(String(e));
        log(JSON.stringify(e));
        return `Error: Bash operation failed: ${e}`;
      }
    },
  },
};
