let needsNewline = false;

export const write = (text: string): void => {
  process.stdout.write(text);
  needsNewline = !text.endsWith("\n");
}

export const reset = (state: boolean): void => {
  needsNewline = state;
}

export const log = (text: string): void => {
  write(`${text}\n`);
}

export const section = (): void => {
  if (needsNewline) {
    write("\n");
  }
}
