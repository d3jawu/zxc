import chalk, { type ChalkInstance } from "chalk";
import ansi from "ansi-escape-sequences";

export const showError = (message: string) => {
  console.log(`${chalk.white.bgRed("ERROR")} ${message}`);
};

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
      color = chalk.green;
    } else if (elapsed <= maxRunTime) {
      color = chalk.yellow;
    } else {
      color = chalk.red;
    }
    process.stdout.write(
      `${ansi.cursor.back(100)}${chalk.gray("Model running")} ${color(elapsed.toFixed(2) + "s")}`,
    );
  }, 75);
};

export const hideTimer = () => {
  if (elapsed > maxRunTime) {
    maxRunTime = elapsed;
  }
  runTimes.push(elapsed);
  process.stdout.write(ansi.style.reset);
  clearInterval(spinnerId);
};
