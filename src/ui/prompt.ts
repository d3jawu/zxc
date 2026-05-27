let resolver: (value: string | PromiseLike<string>) => void = () => {};

let promptPromise = new Promise<string>((resolve) => {
  resolver = resolve;
});

export const getPromise = () => promptPromise;

export const resolve = (value: string | PromiseLike<string>) => {
  resolver(value);
  promptPromise = new Promise<string>((resolve) => {
    resolver = resolve;
  });
};
