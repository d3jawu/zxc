import ollama from "./ollama";
import chalk, { type ChalkInstance } from "chalk";
import ansi from "ansi-escape-sequences";
import { userInfo } from "os";
import readline from "readline/promises";
import type { AgentEvent } from "./agent";
import { modelRef } from "./index";
import { clearHistory, getHistory } from "./history";
import glow from "./glow";
import { write, log, section } from "./output";

let spinnerId: NodeJS.Timeout | undefined;
const runTimes: number[] = [];
let maxRunTime = 0;
let elapsed = 0;

const green = chalk.hex("#50fa7b");
const yellow = chalk.hex("#f1fa8c");
const red = chalk.hex("#ff5555");
const purple = chalk.hex("#bd93f9");

const showTimer = () => {
  const startTime = Date.now();
  const averageRunTime =
    runTimes.reduce((val, sum) => val + sum, 0) / runTimes.length;
  spinnerId = setInterval(() => {
    elapsed = (Date.now() - startTime) / 1000;
    let color: ChalkInstance;
    if (elapsed <= averageRunTime) {
      color = green;
    } else if (elapsed <= maxRunTime) {
      color = yellow;
    } else {
      color = red;
    }
    write(
      `${ansi.cursor.back(1000)}${chalk.gray("Model running")} ${color(elapsed.toFixed(2) + "s")}`,
    );
  }, 75);
};

const hideTimer = () => {
  if (elapsed > maxRunTime) {
    maxRunTime = elapsed;
  }
  runTimes.push(elapsed);
  write(ansi.style.reset + "\n");
  clearInterval(spinnerId);
};

let contextUsed = 0;

let quietMode = true;
let quietBuffer: string = "";
let quietTokenCount = 0;

export async function prompt(): Promise<string | null> {
  write("\n\n");
  let contextLength: number | undefined;
  const ps = await ollama.ps();
  const foundModel = ps.models.find(({ model: m }) => m === modelRef.current);
  if (
    foundModel &&
    "context_length" in foundModel &&
    typeof foundModel.context_length === "number"
  ) {
    contextLength = foundModel.context_length;
  }
  const contextString = !contextLength
    ? "--"
    : (parseFloat((contextUsed / contextLength).toFixed(3)) * 100).toFixed(1) +
      "%, " +
      (contextUsed / 1000).toFixed(1) +
      "k";

  while (true) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on("SIGINT", () => {
      clearHistory();
      process.exit(0);
    });

    const line = await rl.question(
      `${purple(userInfo().username + "(")}${chalk.gray(contextString)}${purple(")")}: `,
    );
    rl.close();

    if (line && line.startsWith("/")) {
      const [command, ...args] = line.split(" ");
      if (command === "/model") {
        const models = (await ollama.list()).models.map((model) => model.name);
        if (args.length === 0) {
          log("Available models:");
          log(models.join("\n"));
        } else {
          const newModel = args[0] as string;
          if (!models.includes(newModel)) {
            log(`Model not found: ${newModel}`);
          } else {
            log(`Model set to ${newModel}.`);
            modelRef.current = newModel;
          }
        }
      } else if (command === "/md") {
        if (!glow) {
          log("'glow' is unavailable, cannot display MarkDown.");
          continue;
        }
        const history = getHistory();
        const lastMessage = history[history.length - 1];
        if (!lastMessage) {
          log("Nothing to show.");
          continue;
        }
        glow(lastMessage.content);
      } else if (command === "/quiet") {
        quietMode = !quietMode;
        log(`Quiet mode ${quietMode ? "enabled" : "disabled"}.`);
      } else {
        log(`Invalid command: ${command}`);
      }
      continue;
    }
    write(""); // Tell output it needs a newline
    return line;
  }
}

let mode: "thinking" | "response" | "tool" | "prompt" | undefined;

export function on(event: AgentEvent) {
  switch (event.type) {
    case "ttft_start":
      write("\n");
      showTimer();
      break;
    case "ttft_end":
      hideTimer();
      break;
    case "context_used":
      contextUsed = event.count;
      break;
    case "thinking_chunk": {
      const prelude = `${yellow("model(")}${chalk.gray("thinking")}${yellow(")")}: `;
      if (mode !== "thinking") {
        section();
        write(prelude);
        quietBuffer = "";
        mode = "thinking";
      }

      if (quietMode) {
        write(
          `${ansi.cursor.back(1000)}${prelude}${chalk.gray(`${quietTokenCount} tokens`)}`,
        );

        quietTokenCount += 1;
        quietBuffer += event.text;
      } else {
        write(chalk.gray(event.text));
      }
      break;
    }
    case "response_chunk": {
      const prelude = `${yellow("model(")}${chalk.gray("response")}${yellow(")")}: `;
      if (mode !== "response") {
        section();
        write(prelude);
        quietBuffer = "";
        mode = "response";
      }

      if (quietMode) {
        write(
          `${ansi.cursor.back(1000)}${prelude}${chalk.gray(`${quietTokenCount} tokens`)}`,
        );

        quietTokenCount += 1;
        quietBuffer += event.text;
      } else {
        write(event.text);
      }
      break;
    }
    case "tool_start":
      section();
      write(`${green("tool(")}${chalk.gray(event.name)}${green(")")}: `);
      mode = "tool";
      break;
    case "tool_error":
      log(`${chalk.white.bgRed("ERROR")} ${event.message}`);
      break;
    case "done":
      if (quietMode) {
        if (mode === "response") {
          if (glow) {
            section();
            glow(quietBuffer);
          } else {
            write(quietBuffer);
          }
        }

        quietBuffer = "";
        quietTokenCount = 0;
      }
      mode = "prompt";
      break;
  }
}
