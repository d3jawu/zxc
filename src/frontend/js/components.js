import ws from "./ws.js";

const $history = document.getElementById("history");
if (!$history) {
  throw new Error("Missing required element: history");
}

export const createPrompt = () => {
  const $prompt = document.createElement("div");
  $prompt.className = "history-prompt";

  const $input = document.createElement("input");

  $input.onsubmit = () => {
    const $p = document.createElement("p");
    $p.innerText = $input.value;

    $input.remove();
    $prompt.appendChild($p);
  };

  $prompt.appendChild($input);
  $input.focus();

  return { type: /** @type {const} */ ("prompt") };
};

export const createTimer =
  /**
   * @returns {import("./types").Timer}
   */
  () => {
    const $timer = document.createElement("div");
    $timer.className = "history-timer";

    const $timerContent = document.createElement("span");
    $timerContent.className = "history-timer-content";

    let startTime = Date.now();
    let stopped = false;
    const interval = setInterval(() => {
      if (stopped) return;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      $timerContent.textContent = `${elapsed}s`;
    }, 1000);

    $timer.appendChild($timerContent);
    $history.appendChild($timer);

    return {
      type: "timer",
      stop: () => {
        stopped = true;
        clearInterval(interval);
      },
    };
  };

export const createToolUse =
  /**
   * @param {import("./types").Tool} tool
   * @returns {import("./types").ToolUse}
   */
  (tool) => {
    const $toolUse = document.createElement("div");
    $toolUse.className = "history-tool";

    const $toolLabel = document.createElement("span");
    $toolLabel.className = "history-tool-label";
    $toolLabel.textContent = tool.name;

    const $toolMeta = document.createElement("span");
    $toolMeta.className = "history-tool-meta";

    const $toolDetails = document.createElement("p");
    $toolDetails.className = "history-tool-details";

    switch (tool.name) {
      case "edit":
        $toolMeta.textContent = tool.file;
        $toolDetails.textContent = `FROM:\n${tool.target}\nINTO:\n${tool.replacement}`;
        break;
      case "list":
        $toolMeta.textContent = tool.path;
        break;
      case "read":
        $toolMeta.textContent = tool.file;
        break;
      case "write":
        $toolMeta.textContent = tool.file;
        $toolDetails.textContent = tool.contents;
        break;
    }

    $toolUse.appendChild($toolLabel);
    $toolUse.appendChild($toolMeta);
    $toolUse.appendChild($toolDetails);

    $history.appendChild($toolUse);

    return {
      type: "tool",
      response: (response) => {
        const $toolResponse = document.createElement("p");
        $toolResponse.className = "history-tool-response";

        switch (response.type) {
          case "success":
            $toolResponse.textContent = "SUCCESS";
            break;
          case "error":
            $toolResponse.textContent = `ERROR: ${response.message}`;
            break;
          case "file":
            $toolResponse.textContent = response.contents;
            break;
          case "text":
            $toolResponse.textContent = response.contents;
            break;
        }

        $toolUse.appendChild($toolResponse);
      },
    };
  };

export const createThinking =
  /**
   * @returns {import("./types").Thinking }
   */
  () => {
    const $thinking = document.createElement("div");
    $thinking.className = "history-thinking";

    const $thinkingContent = document.createElement("p");
    $thinkingContent.className = "history-thinking-content";

    $history.appendChild($thinking);

    return {
      type: "thinking",
      append: (text) => {
        $thinkingContent.textContent += text;
      },
    };
  };

export const createResponse =
  /**
   * @returns {import("./types").Response }
   */
  () => {
    const $response = document.createElement("div");
    $response.className = "history-response";

    const $responseContent = document.createElement("p");
    $responseContent.className = "history-response-content";

    $history.appendChild($response);

    return {
      type: "response",
      append: (text) => {
        $responseContent.textContent += text;
      },
    };
  };
