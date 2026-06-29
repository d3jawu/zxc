let quietTokenCount = 0;

export default {
  get count(): number {
    return quietTokenCount;
  },
  reset() {
    quietTokenCount = 0;
  },
  add(text: string) {
    quietTokenCount++;
  },
};
