import { state } from './state.js';
import { updateAudioUI, updateElementText, logDebug } from './ui.js';

export function playFullConversation() {
  const conv = state.conversations.find(c => c.id === state.currentConvId);
  if (!conv || !conv.dialogue || conv.dialogue.length === 0) return;

  resumeAudioContext();
  state.isPlaying = true;
  updateAudioUI(true);

  if (conv.audioUrl) {
    playMediaAudio(conv);
  } else {
    playSyntheticVoice(conv);
  }
}

export function stopAudio() {
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  
  if (state.currentAudioElement) {
    state.currentAudioElement.pause();
    state.currentAudioElement.currentTime = 0;
    state.currentAudioElement = null;
  }
  
  state.isPlaying = false;
  updateAudioUI(false);
  
  const speakerDisplay = document.getElementById("speaker-display");
  if (speakerDisplay) speakerDisplay.classList.add("hidden");
}

function playMediaAudio(conv) {
  logDebug(`Reproduciendo MP3: ${conv.audioUrl}`);
  state.currentAudioElement = new Audio(conv.audioUrl);
  state.currentAudioElement.playbackRate = state.selectedPlaybackSpeed;
  state.currentAudioElement.volume = 1.0;

  state.currentAudioElement.onended = () => stopAudio();
  state.currentAudioElement.onerror = () => {
    logDebug(`Error MP3 (${conv.audioUrl}). Usando voz de respaldo.`);
    conv.audioUrl = null; 
    stopAudio();
    playFullConversation(); 
  };

  state.currentAudioElement.play();
}

function playSyntheticVoice(conv) {
  if (!("speechSynthesis" in window)) return;
  
  state.currentUtteranceIndex = 0;
  const speakerBox = document.getElementById("speaker-display");
  if (speakerBox) speakerBox.classList.remove("hidden");

  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith("ja") || v.lang.includes("JP"));

  function speakNextLine() {
    if (!state.isPlaying) return;
    if (state.currentUtteranceIndex >= conv.dialogue.length) {
      stopAudio();
      return;
    }

    const line = conv.dialogue[state.currentUtteranceIndex];
    updateElementText("current-speaker", line.speaker || "Interlocutor");
    updateElementText("audio-progress-step", `${state.currentUtteranceIndex + 1} / ${conv.dialogue.length}`);

    const cleanText = line.text || line.html.replace(/<[^>]*>/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ja-JP";
    utterance.volume = 0.7;
    if (jaVoice) utterance.voice = jaVoice;
    
    utterance.pitch = line.pitch || 1.0;
    utterance.rate = (line.rate || 1.0) * state.selectedPlaybackSpeed;

    utterance.onend = () => {
      state.currentUtteranceIndex++;
      setTimeout(() => { if (state.isPlaying) speakNextLine(); }, 350);
    };
    utterance.onerror = () => {
      state.currentUtteranceIndex++;
      if (state.isPlaying) speakNextLine();
    };

    try { window.speechSynthesis.speak(utterance); } catch(e) { stopAudio(); }
  }
  
  speakNextLine();
}

function resumeAudioContext() {
  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  } catch(e) {}
}