import { createCliRenderer } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
});

renderer.keyInput.on("keypress", (key: KeyEvent) => {
  if (key.ctrl && key.name === "c") {
    renderer.destroy();
    process.exit(0);
  }
});

export default renderer;
