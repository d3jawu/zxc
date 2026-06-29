import { spawnSync } from "child_process";

// Check glow availability once on startup and exit if missing
if (spawnSync("glow", ["--version"], { encoding: "utf-8" }).status !== 0) {
  console.error(
    "Error: 'glow' is required. Install it here: https://github.com/charmbracelet/glow",
  );
  process.exit(1);
}

export default (input: string) => {
  spawnSync(
    "glow",
    ["-s", "dracula", "-w", process.stdout.columns.toString()],
    { input, encoding: "utf-8", stdio: "inherit" },
  );
};
