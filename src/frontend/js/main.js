import * as components from "./components.js";
/** @typedef { import("../../agent").AgentEvent} AgentEvent */

ws.onmessage =
  /** @param {MessageEvent<AgentEvent>} event */
  function (event) {
    const div = document.createElement("div");
    div.textContent = JSON.stringify(event.data);
    document.body.appendChild(div);
  };
