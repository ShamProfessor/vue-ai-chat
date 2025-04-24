<template>
  <div class="input-wrapper">
    <div class="input-container">
      <textarea
        v-model="inputValue"
        @keyup.enter.ctrl="handleSend"
        placeholder="输入消息... (Ctrl + Enter 发送)"
        :disabled="isStreaming"
      ></textarea>
      <button
        @click="handleSend"
        :disabled="!inputValue.trim() || isStreaming"
        class="send-button"
      >
        发送
      </button>
      <button v-if="isStreaming" @click="handleStop" class="stop-button">
        暂停
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  isStreaming: Boolean,
  userInput: String,
});

const emit = defineEmits(["send", "stop"]);

const inputValue = ref("");

watch(
  () => props.userInput,
  (newVal) => {
    inputValue.value = newVal;
  }
);

const handleSend = () => {
  if (!inputValue.value.trim() || props.isStreaming) return;
  emit("send", inputValue.value);
  inputValue.value = "";
};

const handleStop = () => {
  emit("stop");
};
</script>

<style scoped>
.input-wrapper {
  background: white;
  border-top: 1px solid #eee;
  padding: 20px;
  width: 100%;
  position: sticky;
  bottom: 0;
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

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
