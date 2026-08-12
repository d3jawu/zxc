import config from "./config";
import { getHistory } from "./history";
import tools from "./tools";

const ollama = new (await import("ollama")).Ollama({
  host: process.env.OLLAMA_API_BASE,
});

export async function listModels(): Promise<string[]> {
  return (await ollama.list()).models.map((model) => model.name);
}

export async function chat() {
  return ollama.chat({
    model: config.model,
    stream: true,
    messages: getHistory(),
    tools: Object.values(tools).map((t) => ({
      type: t.type,
      function: t.function,
    })),
    think: true,
    keep_alive: "20m",
  });
}

export async function ps() {
  return ollama.ps();
}
