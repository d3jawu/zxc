import { spawnSync } from "child_process";

const glowAvailable =
  spawnSync("glow", ["--version"], { encoding: "utf-8" }).status === 0;
if (!glowAvailable) {
  console.error(
    "Warning: 'glow' is not installed. Rich previews will be unavailable.",
  );
}

const glow = glowAvailable
  ? (input: string) => {
      spawnSync(
        "glow",
        ["-s", "dracula", "-w", process.stdout.columns.toString()],
        {
          input,
          encoding: "utf-8",
          stdio: "inherit",
        },
      );
    }
  : undefined;

export default glow;
