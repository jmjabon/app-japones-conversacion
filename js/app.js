// --- FUNCION DE DEPURACION EN PANTALLA ---
function logDebug(msg) {
  const box = document.getElementById('debug-box');
  if(box) box.innerHTML += '<br>🔹 ' + msg;
}

let conversations = [];
let currentConvId = null;
let selectedPlaybackSpeed = 1.0;
let isPlaying = false;
let currentUtteranceIndex = 0;
let userAnswers = {};
let openCategories = new Set();
let currentAudioElement = null; // Controlador del MP3

// --- 1. MOTOR DE CARGA ---
async function loadApp() {
  logDebug("Iniciando la carga de la app...");
  try {
    logDebug("Buscando ./data/manifest.json ...");
    const manifestResponse = await fetch('./data/manifest.json');
    
    if (!manifestResponse.ok) {
      throw new Error(`HTTP Error ${manifestResponse.status}. ¿Existe manifest.json?`);
    }
    
    const manifest = await manifestResponse.json();
    logDebug(`Manifest cargado. Categorías a buscar: ${manifest.length}`);

    let allConvs = [];
    for (const cat of manifest) {
      logDebug(`Leyendo archivo: ${cat.file} ...`);
      try {
        const catResponse = await fetch('./' + cat.file);
        if (catResponse.ok) {
          const catData = await catResponse.json();
          allConvs = allConvs.concat(catData);
          openCategories.add(cat.name);
          logDebug(`✅ Éxito: ${cat.file} (${catData.length} diálogos)`);
        } else {
          logDebug(`⚠️ No se encontró: ${cat.file}`);
        }
      } catch (err) {
        logDebug(`❌ Error de sintaxis en el JSON de ${cat.file}: ${err.message}`);
      }
    }

    conversations = allConvs;
    logDebug(`Total diálogos listos: ${conversations.length}`);

    if (conversations.length > 0) {
      currentConvId = conversations[0].id;
      renderCurrentConversation();
      logDebug("🎉 Interfaz renderizada correctamente.");
    } else {
      const title = document.getElementById("conv-title");
      if (title) title.textContent = "No hay diálogos disponibles.";
      logDebug("⚠️ No hay diálogos en los JSON.");
    }
  } catch (error) {
    logDebug(`❌ ERROR CRÍTICO: ${error.message}`);
    const title = document.getElementById("conv-title");
    if (title) title.textContent = "Error al conectar con la base de datos.";
  }
}

// --- 2. MOTOR DE AUDIO HÍBRIDO ---
function stopAudio() {
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  
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

  // Intentar reproducir el MP3 si existe en el JSON
  if (conv.audioUrl) {
    logDebug(`Reproduciendo MP3 desde: ${conv.audioUrl}`);
    currentAudioElement = new Audio(conv.audioUrl);
    currentAudioElement.playbackRate = selectedPlaybackSpeed;
    currentAudioElement.volume = 1.0; // FUERZA EL MP3 AL 100%

    currentAudioElement.onended = () => stopAudio();

    currentAudioElement.onerror = () => {
      logDebug(`Error cargando MP3 (${conv.audioUrl}). Usando voz de respaldo.`);
      conv.audioUrl = null; 
      stopAudio();
      playFullConversation(); 
    };

    currentAudioElement.play();
    return; 
  }

  // Fallback: Si no hay MP3, usar voz robótica
  if (!("speechSynthesis" in window)) return;
  
  currentUtteranceIndex = 0;
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
    utterance.volume = 0.7; // REDUCE LA VOZ ROBÓTICA AL 70%
    
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

function updateAudioUI(playing) {
  const btnText = document.getElementById("btn-play-text");
  const iconWrapper = document.getElementById("play-icon-wrapper");
  const statusText = document.getElementById("audio-status");

  if (playing) {
    if (btnText) btnText.textContent = "Reproduciendo...";
    if (iconWrapper) iconWrapper.innerHTML = `<i data-lucide="volume-2" class="w-6 h-6 fill-current"></i>`;
    if (statusText) statusText.innerHTML = `<span id="status-indicator" class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-ping"></span> Reproduciendo diálogo`;
  } else {
    if (btnText) btnText.textContent = "Reproducir Diálogo";
    if (iconWrapper) iconWrapper.innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
    if (statusText) statusText.innerHTML = `<span id="status-indicator" class="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span> Listo para escuchar`;
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- 3. RENDERIZADO DE INTERFAZ ---
function renderCurrentConversation() {
  const conv = conversations.find(c => c.id === currentConvId);
  if (!conv) return;
  userAnswers = {};

  const elCat = document.getElementById("label-category");
  if (elCat) elCat.textContent = `${conv.category} > ${conv.subcategory || 'General'}`;

  const elDiff = document.getElementById("label-difficulty");
  if (elDiff) elDiff.textContent = conv.difficulty || "N5";

  const elTitle = document.getElementById("conv-title");
  if (elTitle) elTitle.textContent = conv.title;

  const elBadge = document.getElementById("current-badge");
  if (elBadge) elBadge.textContent = `${conv.category} • ${conv.dialogue.length} intervenciones`;

  const transcriptBox = document.getElementById("transcript-box");
  if (transcriptBox) {
    transcriptBox.innerHTML = conv.dialogue.map(line => `
      <div class="flex items-start gap-2.5">
        <span class="font-bold text-slate-700 min-w-[75px] text-xs uppercase tracking-wide bg-slate-200/80 px-2 py-0.5 rounded text-center flex-shrink-0">${line.speaker}:</span>
        <span class="text-slate-800 text-base leading-relaxed">${line.html || line.text}</span>
      </div>
    `).join("");
    transcriptBox.classList.add("hidden");
  }

  const furiganaSwitch = document.getElementById("furigana-switch-container");
  if (furiganaSwitch) furiganaSwitch.classList.add("hidden");

  const transText = document.getElementById("transcript-toggle-text");
  if (transText) transText.textContent = "Ver Transcripción en Japonés";

  renderQuestions(conv);
  updateScoreBadge();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderQuestions(conv) {
  const container = document.getElementById("questions-container");
  if (!container) return;
  container.innerHTML = "";

  if (!conv.questions || conv.questions.length === 0) {
    container.innerHTML = `<div class="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">No hay preguntas en esta conversación.</div>`;
    return;
  }

  conv.questions.forEach((q, qIndex) => {
    const qCard = document.createElement("div");
    qCard.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3";

    const qTitle = document.createElement("h4");
    qTitle.className = "font-bold text-slate-900 text-sm md:text-base flex items-start gap-2";
    qTitle.innerHTML = `<span class="bg-rose-100 text-rose-700 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">${qIndex + 1}</span> ${q.question}`;
    qCard.appendChild(qTitle);

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "space-y-2 mt-1";

    q.options.forEach((opt, optIndex) => {
      const btnOpt = document.createElement("button");
      btnOpt.className = "cursor-pointer w-full text-left p-3.5 rounded-xl border text-sm font-medium transition-all active:scale-[0.99] flex items-center justify-between border-slate-200 hover:bg-slate-50 text-slate-700";
      btnOpt.dataset.qId = q.id;
      btnOpt.dataset.optIndex = optIndex;
      btnOpt.innerHTML = `<span>${opt}</span><span class="icon-indicator"></span>`;
      btnOpt.addEventListener("click", () => handleSelectOption(q, optIndex, qCard));
      optionsDiv.appendChild(btnOpt);
    });

    qCard.appendChild(optionsDiv);
    const expDiv = document.createElement("div");
    expDiv.id = `exp-${q.id}`;
    expDiv.className = "hidden mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed";
    qCard.appendChild(expDiv);
    container.appendChild(qCard);
  });
}

function handleSelectOption(question, selectedIndex, cardElement) {
  userAnswers[question.id] = selectedIndex;
  const isCorrect = selectedIndex === question.correctIndex;
  const buttons = cardElement.querySelectorAll("button[data-opt-index]");
  const expDiv = cardElement.querySelector(`#exp-${question.id}`);

  buttons.forEach(btn => {
    const idx = parseInt(btn.dataset.optIndex);
    btn.disabled = true;
    if (idx === question.correctIndex) {
      btn.className = "w-full text-left p-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm";
      btn.querySelector(".icon-indicator").innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-600 pointer-events-none"></i>`;
    } else if (idx === selectedIndex && !isCorrect) {
      btn.className = "w-full text-left p-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between border-rose-500 bg-rose-50 text-rose-900 shadow-sm";
      btn.querySelector(".icon-indicator").innerHTML = `<i data-lucide="x" class="w-4 h-4 text-rose-600 pointer-events-none"></i>`;
    } else {
      btn.className = "w-full text-left p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between border-slate-100 bg-slate-50 text-slate-400 opacity-60";
    }
  });

  if (question.explanation && expDiv) {
    expDiv.innerHTML = `<strong>Explicación:</strong> ${question.explanation}`;
    expDiv.classList.remove("hidden");
  }
  updateScoreBadge();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateScoreBadge() {
  const conv = conversations.find(c => c.id === currentConvId);
  if (!conv || !conv.questions) return;
  const counter = document.getElementById("score-counter");
  if (counter) counter.textContent = `${Object.keys(userAnswers).length} / ${conv.questions.length} Respondidas`;
}

function renderCategoriesDrawer(filterText = "") {
  const container = document.getElementById("dialogues-tree");
  if (!container) return;
  container.innerHTML = "";
  const counter = document.getElementById("total-convs-counter");
  if (counter) counter.textContent = `${conversations.length} diálogos en total`;

  const groups = {};
  conversations.forEach(c => {
    const matches = filterText === "" || c.title.toLowerCase().includes(filterText.toLowerCase()) || c.category.toLowerCase().includes(filterText.toLowerCase());
    if (!matches) return;
    if (!groups[c.category]) groups[c.category] = {};
    const sub = c.subcategory || "General";
    if (!groups[c.category][sub]) groups[c.category][sub] = [];
    groups[c.category][sub].push(c);
  });

  for (const [catName, subCats] of Object.entries(groups)) {
    const isExpanded = filterText !== "" || openCategories.has(catName);
    let countInCat = 0;
    Object.values(subCats).forEach(items => countInCat += items.length);

    const groupDiv = document.createElement("div");
    groupDiv.className = "border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm";

    const groupHeader = document.createElement("button");
    groupHeader.className = "cursor-pointer w-full px-4 py-4 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors border-b border-slate-200";
    groupHeader.setAttribute("data-category-header", catName);
    groupHeader.innerHTML = `
      <div class="flex items-center gap-2 pointer-events-none">
        <i data-lucide="${isExpanded ? 'folder-open' : 'folder'}" class="w-4 h-4 text-rose-500"></i>
        <span class="font-bold text-xs uppercase tracking-wider text-slate-800">${catName}</span>
      </div>
      <div class="flex items-center gap-2 pointer-events-none">
        <span class="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">${countInCat}</span>
        <i data-lucide="chevron-${isExpanded ? 'up' : 'down'}" class="w-4 h-4 text-slate-400"></i>
      </div>
    `;
    groupDiv.appendChild(groupHeader);

    if (isExpanded) {
      const bodyDiv = document.createElement("div");
      bodyDiv.className = "p-2 space-y-3";
      for (const [subName, items] of Object.entries(subCats)) {
        const subWrapper = document.createElement("div");
        subWrapper.innerHTML = `<div class="text-[11px] font-bold text-slate-400 uppercase px-2 py-1">${subName}</div>`;
        items.forEach(conv => {
          const isSelected = conv.id === currentConvId;
          const btn = document.createElement("button");
          btn.setAttribute("data-conv-id", conv.id);
          btn.className = `cursor-pointer w-full text-left p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all my-1 ${isSelected ? "bg-rose-500 text-white shadow-sm" : "hover:bg-slate-100 text-slate-700"}`;
          btn.innerHTML = `<div class="truncate pr-2 pointer-events-none"><div class="font-bold truncate text-[13px]">${conv.title}</div><div class="text-[10px] opacity-75 mt-0.5">${conv.difficulty}</div></div><i data-lucide="chevron-right" class="w-4 h-4 flex-shrink-0 pointer-events-none ${isSelected ? 'text-white' : 'text-slate-400'}"></i>`;
          subWrapper.appendChild(btn);
        });
        bodyDiv.appendChild(subWrapper);
      }
      groupDiv.appendChild(bodyDiv);
    }
    container.appendChild(groupDiv);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- 4. EVENTOS ---
function setupEventListeners() {
  const btnPlay = document.getElementById("btn-play-audio");
  if (btnPlay) btnPlay.addEventListener("click", () => isPlaying ? stopAudio() : playFullConversation());
  
  const btnStop = document.getElementById("btn-stop-audio");
  if (btnStop) btnStop.addEventListener("click", stopAudio);

  document.querySelectorAll(".btn-speed").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".btn-speed").forEach(b => b.className = "btn-speed cursor-pointer text-xs px-2.5 py-1 rounded-lg font-bold text-slate-600 hover:bg-slate-100");
      e.target.className = "btn-speed cursor-pointer text-xs px-2.5 py-1 rounded-lg font-bold bg-rose-500 text-white shadow-sm";
      selectedPlaybackSpeed = parseFloat(e.target.dataset.speed);
      if(currentAudioElement) currentAudioElement.playbackRate = selectedPlaybackSpeed;
    });
  });

  const transcriptBox = document.getElementById("transcript-box");
  const furiganaSwitch = document.getElementById("furigana-switch-container");
  const btnToggleTrans = document.getElementById("btn-toggle-transcript");
  
  if (btnToggleTrans && transcriptBox && furiganaSwitch) {
    btnToggleTrans.addEventListener("click", () => {
      if (transcriptBox.classList.contains("hidden")) {
        transcriptBox.classList.remove("hidden");
        furiganaSwitch.classList.remove("hidden");
        furiganaSwitch.classList.add("flex");
        const tText = document.getElementById("transcript-toggle-text");
        if(tText) tText.textContent = "Ocultar Transcripción";
      } else {
        transcriptBox.classList.add("hidden");
        furiganaSwitch.classList.add("hidden");
        furiganaSwitch.classList.remove("flex");
        const tText = document.getElementById("transcript-toggle-text");
        if(tText) tText.textContent = "Ver Transcripción en Japonés";
      }
    });
  }

  const checkFurigana = document.getElementById("check-furigana");
  if (checkFurigana && transcriptBox) {
    checkFurigana.addEventListener("change", (e) => {
      e.target.checked ? transcriptBox.classList.remove("hide-furigana") : transcriptBox.classList.add("hide-furigana");
    });
  }

  const menuDrawer = document.getElementById("menu-drawer");
  const btnToggleMenu = document.getElementById("btn-toggle-menu");
  if (btnToggleMenu && menuDrawer) {
    btnToggleMenu.addEventListener("click", () => {
      renderCategoriesDrawer();
      menuDrawer.classList.remove("hidden");
    });
  }
  
  const btnCloseMenu = document.getElementById("btn-close-menu");
  if (btnCloseMenu && menuDrawer) btnCloseMenu.addEventListener("click", () => menuDrawer.classList.add("hidden"));
  
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.addEventListener("input", (e) => renderCategoriesDrawer(e.target.value));

  const tree = document.getElementById("dialogues-tree");
  if (tree) {
    tree.addEventListener("click", (e) => {
      const headerBtn = e.target.closest("[data-category-header]");
      if (headerBtn) {
        const cat = headerBtn.getAttribute("data-category-header");
        openCategories.has(cat) ? openCategories.delete(cat) : openCategories.add(cat);
        const searchInputEl = document.getElementById("search-input");
        renderCategoriesDrawer(searchInputEl ? searchInputEl.value : "");
        return;
      }
      const convBtn = e.target.closest("[data-conv-id]");
      if (convBtn) {
        stopAudio();
        currentConvId = convBtn.getAttribute("data-conv-id");
        renderCurrentConversation();
        if(menuDrawer) menuDrawer.classList.add("hidden");
      }
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  logDebug("El HTML ha cargado. Arrancando scripts...");
  setupEventListeners();
  loadApp(); 
});