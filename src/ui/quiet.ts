let quietMode: boolean = true;

let quietBuffer: string = "";
let quietTokenCount = 0;

export default {
  get enabled() {
    return quietMode;
  },
  set enabled(val: boolean) {
    quietMode = val;
  },
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
    quietTokenCount += 1;
  },
};
