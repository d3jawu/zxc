# zxc 🚲

自行车 (zì xíng chē) is a simple CLI agent intended for local models. Like a bicycle, it can help you get where you're going faster, but you still have to pedal and steer.

# Usage

You must have a running server that exposes an OpenAI-compatible Chat Completions API (e.g. [`llama-server`](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)) and [Glow](https://github.com/charmbracelet/glow) installed.

The server base URL defaults to `http://localhost:8000` and can be set via the `LLAMA_BASE_URL` environment variable or the `baseUrl` field in `~/.zxc/zxc.json`. The model defaults to the first model returned by the server's `/v1/models` endpoint.

Install dependencies:

```bash
bun install
```

Run:

```bash
bun run start
```
