let needsNewline = false;

export function write(text: string): void {
  process.stdout.write(text);
  needsNewline = !text.endsWith("\n");
}

export function log(text: string): void {
  write(`${text}\n`);
}

export function section(): void {
  if (needsNewline) {
    write("\n");
  }
  write("\n");
}
