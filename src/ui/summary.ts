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

const summary = () =>
  `${ansi.cursor.back(1000)}${colors.yellow("model(")}${colors.gray("thinking")}${colors.yellow(")")}: ` +
  `${((Date.now() - startTime) / 1000).toFixed(2)}s` +
  (counts.token ? `, ${counts.token} token(s)` : "") +
  (counts.read ? `, read ${counts.read} file(s)` : "") +
  (counts.list ? `, list ${counts.list} dir(s)` : "");

export default {
  start: () => {
    write(ansi.cursor.hide);
    section();
    startTime = Date.now();
    interval = setInterval(() => {
      write(summary());
    }, 50);
  },
  end: () => {
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
