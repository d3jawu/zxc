import chalk from "chalk";
import ansi from "ansi-escape-sequences";

export const showError = (message: string) => {
  console.log(`${chalk.red("error")}: ${message}`);
};

let spinnerId: NodeJS.Timeout | undefined;
export const showSpinner = () => {
  let spinnerPosition = 0;
  const spinnerStates = ["/", "-", "\\", "|"];
  process.stdout.write(`\n${ansi.style.gray}Model running  `);
  spinnerId = setInterval(() => {
    process.stdout.write(
      `${ansi.cursor.back(1)}${spinnerStates[spinnerPosition]}`,
    );
    spinnerPosition = (spinnerPosition + 1) % spinnerStates.length;
  }, 100);
};

export const hideSpinner = () => {
  process.stdout.write(`${ansi.erase.inLine(1)}${ansi.style.reset}`);
  clearInterval(spinnerId);
};
