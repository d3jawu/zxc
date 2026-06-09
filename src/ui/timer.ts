import type { ChalkInstance } from "chalk";
import ansi from "ansi-escape-sequences";
import colors from "./colors";
import { write } from "./output";

let spinnerId: NodeJS.Timeout | undefined;
const runTimes: number[] = [];
let maxRunTime = 0;
let elapsed = 0;

export const showTimer = () => {
  const startTime = Date.now();
  const averageRunTime =
    runTimes.reduce((val, sum) => val + sum, 0) / runTimes.length;
  spinnerId = setInterval(() => {
    elapsed = (Date.now() - startTime) / 1000;
    let color: ChalkInstance;
    if (elapsed <= averageRunTime) {
      color = colors.green;
    } else if (elapsed <= maxRunTime) {
      color = colors.yellow;
    } else {
      color = colors.red;
    }
    write(
      `${ansi.cursor.back(1000)}${colors.gray("Model running")} ${color(elapsed.toFixed(2) + "s")}`,
    );
  }, 50);
};

export const hideTimer = () => {
  if (elapsed > maxRunTime) {
    maxRunTime = elapsed;
  }
  runTimes.push(elapsed);
  write(ansi.style.reset + "\n");
  clearInterval(spinnerId);
};
