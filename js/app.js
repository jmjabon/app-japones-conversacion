let conversations = [];
let currentConvId = null;
let selectedPlaybackSpeed = 1.0;
let isPlaying = false;
let currentUtteranceIndex = 0;
let userAnswers = {};
let openCategories = new Set(); // Empezará vacío, se llenará al cargar

// --- 1. MOTOR DE CARGA (NUEVO) ---
async function loadApp() {
  try {
    // 1. Cargamos el mapa de archivos
    const manifestResponse = await fetch('./data/manifest.json');
    if (!manifestResponse.ok) throw new Error("No se pudo cargar manifest.json");
    const manifest = await manifestResponse.json();

    // 2. Cargamos todos los archivos JSON de las categorías
    let allConvs = [];
    for (const cat of manifest) {
      try {
        const catResponse = await fetch('./' + cat.file);
        if (catResponse.ok) {
          const catData = await catResponse.json();
          allConvs = allConvs.concat(catData);
          openCategories.add(cat.name); // Abre los acordeones por defecto
        }
      } catch (err) {
        console.warn(`Error cargando ${cat.file}:`, err);
      }
    }

    // 3. Inicializamos la app
    conversations = allConvs;
    if (conversations.length > 0) {
      currentConvId = conversations[0].id;
      renderCurrentConversation();
    } else {
      document.getElementById("conv-title").textContent = "No hay diálogos disponibles.";
    }
  } catch (error) {
    console.error("Error crítico al iniciar la app:", error);
    document.getElementById("conv-title").textContent = "Error al conectar con la base de datos.";
  }
}

// --- 2. MOTOR DE AUDIO ---
function stopAudio() {
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  } catch (e) {
    console.warn("El motor de voz no pudo ser detenido:", e);
  }
  isPlaying = false;
  updateAudioUI(false);
  document.getElementById("speaker-display").classList.add("hidden");
}

function playFullConversation() {
  if (!("speechSynthesis" in window)) {
    alert("Tu dispositivo no soporta síntesis de voz.");
    return;
  }

  const conv = conversations.find(c => c.id === currentConvId);
  if (!conv || !conv.dialogue || conv.dialogue.length === 0) return;

  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  } catch(e) {}

  isPlaying = true;
  currentUtteranceIndex = 0;
  updateAudioUI(true);

  const speakerBox = document.getElementById("speaker-display");
  const currentSpeakerTxt = document.getElementById("current-speaker");
  const audioProgressStep = document.getElementById("audio-progress-step");
  speakerBox.classList.remove("hidden");

  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith("ja") || v.lang.includes("JP"));

  function speakLine() {
    if (!isPlaying) return;
    if (currentUtteranceIndex >= conv.dialogue.length) {
      stopAudio();
      return;
    }

    const line = conv.dialogue[currentUtteranceIndex];
    currentSpeakerTxt.textContent = line.speaker || "Interlocutor";
    audioProgressStep.textContent = `${currentUtteranceIndex + 1} / ${conv.dialogue.length}`;

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

    try {
      window.speechSynthesis.speak(utterance);
    } catch(e) {
      stopAudio();
    }
  }
  speakLine();
}

// CORRECCIÓN APLICADA AQUÍ
function updateAudioUI(playing) {
  const btnText = document.getElementById("btn-play-text");
  const iconWrapper = document.getElementById("play-icon-wrapper");
  const statusText = document.getElementById("audio-status");

  if (playing) {
    btnText.textContent = "Reproduciendo...";
    iconWrapper.innerHTML = `<i data-lucide="volume-2" class="w-6 h-6 fill-current"></i>`;
    statusText.innerHTML = `<span id="status-indicator" class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-ping"></span> Reproduciendo diálogo en japonés`;
  } else {
    btnText.textContent = "Reproducir Diálogo";
    iconWrapper.innerHTML = `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
    statusText.innerHTML = `<span id="status-indicator" class="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span> Listo para escuchar`;
  }
  lucide.createIcons();
}

// --- 3. RENDERIZADO DE INTERFAZ ---
function renderCurrentConversation() {
  const conv = conversations.find(c => c.id === currentConvId);
  if (!conv) return;
  userAnswers = {};

  document.getElementById("label-category").textContent = `${conv.category} > ${conv.subcategory || 'General'}`;
  document.getElementById("label-difficulty").textContent = conv.difficulty || "N5";
  document.getElementById("conv-title").textContent = conv.title;
  document.getElementById("current-badge").textContent = `${conv.category} • ${conv.dialogue.length} intervenciones`;

  const transcriptBox = document.getElementById("transcript-box");
  transcriptBox.innerHTML = conv.dialogue.map(line => `
    <div class="flex items-start gap-2.5">
      <span class="font-bold text-slate-700 min-w-[75px] text-xs uppercase tracking-wide bg-slate-200/80 px-2 py-0.5 rounded text-center flex-shrink-0">${line.speaker}:</span>
      <span class="text-slate-800 text-base leading-relaxed">${line.html || line.text}</span>
    </div>
  `).join("");

  transcriptBox.classList.add("hidden");
  document.getElementById("furigana-switch-container").classList.add("hidden");
  document.getElementById("transcript-toggle-text").textContent = "Ver Transcripción en Japonés";

  renderQuestions(conv);
  updateScoreBadge();
  lucide.createIcons();
}

function renderQuestions(conv) {
  const container = document.getElementById("questions-container");
  container.innerHTML = "";

  if (!conv.questions || conv.questions.length === 0) {
    container.innerHTML = `<div class="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">No hay preguntas asociadas a esta conversación.</div>`;
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

  if (question.explanation) {
    expDiv.innerHTML = `<strong>Explicación:</strong> ${question.explanation}`;
    expDiv.classList.remove("hidden");
  }
  updateScoreBadge();
  lucide.createIcons();
}

function updateScoreBadge() {
  const conv = conversations.find(c => c.id === currentConvId);
  if (!conv || !conv.questions) return;
  document.getElementById("score-counter").textContent = `${Object.keys(userAnswers).length} / ${conv.questions.length} Respondidas`;
}

function renderCategoriesDrawer(filterText = "") {
  const container = document.getElementById("dialogues-tree");
  container.innerHTML = "";
  document.getElementById("total-convs-counter").textContent = `${conversations.length} diálogos en total`;

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
  lucide.createIcons();
}

// --- 4. EVENTOS ---
function setupEventListeners() {
  document.getElementById("btn-play-audio").addEventListener("click", () => isPlaying ? stopAudio() : playFullConversation());
  document.getElementById("btn-stop-audio").addEventListener("click", stopAudio);

  document.querySelectorAll(".btn-speed").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".btn-speed").forEach(b => b.className = "btn-speed cursor-pointer text-xs px-2.5 py-1 rounded-lg font-bold text-slate-600 hover:bg-slate-100");
      e.target.className = "btn-speed cursor-pointer text-xs px-2.5 py-1 rounded-lg font-bold bg-rose-500 text-white shadow-sm";
      selectedPlaybackSpeed = parseFloat(e.target.dataset.speed);
    });
  });

  const transcriptBox = document.getElementById("transcript-box");
  const furiganaSwitch = document.getElementById("furigana-switch-container");
  
  document.getElementById("btn-toggle-transcript").addEventListener("click", () => {
    if (transcriptBox.classList.contains("hidden")) {
      transcriptBox.classList.remove("hidden");
      furiganaSwitch.classList.remove("hidden");
      furiganaSwitch.classList.add("flex");
      document.getElementById("transcript-toggle-text").textContent = "Ocultar Transcripción";
    } else {
      transcriptBox.classList.add("hidden");
      furiganaSwitch.classList.add("hidden");
      furiganaSwitch.classList.remove("flex");
      document.getElementById("transcript-toggle-text").textContent = "Ver Transcripción en Japonés";
    }
  });

  document.getElementById("check-furigana").addEventListener("change", (e) => {
    e.target.checked ? transcriptBox.classList.remove("hide-furigana") : transcriptBox.classList.add("hide-furigana");
  });

  const menuDrawer = document.getElementById("menu-drawer");
  document.getElementById("btn-toggle-menu").addEventListener("click", () => {
    renderCategoriesDrawer();
    menuDrawer.classList.remove("hidden");
  });
  document.getElementById("btn-close-menu").addEventListener("click", () => menuDrawer.classList.add("hidden"));
  document.getElementById("search-input").addEventListener("input", (e) => renderCategoriesDrawer(e.target.value));

  document.getElementById("dialogues-tree").addEventListener("click", (e) => {
    const headerBtn = e.target.closest("[data-category-header]");
    if (headerBtn) {
      const cat = headerBtn.getAttribute("data-category-header");
      openCategories.has(cat) ? openCategories.delete(cat) : openCategories.add(cat);
      renderCategoriesDrawer(document.getElementById("search-input").value);
      return;
    }
    const convBtn = e.target.closest("[data-conv-id]");
    if (convBtn) {
      stopAudio();
      currentConvId = convBtn.getAttribute("data-conv-id");
      renderCurrentConversation();
      menuDrawer.classList.add("hidden");
    }
  });
}

// INICIALIZACIÓN
window.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadApp(); // Nuevo motor de carga
  lucide.createIcons();
});
