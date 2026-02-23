import chalk from "chalk";
import ansi from "ansi-escape-sequences";

export const showError = (message: string) => {
  console.log(`${chalk.red("error")}: ${message}`);
};

let spinnerId: NodeJS.Timeout | undefined;
export const showTimer = () => {
  const startTime = Date.now();
  process.stdout.write(`\n${ansi.style.gray}Model running  `);
  spinnerId = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    process.stdout.write(
      `${ansi.cursor.back(100)}Model running ${elapsed.toFixed(2)}s`,
    );
  }, 75);
};

export const hideTimer = () => {
  process.stdout.write(`${ansi.style.reset}\n`);
  clearInterval(spinnerId);
};
