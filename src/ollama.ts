const ollama = new (await import("ollama")).Ollama({
  host: process.env.OLLAMA_API_BASE,
});

export async function listModels(): Promise<string[]> {
  return (await ollama.list()).models.map((model) => model.name);
}

export default ollama;
