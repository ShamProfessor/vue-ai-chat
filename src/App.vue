<template>
  <div class="app-container">
    <div class="mode-switch">
      <button
        :class="{ active: currentMode === 'fetch' }"
        @click="currentMode = 'fetch'"
      >
        Fetch模式
      </button>
      <button
        :class="{ active: currentMode === 'sse' }"
        @click="currentMode = 'sse'"
      >
        SSE模式
      </button>
      当前模型
      <select v-model="currentModel">
        <option value="deepseek-ai/DeepSeek-V3">DeepSeek V3</option>
        <option value="deepseek-ai/DeepSeek-R1">DeepSeek R1</option>
      </select>
    </div>

    <div class="main-content">
      <ChatContainer
        ref="chatContainer"
        :mode="currentMode"
        v-model:isStreaming="isStreaming"
      />
      <ChatInput
        :isStreaming="isStreaming"
        :userInput="userInput"
        @send="sendMessage"
        @stop="stopStream"
      />
    </div>
  </div>
</template>

<script setup>
import { provide, ref } from "vue";
import ChatContainer from "./components/ChatContainer.vue";
import ChatInput from "./components/ChatInput.vue";

const currentMode = ref("fetch");
const isStreaming = ref(false);
const userInput = ref("");
const chatContainer = ref(null);
const currentModel = ref("deepseek-ai/DeepSeek-V3");

provide("currentModel", currentModel);

const sendMessage = async (message) => {
  isStreaming.value = true;
  await chatContainer.value.sendMessage(message);
  isStreaming.value = false;
};

const stopStream = () => {
  chatContainer.value.stopStream();
  isStreaming.value = false;
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 50vw;
  margin: 0 auto;
  position: relative;
}

.active {
  background: #007aff;
  color: #fff;
}

.mode-switch {
  position: sticky;
  top: 0;
  z-index: 09999;
  background: #fff;
  padding: 10px;
}
</style>
