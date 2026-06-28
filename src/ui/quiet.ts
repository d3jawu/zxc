let quietBuffer: string = "";
let quietTokenCount = 0;

export default {
  enabled: true,
  get count(): number {
    return quietTokenCount;
  },
  get buffer(): string {
    return quietBuffer;
  },
  reset() {
    quietBuffer = "";
    quietTokenCount = 0;
  },
  add(text: string) {
    quietBuffer += text;
    quietTokenCount++;
  },
};
