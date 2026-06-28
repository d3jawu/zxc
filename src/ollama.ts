export default new (await import("ollama")).Ollama({
  host: process.env.OLLAMA_API_BASE,
});
