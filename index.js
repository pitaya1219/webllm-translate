import * as webllm from "https://esm.run/@mlc-ai/web-llm";

console.log("WebLLM loaded successfully!");
const messages = [
  {
    content: `You are a translator. It's your role to translate user input.
If the input is in Japanese, translate it to English.
If the input is in English, translate it to Japanese.
If source code is included, keep the code as-is and only translate the surrounding text.`,
    role: "system",
  },
];
const MODEL_ID = "gemma-2-2b-jpn-it-q4f16_1-MLC";
console.log("Using model:", MODEL_ID);
// Callback function for initializing progress
function updateProgress(report) {
  const progressBar = document.querySelector('.progress-fill');
  progressBar.style.width = `${report.progress * 100}%`;
}

function updateEngineInitProgressCallback(report) {
  console.log("initialize", report.progress);
  document.getElementById("download-status").textContent = report.text;
  updateProgress(report);
}

let engine;

async function initializeWebLLMEngine() {
  try {
    const button = document.getElementById("download");
    const downloadStatus = document.getElementById("download-status");
    const downloadProgress = document.getElementById("download-progress");
    
    button.disabled = true;
    downloadStatus.style.display = "block";
    downloadProgress.style.display = "block";
    
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: updateEngineInitProgressCallback,
    });
    console.log("Model successfully loaded!");

    button.style.display = "none";
    downloadStatus.style.display = "none";
    downloadProgress.style.display = "none";
    document.querySelector(".download-container").style.display = "none";

    document.querySelector(".chat-container").style.display = "flex";
    document.getElementById('reset-chat').style.display = 'flex';
    document.getElementById("send").disabled = false;
    document.getElementById("user-input").disabled = false;
    document.querySelector('.wrapper').classList.add('chat-active');

  } catch (error) {
    console.error("Error loading model:", error);
    button.disabled = false;
    downloadStatus.style.display = "none";
    downloadProgress.style.display = "none";
  }
}

function setLoading(isLoading) {
  const sendButton = document.getElementById("send");
  const resetButton = document.getElementById("reset-chat");
  const spinner = sendButton.querySelector(".spinner");
  const buttonText = sendButton.querySelector(".button-text");
  const userInput = document.getElementById("user-input");
  
  sendButton.disabled = isLoading;
  spinner.classList.toggle("hidden", !isLoading);
  buttonText.classList.toggle("hidden", isLoading);

  resetButton.disabled = isLoading;
  resetButton.style.opacity = isLoading ? "0.5" : "1";
  
  userInput.disabled = isLoading;
  userInput.setAttribute("placeholder", isLoading ? "生成中..." : "メッセージを入力してください。");
}

function resetUIState() {
  const sendButton = document.getElementById("send");
  const spinner = sendButton.querySelector(".spinner");
  const buttonText = sendButton.querySelector(".button-text");
  
  sendButton.disabled = false;
  spinner.classList.add("hidden");
  buttonText.classList.remove("hidden");
  
  const userInput = document.getElementById("user-input");
  userInput.value = "";
  userInput.setAttribute("placeholder", "メッセージを入力してください。");
  userInput.style.height = "24px";
  userInput.disabled = false;
}

let currentGenerationController = null;

function cancelGeneration() {
  if (currentGenerationController) {
    currentGenerationController.abort();
    currentGenerationController = null;
  }
}

async function streamingGenerating(messages, onUpdate, onFinish, onError) {
  try {
    currentGenerationController = new AbortController();
    
    let curMessage = "";
    let usage;
    console.log(messages);
    const completion = await engine.chat.completions.create({
      stream: true,
      messages,
      stream_options: { include_usage: true },
      temperature: 0.7,
      top_p: 0.95,
      logit_bias: {"14444": -100},
      repetition_penalty: 1.2,
      frequency_penalty: 0.5,
    });
    for await (const chunk of completion) {
      if (currentGenerationController === null) {
        return;
      }
      const curDelta = chunk.choices[0]?.delta.content;
      if (curDelta) {
        curMessage += curDelta;
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
      onUpdate(curMessage);
    }
    if (currentGenerationController !== null) {
      const finalMessage = await engine.getMessage();
      messages.push({ role: "assistant", content: finalMessage });
      onFinish(finalMessage, usage);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Generation was cancelled');
      return;
    }
    onError(err);
  } finally {
    currentGenerationController = null;
  }
}

function onMessageSend() {
  const input = document.getElementById("user-input").value.trim();
  const message = { content: input, role: "user" };
  if (!input) return;
  setLoading(true);
  
  messages.push(message);
  appendMessage(message);
  document.getElementById("user-input").value = "";
  document.getElementById("user-input").style.height = "24px";
  appendMessage({ content: "お待ちください...", role: "assistant" });

  streamingGenerating(
    messages,
    updateLastMessage,
    (finalMessage, usage) => {
      updateLastMessage(finalMessage);
      setLoading(false);
    },
    (error) => {
      console.error(error);
      setLoading(false);
    }
  );
}

function appendMessage(message) {
  const chatBox = document.getElementById("chat-box");
  const container = document.createElement("div");
  container.classList.add("message-container", message.role);
  const newMessage = document.createElement("div");
  newMessage.classList.add("message");
  marked.setOptions({
    breaks: true, 
    gfm: true
  });
  const formattedMessage = marked.parse(message.content);
  newMessage.innerHTML = formattedMessage;

  container.appendChild(newMessage);
  chatBox.appendChild(container);
  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: "smooth",
  });
}

function updateLastMessage(content) {
  const messageDoms = document.getElementById("chat-box").querySelectorAll(".message");
  const lastMessageDom = messageDoms[messageDoms.length - 1];
  marked.setOptions({
    breaks: true, 
    gfm: true
  });
  const formattedContent = marked.parse(content);
  lastMessageDom.innerHTML = formattedContent;
  const chatBox = document.getElementById("chat-box");
  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: "smooth",
  });
}

const textarea = document.getElementById("user-input");
textarea.addEventListener("input", () => {
  textarea.style.height = "24px";
  textarea.style.height = textarea.scrollHeight + "px";
});

document.getElementById("download").addEventListener("click", initializeWebLLMEngine);
document.getElementById("send").addEventListener("click", onMessageSend);

document.getElementById('title-link').addEventListener('click', (e) => {
  e.preventDefault();
  if (document.querySelector('.chat-container').style.display === 'flex') {
    cancelGeneration();

    messages.length = 1;
    document.getElementById('chat-box').innerHTML = '';
    
    document.querySelector('.chat-container').style.display = 'none';
    document.getElementById('reset-chat').style.display = 'none';
    
    const downloadContainer = document.querySelector('.download-container');
    downloadContainer.style.display = 'flex';
    document.getElementById('download').style.display = 'block';
    document.getElementById('download').disabled = false;
    document.getElementById('download-status').style.display = 'none';
    document.getElementById('download-progress').style.display = 'none';
    
    document.querySelector('.wrapper').classList.remove('chat-active');

    resetUIState();
    if (engine) {
      engine = null;
    }
  }
});

document.getElementById('reset-chat').addEventListener('click', () => {
  cancelGeneration();
  messages.length = 1;
  const chatBox = document.getElementById('chat-box');
  while (chatBox.firstChild) {
    chatBox.removeChild(chatBox.firstChild);
  }

  resetUIState();

  const userInput = document.getElementById("user-input");
  userInput.disabled = false;
  const sendButton = document.getElementById("send");
  sendButton.disabled = false;
});

