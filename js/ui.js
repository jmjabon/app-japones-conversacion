import { state } from './state.js';

export function logDebug(msg) {
  const box = document.getElementById('debug-box');
  if (box) box.innerHTML += '<br>🔹 ' + msg;
}

export function updateElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function applyEnvironmentSettings(environment) {
  const env = environment || "dev";
  const debugBox = document.getElementById("debug-box-container");
  if (env === "prod" && debugBox) {
    debugBox.style.display = "none";
  }
}

export function refreshIcons() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

export function updateAudioUI(playing) {
  updateElementText("btn-play-text", playing ? "Reproduciendo..." : "Escuchar");
  
  const playBtn = document.getElementById("btn-play-audio");
  if (playBtn) {
    const iconElement = playBtn.querySelector("i");
    if (iconElement) {
      iconElement.setAttribute("data-lucide", playing ? "volume-2" : "play");
    }
  }
  
  const statusText = document.getElementById("audio-status");
  if (statusText) {
    const indicatorClass = playing ? "bg-[#FF2D55] animate-ping" : "bg-slate-300";
    const text = playing ? "Reproduciendo..." : "Listo";
    statusText.innerHTML = `<span id="status-indicator" class="w-2 h-2 rounded-full ${indicatorClass} inline-block"></span> ${text}`;
  }
  refreshIcons();
}

export function updateScoreBadge() {
  const conv = state.conversations.find(c => c.id === state.currentConvId);
  if (conv && conv.questions) {
    updateElementText("score-counter", `${Object.keys(state.userAnswers).length} / ${conv.questions.length}`);
  }
}

export function renderCurrentConversation() {
  const conv = state.conversations.find(c => c.id === state.currentConvId);
  if (!conv) return;
  state.userAnswers = {};

  updateElementText("label-difficulty", conv.difficulty || "N5");
  updateElementText("conv-title", conv.title);

  renderTranscript(conv.dialogue);
  renderQuestions(conv);
  updateScoreBadge();
  refreshIcons();
}

function renderTranscript(dialogue) {
  const transcriptBox = document.getElementById("transcript-box");
  if (!transcriptBox) return;

  transcriptBox.innerHTML = dialogue.map(line => `
    <div class="flex flex-col gap-1 border-b border-[#E5E5EA] pb-3 last:border-0 last:pb-0">
      <div class="flex items-start gap-2.5">
        <span class="font-bold text-slate-500 min-w-[70px] text-[12px] uppercase tracking-wide bg-slate-200/50 px-2 py-0.5 rounded text-center flex-shrink-0 mt-0.5">${line.speaker}:</span>
        <span class="text-slate-900 text-[16px] leading-relaxed font-medium">${line.html || line.text}</span>
      </div>
      ${line.translation ? `<div class="dialogue-translation text-[14px] text-slate-500 pl-[80px] leading-snug">${line.translation}</div>` : ''}
    </div>
  `).join("");
  
  transcriptBox.classList.add("hidden");
  
  const controls = document.getElementById("transcript-controls");
  if (controls) controls.classList.add("hidden");

  updateElementText("transcript-toggle-text", "Transcripción");
}

function renderQuestions(conv) {
  const container = document.getElementById("questions-container");
  if (!container) return;
  container.innerHTML = "";

  if (!conv.questions || conv.questions.length === 0) {
    container.innerHTML = `<div class="p-6 bg-white rounded-[20px] text-center text-slate-500 text-[15px] shadow-sm border border-slate-100">No hay preguntas en este diálogo.</div>`;
    return;
  }

  conv.questions.forEach((q, index) => {
    container.appendChild(createQuestionCard(q, index));
  });
}

function createQuestionCard(q, index) {
  const qCard = document.createElement("div");
  qCard.className = "bg-white p-5 rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col gap-3";

  const qTitle = document.createElement("h4");
  qTitle.className = "font-bold text-slate-900 text-[16px] flex items-start gap-3 leading-snug";
  qTitle.innerHTML = `<span class="bg-[#FF2D55]/10 text-[#FF2D55] w-6 h-6 rounded-full flex items-center justify-center text-[13px] flex-shrink-0 font-bold">${index + 1}</span> <span>${q.question}</span>`;
  qCard.appendChild(qTitle);

  const optionsDiv = document.createElement("div");
  optionsDiv.className = "space-y-2 mt-1";

  q.options.forEach((opt, optIndex) => {
    const btnOpt = document.createElement("button");
    btnOpt.className = "cursor-pointer w-full text-left p-3.5 rounded-xl border text-[15px] font-medium transition-all active:scale-[0.98] flex items-center justify-between border-slate-100 bg-[#F8F8FA] text-slate-700";
    btnOpt.innerHTML = `<span>${opt}</span><span class="icon-indicator"></span>`;
    btnOpt.addEventListener("click", () => handleSelectOption(q, optIndex, qCard));
    optionsDiv.appendChild(btnOpt);
  });

  qCard.appendChild(optionsDiv);

  const expDiv = document.createElement("div");
  expDiv.id = `exp-${q.id}`;
  expDiv.className = "hidden mt-2 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-[14px] text-slate-600 leading-relaxed";
  qCard.appendChild(expDiv);

  return qCard;
}

function handleSelectOption(question, selectedIndex, cardElement) {
  state.userAnswers[question.id] = selectedIndex;
  const isCorrect = selectedIndex === question.correctIndex;
  
  const buttons = cardElement.querySelectorAll("button");
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === question.correctIndex) {
      // Color verde éxito iOS
      btn.className = "w-full text-left p-3.5 rounded-xl border text-[15px] font-semibold flex items-center justify-between border-[#34C759] bg-[#34C759]/10 text-[#248A3D]";
      btn.querySelector(".icon-indicator").innerHTML = `<i data-lucide="check-circle-2" class="w-5 h-5 text-[#34C759] pointer-events-none"></i>`;
    } else if (idx === selectedIndex && !isCorrect) {
      // Color rojo error iOS
      btn.className = "w-full text-left p-3.5 rounded-xl border text-[15px] font-semibold flex items-center justify-between border-[#FF3B30] bg-[#FF3B30]/10 text-[#C93429]";
      btn.querySelector(".icon-indicator").innerHTML = `<i data-lucide="x-circle" class="w-5 h-5 text-[#FF3B30] pointer-events-none"></i>`;
    } else {
      btn.className = "w-full text-left p-3.5 rounded-xl border text-[15px] font-medium flex items-center justify-between border-slate-100 bg-[#F2F2F7] text-slate-400 opacity-50";
    }
  });

  const expDiv = cardElement.querySelector(`#exp-${question.id}`);
  if (question.explanation && expDiv) {
    expDiv.innerHTML = `<strong class="text-slate-900">Explicación:</strong> ${question.explanation}`;
    expDiv.classList.remove("hidden");
  }
  
  updateScoreBadge();
  refreshIcons();
}

function getCategoryIcon(categoryName) {
  const icons = {
    "Restauración": "coffee",
    "Alojamiento": "bed",
    "Comercio": "shopping-bag",
    "Servicios": "building",
    "Trabajo": "briefcase",
    "Conversación": "message-circle"
  };
  return icons[categoryName] || "headphones";
}

function groupConversations(filterText) {
  const groups = {};
  state.conversations.forEach(c => {
    const matches = filterText === "" || 
                    c.title.toLowerCase().includes(filterText.toLowerCase()) || 
                    c.category.toLowerCase().includes(filterText.toLowerCase());
    if (!matches) return;
    
    if (!groups[c.category]) groups[c.category] = {};
    const sub = c.subcategory || "General";
    if (!groups[c.category][sub]) groups[c.category][sub] = [];
    groups[c.category][sub].push(c);
  });
  return groups;
}

export function renderCatalog(filterText = "") {
  const container = document.getElementById("dialogues-tree");
  if (!container) return;

  container.innerHTML = "";
  const groups = groupConversations(filterText);

  if (Object.keys(groups).length === 0) {
    container.innerHTML = `<p class="text-center text-slate-500 mt-10">No se encontraron diálogos.</p>`;
    return;
  }

  // Pintar bloques de iOS Grouped List
  for (const [category, subcategories] of Object.entries(groups)) {
    const iconName = getCategoryIcon(category);
    
    const section = document.createElement("div");
    section.className = "flex flex-col gap-2";
    
    section.innerHTML = `
      <div class="flex items-center gap-2.5 px-2">
        <div class="bg-[#FF2D55] p-1.5 rounded-lg text-white flex items-center justify-center">
          <i data-lucide="${iconName}" class="w-4 h-4"></i>
        </div>
        <h3 class="text-[18px] font-bold text-slate-900 tracking-tight">${category}</h3>
      </div>
    `;

    const listGroup = document.createElement("div");
    listGroup.className = "bg-white rounded-[16px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]";

    let isFirst = true;

    for (const [subCat, dialogues] of Object.entries(subcategories)) {
      dialogues.forEach(dialogue => {
        const item = document.createElement("div");
        item.className = `ios-list-item flex items-center justify-between p-4 cursor-pointer transition-colors ${!isFirst ? 'border-t border-slate-100' : ''}`;
        isFirst = false;
        
        item.innerHTML = `
          <div class="flex flex-col gap-1 pr-4 pointer-events-none">
            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">${subCat}</span>
            <span class="text-[17px] text-slate-900 font-medium leading-tight">${dialogue.title}</span>
            <span class="text-[13px] text-[#FF2D55] mt-0.5">${dialogue.difficulty}</span>
          </div>
          <i data-lucide="chevron-right" class="w-5 h-5 text-slate-300 flex-shrink-0 pointer-events-none"></i>
        `;

        item.addEventListener("click", () => {
          // Disparar el cambio a la vista de reproductor
          window.dispatchEvent(new CustomEvent("loadDialogue", { detail: dialogue }));
        });

        listGroup.appendChild(item);
      });
    }

    section.appendChild(listGroup);
    container.appendChild(section);
  }

  refreshIcons();
}