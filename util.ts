import chalk from "chalk";
export const showError = (message: string) => {
  console.log(`${chalk.red("error")}: ${message}`);
};
