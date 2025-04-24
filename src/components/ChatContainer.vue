<template>
  <div class="chat-container">
    <div class="messages-wrapper">
      <div class="messages" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="['message', message.role]"
        >
          <div class="message-content" v-if="message.role === 'user'">
            {{ message.content }}
          </div>
          <div
            class="message-content markdown-body"
            v-else
            v-html="renderMarkdown(message.content)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onUnmounted, defineProps, defineEmits } from "vue";
import MarkdownIt from "markdown-it";
import {
  handleFetchStream,
  handleSSEStream,
  createStreamRequest,
} from "../utils/streamHandlers";

const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: (value) => ["fetch", "sse"].includes(value),
  },
});

const emit = defineEmits(["update:isStreaming"]);

const md = new MarkdownIt({
  breaks: true,
  linkify: true,
});

const renderMarkdown = (content) => {
  return md.render(content);
};

const messages = ref([]);
const messagesContainer = ref(null);
const currentRequest = ref(null);
const reader = ref(null);

// 优化方案
const buffer = ref("");
const renderScheduled = ref(false);

// 滚动部分优化
const throttle = (fn, delay) => {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      fn.apply(this, args);
      lastCall = now;
    }
  };
};

/* 滚动在body容器上 */
const isNearBottom = () => {
  const threshold = 100; // 阈值，表示距离底部多少像素内认为是在底部
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  const scrollTop = Math.max(
    document.documentElement.scrollTop,
    document.body.scrollTop
  );
  const clientHeight = document.documentElement.clientHeight;

  return scrollHeight - scrollTop - clientHeight < threshold;
};

const scrollToBottom = async () => {
  await nextTick();
  const messagesEl = messagesContainer.value;
  if (messagesEl && isNearBottom()) {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  }
};

const throttledScrollToBottom = throttle(scrollToBottom, 100);

const scheduleRender = (aiMessageIndex) => {
  if (!renderScheduled.value) {
    requestAnimationFrame(() => {
      if (buffer.value) {
        messages.value[aiMessageIndex].content += buffer.value;
        buffer.value = "";
        throttledScrollToBottom();
      }
      renderScheduled.value = false;
    });
    renderScheduled.value = true;
  }
};

const sendMessage = async (userMessage) => {
  emit("update:isStreaming", true);

  // 添加用户消息
  messages.value.push({
    role: "user",
    content: userMessage,
  });

  await scrollToBottom();

  // 添加AI回复消息占位
  const aiMessageIndex = messages.value.length;
  messages.value.push({
    role: "assistant",
    content: "",
  });

  try {
    if (props.mode === "fetch") {
      const response = await createStreamRequest(userMessage);
      currentRequest.value = response;
      reader.value = response.body.getReader();

      await handleFetchStream(
        reader.value, // 传入reader而不是response
        (content) => {
          // messages.value[aiMessageIndex].content += content;
          // scrollToBottom();
          buffer.value += content;
          scheduleRender(aiMessageIndex);
        },
        () => {
          currentRequest.value = null;
          reader.value = null;
        }
      );
    } else {
      // SSE模式
      const eventSource = handleSSEStream(
        userMessage,
        (content) => {
          emit("update:isStreaming", true);
          // messages.value[aiMessageIndex].content += content;
          // scrollToBottom();

          buffer.value += content;
          scheduleRender(aiMessageIndex);
        },
        () => {
          currentRequest.value = null;
        }
      );
      currentRequest.value = eventSource;
    }
  } catch (error) {
    console.error("Stream error:", error);
    reader.value = null;
  }
};

const stopStream = () => {
  if (currentRequest.value) {
    if (props.mode === "fetch" && reader.value) {
      reader.value.cancel();
      reader.value = null;
    } else if (props.mode === "sse") {
      currentRequest.value.abort();
    }
    currentRequest.value = null;
    emit("update:isStreaming", false);
  }
};

onUnmounted(() => {
  if (reader.value) {
    reader.value.cancel();
    reader.value = null;
  }
  if (currentRequest.value && props.mode === "sse") {
    currentRequest.value.abort();
    currentRequest.value = null;
  }
});

defineExpose({
  sendMessage,
  stopStream,
});
</script>

<style scoped>
.chat-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.messages-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f5f5;
}

.messages {
  width: 100%;
}

.message {
  margin-bottom: 20px;
  max-width: 80%;
}

.message.user {
  margin-left: auto;
}

.message.assistant {
  margin-right: auto;
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.markdown-body {
  font-size: 14px;
  line-height: 1.6;
}

.markdown-body pre {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
}

.markdown-body code {
  font-family: monospace;
  background: #f6f8fa;
  padding: 2px 4px;
  border-radius: 3px;
}

.markdown-body p {
  margin: 8px 0;
}

.user .message-content {
  background: #007aff;
  color: white;
}
</style>

<style scoped>
.chat-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.messages-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f5f5;
}

.messages {
  width: 100%;
}

.input-wrapper {
  background: white;
  border-top: 1px solid #eee;
  position: sticky;
  margin: 0 10px;
  width: 50vw;
  bottom: 0;
  z-index: 10;
}

.input-container {
  position: relative;
  width: 100%;
  background: white;
}

textarea {
  width: 100%;
  min-height: 100px;
  padding: 16px;
  padding-bottom: 50px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
}

.send-button {
  position: absolute;
  bottom: 12px;
  right: 12px;
  padding: 8px 16px;
  background: #007aff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.stop-button {
  position: absolute;
  bottom: 12px;
  right: 80px;
  padding: 8px 16px;
  background: #ff3b30;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.message {
  margin-bottom: 20px;
  max-width: 80%;
}

.message.user {
  margin-left: auto;
}

.message.assistant {
  margin-right: auto;
}

.message-content {
  padding: 12px 16px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.user .message-content {
  background: #007aff;
  color: white;
}

.input-container {
  padding: 20px;
  background: white;
  border-top: 1px solid #eee;
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

button {
  padding: 10px 20px;
  background: #007aff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
