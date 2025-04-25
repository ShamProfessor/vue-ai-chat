---
marp: true
---

# 前端流式输出实现详解：从原理到实践

# 前言

## 一、流式输出核心原理

### 1.1 什么是流式输出？

### 1.2 技术优势对比

### 1.3 关键技术支撑

## 二、原生 JavaScript 实现方案

### 2.1 使用 Fetch API 流式处理

### 2.2 处理 SSE（Server-Sent Events）

## 三、主流框架实现示例

### 3.1 React 实现方案

### 3.2 Vue 实现方案

## 四、高级优化策略

### 4.1 性能优化

### 4.2 用户体验增强

---

## 一、流式输出核心原理

### 1.1 什么是流式输出？

分块传输（Chunked Transfer）、持续接收、实时渲染，不等待完整响应。

### 1.2 技术优势对比

| 方式           | 内存占用 | 首屏时间 | 适用场景                |
| -------------- | -------- | -------- | ----------------------- |
| 传统一次性加载 | 高       | 长       | 小数据量静态内容        |
| 流式输出       | 低       | 极短     | 实时数据 / 大数据量场景 |

### 1.3 关键技术支撑

- HTTP/1.1 Chunked Encoding【传输层】
- Fetch API ReadableStream 【客户端处理】
- Server-Sent Events (SSE)
- WebSocket（双向通信场景）

---

## 二、原生 JavaScript 实现方案

### 2.1 使用 Fetch API 流式处理

```javascript
async function fetchStream(url) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // 处理分块数据
    const chunk = decoder.decode(value);
    document.getElementById("output").innerHTML += chunk;

    // 自动滚动到底部
    window.scrollTo(0, document.body.scrollHeight);
  }
}
```

关键点：

- ## 核心 1： const response = await fetch(url);

  <span style="color: green">**只等待"响应头"返回，不等待"完整响应体"下载完毕**</span>：

  这意味着只要服务器返回了 HTTP 响应的 headers（即 status, Content-Type, 等），这个 await 就结束。此时 response.body 是一个可读流（ReadableStream），真正的数据内容还在“后面慢慢来”。

- response.body.getReader() 获取可读流

- ## 核心 2： const { done, value } = await reader.read();

  • 它是一个逐块（chunk）读取流的异步操作。
  • 每次 read() 都是等新的数据从服务器传过来，然后你就能处理那一块。
  • 这才是流式响应真正的“按需拉取”核心操作。

- TextDecoder 处理二进制数据转换 文本
- 循环读取直到 done 为 true

### 2.2 使用 SSE 处理

```javascript
const eventSource = new EventSource("/stream");

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  appendToDOM(data.content);
};

eventSource.onerror = () => {
  console.error("Stream closed");
};
```

关键点：

- 基于 HTTP 协议，服务器推送数据
- EventSource 建立与服务器的事件流连接
- onmessage 事件处理接收到的数据
- onerror 处理连接错误

---

## 三、主流框架实现示例

### 3.1 React 实现方案

```jsx
import React, { useState, useEffect } from "react";

function StreamComponent() {
  const [content, setContent] = useState("");

  useEffect(() => {
    const controller = new AbortController(); // 用于取消请求

    fetch("/api/stream", { signal: controller.signal }).then((response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) return;
          setContent((prev) => prev + decoder.decode(value));
          read();
        });
      }
      read();
    });

    return () => controller.abort();
  }, []);

  return <div className="stream-output">{content}</div>;
}
```

### 3.2 Vue 实现方案

```javascript
<template>
  <div class="stream-output" v-html="content"></div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
const content = ref('');
onMounted(() => {
    const response = await fetch('/stream');
    const reader = response.body.getReader();

    while(true) {
    const { done, value } = await reader.read();
    if(done) break;
    content.value += new TextDecoder().decode(value);
    }
    });
</script>
```

---

## 四、高级优化策略

### 4.1 性能优化

<details>
<summary>防抖渲染：合并高频更新</summary>

```javascript
let buffer = [];
let renderScheduled = false;

function scheduleRender() {
  if (!renderScheduled) {
    requestAnimationFrame(() => {
      document.getElementById("output").innerHTML += buffer.join("");
      buffer = [];
      renderScheduled = false;
    });
    renderScheduled = true;
  }
}

// 在数据接收时
buffer.push(chunk);
scheduleRender();
```

_立即更新 dom 存在的问题_

- 每收到数据就触发更新，可能导致大量重排重绘
- 更新频率可能超过屏幕刷新率，造成性能浪费
- 容易造成页面卡顿

_原理分析：_

1. 浏览器渲染机制

- 浏览器的渲染是以帧为单位的，通常是 60fps（每秒 60 帧）
- 每一帧的渲染都需要经过：JavaScript 执行 -> 样式计算 -> 布局 -> 绘制等步骤
- 频繁的 DOM 操作会导致浏览器不断重新计算布局（reflow）和重新绘制（repaint）

2. requestAnimationFrame 的工作方式

- 它会在浏览器下一次重绘之前执行回调函数
- 浏览器会自动调整回调函数的执行时机，使其与屏幕刷新率同步
- 当页面在后台或隐藏时，requestAnimationFrame 会自动暂停，节省资源

_过程：_

- 批量更新 ：不是每收到一个数据块就更新 DOM，而是将数据先存入 buffer
- 防抖 ：通过 renderScheduled 标志位避免在一帧内重复调度渲染
- 同步渲染 ：确保 DOM 更新与浏览器的渲染周期同步
- 减少重排重绘 ：将多次 DOM 更新合并为一次，显著减少浏览器的渲染负担

# _拓展_：

```text
响应式数据变化
 ↓
Vue 将变更入队（异步 update queue）
 ↓
微任务中批量执行 watcher / effect 更新
 ↓
Virtual DOM diff & patch
 ↓
DOM 操作触发样式计算 / 回流 / 重绘
 ↓
requestAnimationFrame 阶段渲染
```

# _举例_：

```javascript
<template>
  <div>{{ text }}</div>
</template>

<script setup>
import { ref } from 'vue'
const text = ref('Hello')

setInterval(() => {
  text.value += '!'
}, 16)
</script>
```

在这个场景下： 1. 每 16ms 改一次 text.value； 2. Vue 会将更新任务入队（不是立刻 DOM 更新）； 3. 下一轮微任务中统一执行 diff & patch； 4. 触发 DOM 操作； 5. 最终浏览器在下一帧前把 DOM 渲染到屏幕上（rAF 阶段）。

4. 性能提升体现

- 更流畅的动画效果 ：与屏幕刷新率同步，避免掉帧
- 更好的性能 ：减少不必要的渲染，降低 CPU 和 GPU 负载
- 更好的电池寿命 ：在移动设备上能够更加节能
- 更好的内存管理 ：避免创建过多的渲染任务
</details>

<details> 
<summary>容器滚动优化</summary>

```javascript
// 节流处理
const throttle = (fn, delay) => {
...
};

// 位于底部时才自动滚动
const isNearBottom = () => {
  const messagesEl = messagesContainer.value;
  if (messagesEl) {
    const threshold = 100; // 阈值，表示距离底部多少像素内认为是在底部
    return (
      messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <
      threshold
    );
  }
  return true;
};
```

</details>

### 4.2 用户体验增强

- 加载状态指示器(loading、 光标跟随)
- 错误重试机制
- 暂停/恢复控制
- 撤回提问
- 虚拟滚动
