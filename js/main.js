import { state } from './state.js';
import { fetchManifest, fetchAllCategories } from './api.js';
import { logDebug, applyEnvironmentSettings, renderCurrentConversation, renderCatalog, updateElementText } from './ui.js';
import { playFullConversation, stopAudio } from './audio.js';

async function loadApp() {
  logDebug("Iniciando la carga de la app...");
  try {
    const config = await fetchManifest();
    applyEnvironmentSettings(config.environment);
    
    state.conversations = await fetchAllCategories(config.categories, config.appVersion);
    
    initializeUI();
  } catch (error) {
    handleFatalError(error);
  }
}

function initializeUI() {
  logDebug(`Total diálogos listos: ${state.conversations.length}`);
  if (state.conversations.length > 0) {
    // En lugar de cargar el reproductor por defecto, mostramos el Catálogo iOS
    renderCatalog();
    logDebug("🎉 Interfaz renderizada correctamente.");
  } else {
    updateElementText("conv-title", "No hay diálogos disponibles.");
    logDebug("⚠️ No hay diálogos en los JSON.");
  }
}

function handleFatalError(error) {
  logDebug(`❌ ERROR CRÍTICO: ${error.message}`);
  updateElementText("conv-title", "Error al conectar con la base de datos.");
}

function setupEventListeners() {
  document.getElementById("btn-play-audio")?.addEventListener("click", () => state.isPlaying ? stopAudio() : playFullConversation());
  document.getElementById("btn-stop-audio")?.addEventListener("click", stopAudio);

  document.querySelectorAll(".btn-speed").forEach(btn => {
    btn.addEventListener("click", (e) => {
      // Clases nativas inactivas
      document.querySelectorAll(".btn-speed").forEach(b => b.className = "btn-speed cursor-pointer text-[12px] px-3 py-1 rounded-md font-semibold text-slate-600 active:bg-white/50");
      // Clase nativa activa
      e.target.className = "btn-speed cursor-pointer text-[12px] px-3 py-1 rounded-md font-semibold bg-white text-slate-900 shadow-sm";
      
      state.selectedPlaybackSpeed = parseFloat(e.target.dataset.speed);
      if (state.currentAudioElement) state.currentAudioElement.playbackRate = state.selectedPlaybackSpeed;
    });
  });

  setupTranscriptEvents();
  setupNavigationEvents();
}

function setupTranscriptEvents() {
  const transcriptBox = document.getElementById("transcript-box");
  const controls = document.getElementById("transcript-controls");
  
  document.getElementById("btn-toggle-transcript")?.addEventListener("click", () => {
    if (!transcriptBox || !controls) return;
    const isHidden = transcriptBox.classList.contains("hidden");
    
    transcriptBox.classList.toggle("hidden", !isHidden);
    controls.classList.toggle("hidden", !isHidden);
    controls.classList.toggle("flex", isHidden);
    updateElementText("transcript-toggle-text", isHidden ? "Ocultar Transcripción" : "Transcripción");
  });

  document.getElementById("check-furigana")?.addEventListener("change", (e) => {
    e.target.checked ? transcriptBox.classList.remove("hide-furigana") : transcriptBox.classList.add("hide-furigana");
  });

  document.getElementById("check-translation")?.addEventListener("change", (e) => {
    e.target.checked ? transcriptBox.classList.remove("hide-translation") : transcriptBox.classList.add("hide-translation");
  });
}

function setupNavigationEvents() {
  // Buscador en la pantalla principal
  document.getElementById("search-input")?.addEventListener("input", (e) => renderCatalog(e.target.value));

  // Evento para abrir un diálogo y deslizar al reproductor
  window.addEventListener("loadDialogue", (e) => {
    const dialogue = e.detail;
    state.currentConvId = dialogue.id;
    
    // Actualizar la barra superior del reproductor
    document.getElementById("nav-category").textContent = dialogue.category;
    
    renderCurrentConversation();
    
    // Transición iOS (Deslizar hacia la izquierda)
    const homeView = document.getElementById("home-view");
    const playerView = document.getElementById("player-view");
    
    homeView?.classList.replace("view-enter", "view-leave"); 
    playerView?.classList.replace("view-leave", "view-enter"); 
  });

  // Botón Atrás (< Inicio) en el Navigation Bar
  document.getElementById("btn-back")?.addEventListener("click", () => {
    stopAudio(); // Importante: parar el audio al salir de la lección

    // Transición iOS (Deslizar hacia la derecha)
    const homeView = document.getElementById("home-view");
    const playerView = document.getElementById("player-view");
    
    playerView?.classList.replace("view-enter", "view-leave"); 
    homeView?.classList.replace("view-leave", "view-enter"); 
  });
}

// Arranque
window.addEventListener("DOMContentLoaded", () => {
  logDebug("El HTML ha cargado. Arrancando módulo principal...");
  setupEventListeners();
  loadApp(); 
});