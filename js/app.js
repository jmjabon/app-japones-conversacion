// Variable global para controlar el reproductor MP3
let currentAudioElement = null;

function stopAudio() {
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  
  // Detener el MP3 si está sonando
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
  
  isPlaying = false;
  updateAudioUI(false);
  const speakerDisplay = document.getElementById("speaker-display");
  if (speakerDisplay) speakerDisplay.classList.add("hidden");
}

function playFullConversation() {
  const conv = conversations.find(c => c.id === currentConvId);
  if (!conv || !conv.dialogue || conv.dialogue.length === 0) return;

  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  } catch(e) {}

  isPlaying = true;
  updateAudioUI(true);

  // 1. INTENTO DE REPRODUCCIÓN MP3 REAL
  if (conv.audioUrl) {
    logDebug(`Reproduciendo MP3 desde: ${conv.audioUrl}`);
    currentAudioElement = new Audio(conv.audioUrl);
    
    // Aplicar la velocidad seleccionada al MP3
    currentAudioElement.playbackRate = selectedPlaybackSpeed;

    // Cuando el MP3 termine, detenemos la interfaz
    currentAudioElement.onended = () => {
      stopAudio();
    };

    // Si el archivo no existe o hay error, usamos el respaldo robótico
    currentAudioElement.onerror = () => {
      logDebug(`Error cargando MP3 (${conv.audioUrl}). Usando voz sintética de respaldo.`);
      conv.audioUrl = null; // Anulamos la URL para forzar el fallback
      stopAudio();
      playFullConversation(); // Reintentamos la función
    };

    currentAudioElement.play();
    return; // Salimos de la función para no ejecutar la síntesis de voz
  }

  // 2. FALLBACK: SÍNTESIS DE VOZ ROBÓTICA (Si no hay MP3)
  if (!("speechSynthesis" in window)) return;
  
  const speakerBox = document.getElementById("speaker-display");
  const currentSpeakerTxt = document.getElementById("current-speaker");
  const audioProgressStep = document.getElementById("audio-progress-step");
  
  if (speakerBox) speakerBox.classList.remove("hidden");

  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith("ja") || v.lang.includes("JP"));

  function speakLine() {
    if (!isPlaying) return;
    if (currentUtteranceIndex >= conv.dialogue.length) {
      stopAudio();
      return;
    }

    const line = conv.dialogue[currentUtteranceIndex];
    if (currentSpeakerTxt) currentSpeakerTxt.textContent = line.speaker || "Interlocutor";
    if (audioProgressStep) audioProgressStep.textContent = `${currentUtteranceIndex + 1} / ${conv.dialogue.length}`;

    const cleanText = line.text || line.html.replace(/<[^>]*>/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ja-JP";
    if (jaVoice) utterance.voice = jaVoice;
    
    utterance.pitch = line.pitch || 1.0;
    utterance.rate = (line.rate || 1.0) * selectedPlaybackSpeed;

    utterance.onend = () => {
      currentUtteranceIndex++;
      setTimeout(() => { if (isPlaying) speakLine(); }, 350);
    };

    utterance.onerror = () => {
      currentUtteranceIndex++;
      if (isPlaying) speakLine();
    };

    try { window.speechSynthesis.speak(utterance); } catch(e) { stopAudio(); }
  }
  speakLine();
}