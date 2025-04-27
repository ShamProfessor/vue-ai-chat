import { fetchEventSource } from "@microsoft/fetch-event-source";

// Fetch模式的流式处理
export const handleFetchStream = async (
  reader, // 直接接收reader而不是response
  messageCallback,
  onComplete,
  currentModel
) => {
  const decoder = new TextDecoder();
  let isInReasoning = false;
  const isR1 = currentModel === "deepseek-ai/DeepSeek-R1";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const reasoningContent =
              parsed.choices[0]?.delta?.reasoning_content;
            const normalContent = parsed.choices[0]?.delta?.content;

            if (reasoningContent && isR1) {
              // 检测是否在推理过程中
              isInReasoning = true;
              messageCallback(reasoningContent);
            } else if (normalContent) {
              // 如果之前在推理过程中，现在收到普通内容，说明推理结束
              if (isInReasoning && isR1) {
                messageCallback("\n\n---思考结束---\n\n");
                isInReasoning = false;
              }
              messageCallback(normalContent);
            }
          } catch (e) {
            console.error("解析响应数据失败:", e);
          }
        }
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Stream was stopped by user");
    } else {
      console.error("Stream error:", error);
    }
  } finally {
    onComplete && onComplete();
  }
};

// SSE模式的流式处理
export const handleSSEStream = (
  userMessage,
  currentModel,
  messageCallback,
  onComplete
) => {
  const ctrl = new AbortController();
  let isInReasoning = false;
  const isR1 = currentModel === "deepseek-ai/DeepSeek-R1";

  try {
    fetchEventSource("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: import.meta.env.VITE_API_KEY,
      },
      body: JSON.stringify({
        model: currentModel,
        messages: [{ role: "user", content: userMessage }],
        stream: true,
      }),
      signal: ctrl.signal,

      onmessage(event) {
        if (event.data === "[DONE]") {
          ctrl.abort();
          onComplete && onComplete();
          return;
        }

        try {
          const parsed = JSON.parse(event.data);
          const reasoningContent = parsed.choices[0]?.delta?.reasoning_content;
          const normalContent = parsed.choices[0]?.delta?.content;

          if (reasoningContent && isR1) {
            isInReasoning = true;
            messageCallback(reasoningContent);
          } else if (normalContent) {
            if (isInReasoning && isR1) {
              messageCallback("\n\n---思考结束---\n\n");
              isInReasoning = false;
            }
            messageCallback(normalContent);
          }
        } catch (err) {
          console.error("JSON 解析失败:", err);
        }
      },

      onclose() {
        console.log("连接已关闭");
        onComplete && onComplete();
      },

      onerror(err) {
        console.error("SSE 连接异常:", err);
        ctrl.abort();
        onComplete && onComplete();
      },
    });
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Stream was stopped by user");
    } else {
      console.error("连接错误:", err);
    }
    onComplete && onComplete();
  }
  return ctrl; // 返回 AbortController 实例
};

export const createStreamRequest = async (userMessage, currentModel) => {
  return fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: import.meta.env.VITE_API_KEY,
    },
    body: JSON.stringify({
      model: currentModel,
      messages: [{ role: "user", content: userMessage }],
      stream: true,
    }),
  });
};
