import { ref } from "vue";
import { fetchEventSource } from "@microsoft/fetch-event-source";

// Fetch模式的流式处理
export const handleFetchStream = async (
  reader, // 直接接收reader而不是response
  messageCallback,
  onComplete
) => {
  const decoder = new TextDecoder();

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
            const content = parsed.choices[0]?.delta?.content || "";
            messageCallback(content);
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
export const handleSSEStream = (userMessage, messageCallback, onComplete) => {
  const ctrl = new AbortController();

  try {
    fetchEventSource("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Bearer sk-wxotwmmzaakvqbgllpjjvcwrpeuoihihmmqrrtiqnatoumbg",
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
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
          const content = parsed.choices[0]?.delta?.content || "";
          if (content) {
            console.log("sse content: ");
            messageCallback(content);
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

export const createStreamRequest = async (userMessage) => {
  return fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer sk-wxotwmmzaakvqbgllpjjvcwrpeuoihihmmqrrtiqnatoumbg",
    },
    body: JSON.stringify({
      model: "deepseek-ai/DeepSeek-V3",
      messages: [{ role: "user", content: userMessage }],
      stream: true,
    }),
  });
};
