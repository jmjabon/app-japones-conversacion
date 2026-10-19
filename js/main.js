import { state } from './state.js';
import { fetchManifest, fetchAllCategories } from './api.js';
import { logDebug, applyEnvironmentSettings, renderCurrentConversation, renderCategoriesDrawer, updateElementText } from './ui.js';
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
    state.currentConvId = state.conversations[0].id;
    
    const firstConv = state.conversations[0];
    state.openCategories.add(firstConv.category);

    renderCurrentConversation();
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
      document.querySelectorAll(".btn-speed").forEach(b => b.className = "btn-speed cursor-pointer text-xs px-2.5 py-1 rounded-lg font-bold text-slate-600 hover:bg-slate-100");
      e.target.className = "btn-speed cursor-pointer text-xs px-2.5 py-1 rounded-lg font-bold bg-rose-500 text-white shadow-sm";
      state.selectedPlaybackSpeed = parseFloat(e.target.dataset.speed);
      if (state.currentAudioElement) state.currentAudioElement.playbackRate = state.selectedPlaybackSpeed;
    });
  });

  setupTranscriptEvents();
  setupMenuEvents();
}

function setupTranscriptEvents() {
  const transcriptBox = document.getElementById("transcript-box");
  const furiganaSwitch = document.getElementById("furigana-switch-container");
  
  document.getElementById("btn-toggle-transcript")?.addEventListener("click", () => {
    if (!transcriptBox || !furiganaSwitch) return;
    const isHidden = transcriptBox.classList.contains("hidden");
    
    transcriptBox.classList.toggle("hidden", !isHidden);
    furiganaSwitch.classList.toggle("hidden", !isHidden);
    furiganaSwitch.classList.toggle("flex", isHidden);
    updateElementText("transcript-toggle-text", isHidden ? "Ocultar Transcripción" : "Ver Transcripción en Japonés");
  });

  document.getElementById("check-furigana")?.addEventListener("change", (e) => {
    e.target.checked ? transcriptBox.classList.remove("hide-furigana") : transcriptBox.classList.add("hide-furigana");
  });
}

function setupMenuEvents() {
  const menuDrawer = document.getElementById("menu-drawer");
  
  document.getElementById("btn-toggle-menu")?.addEventListener("click", () => {
    renderCategoriesDrawer();
    menuDrawer?.classList.remove("hidden");
  });
  
  document.getElementById("btn-close-menu")?.addEventListener("click", () => menuDrawer?.classList.add("hidden"));
  document.getElementById("search-input")?.addEventListener("input", (e) => renderCategoriesDrawer(e.target.value));

  document.getElementById("dialogues-tree")?.addEventListener("click", (e) => {
    const headerBtn = e.target.closest("[data-category-header]");
    if (headerBtn) {
      const cat = headerBtn.getAttribute("data-category-header");
      state.openCategories.has(cat) ? state.openCategories.delete(cat) : state.openCategories.add(cat);
      renderCategoriesDrawer(document.getElementById("search-input")?.value || "");
      return;
    }
    const convBtn = e.target.closest("[data-conv-id]");
    if (convBtn) {
      stopAudio();
      state.currentConvId = convBtn.getAttribute("data-conv-id");
      renderCurrentConversation();
      menuDrawer?.classList.add("hidden");
    }
  });
}

// Arranque
window.addEventListener("DOMContentLoaded", () => {
  logDebug("El HTML ha cargado. Arrancando módulo principal...");
  setupEventListeners();
  loadApp(); 
});