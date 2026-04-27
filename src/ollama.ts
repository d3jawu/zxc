import { Ollama } from "ollama";

const ollama = new Ollama({
  host: process.env["OLLAMA_API_BASE"] || undefined,
});

export default ollama;
