import * as components from "./components.js";
import ws from "./ws.js";
/** @typedef { import("../../agent").AgentEvent} AgentEvent */

/** @type {import("./types.js").HistoryElement} */
let currentElement;

ws.onmessage =
  /** @param {MessageEvent<AgentEvent>} message */
  (message) => {
    const event = message.data;
    console.log(event);
    switch (event.type) {
      case "ttft_start":
        currentElement = components.createTimer();
        break;
      case "ttft_end":
        if (currentElement.type !== "timer") {
          throw new Error(`Expected timer but got ${currentElement.type}`);
        }

        currentElement.stop();
        break;
      case "context_used":
        break;
      case "thinking_chunk":
        break;
      case "response_chunk":
        break;
      case "tool_start":
        break;
      case "tool_error":
        break;
      case "done":
        break;
    }
  };
