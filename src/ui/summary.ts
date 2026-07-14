import type { ChalkInstance } from "chalk";
import { section, write } from "./output";
import colors from "./colors";

import ansi from "ansi-escape-sequences";

let counts = {
  read: 0,
  list: 0,
  token: 0,
};

let interval: NodeJS.Timeout;
let startTime = Date.now();
const runTimes: number[] = [];
let maxRunTime = 0;

const summary = () => {
  const elapsed = (Date.now() - startTime) / 1000;
  const averageRunTime =
    runTimes.reduce((val, sum) => val + sum, 0) / runTimes.length;
  let color: ChalkInstance;
  if (elapsed <= averageRunTime) {
    color = colors.green;
  } else if (elapsed <= maxRunTime) {
    color = colors.yellow;
  } else {
    color = colors.red;
  }

  return (
    `${ansi.cursor.back(1000)}${colors.purple("model(")}${colors.gray("thinking")}${colors.purple(")")}: ` +
    `${color(elapsed.toFixed(0))}${colors.gray("s")}` +
    (counts.token
      ? `${colors.gray(",")} ${counts.token} ${colors.gray(`tokens`)}`
      : "") +
    (counts.read
      ? `${colors.gray(",")} ${colors.pink("read")} ${counts.read} ${colors.gray("file(s)")}`
      : "") +
    (counts.list
      ? `${colors.gray(",")} ${colors.pink("list")} ${counts.list} ${colors.gray("dir(s)")}`
      : "")
  );
};

export default {
  start: () => {
    section();
    write("\n");
    write(ansi.cursor.hide);
    startTime = Date.now();
    interval = setInterval(() => {
      write(summary());
    }, 50);
  },
  end: () => {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > maxRunTime) {
      maxRunTime = elapsed;
    }
    runTimes.push(elapsed);
    write(ansi.cursor.show);
    clearInterval(interval);
    counts = {
      read: 0,
      list: 0,
      token: 0,
    };
  },
  add: (key: keyof typeof counts) => {
    counts[key] += 1;
  },
};
