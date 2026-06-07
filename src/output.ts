let lastOutputEndedWithNewline = true;

export function write(text: string): void {
  process.stdout.write(text);
  lastOutputEndedWithNewline = text.endsWith("\n");
}

export function log(text: string): void {
  write(`${text}\n`);
}

export function section(text: string): void {
  if (!lastOutputEndedWithNewline) {
    write("\n");
  }
  write(`\n${text}\n`);
}
