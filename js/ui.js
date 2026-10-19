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
  updateElementText("btn-play-text", playing ? "Reproduciendo..." : "Reproducir Diálogo");
  
  const iconWrapper = document.getElementById("play-icon-wrapper");
  if (iconWrapper) iconWrapper.innerHTML = playing ? `<i data-lucide="volume-2" class="w-6 h-6 fill-current"></i>` : `<i data-lucide="play" class="w-6 h-6 fill-current"></i>`;
  
  const statusText = document.getElementById("audio-status");
  if (statusText) {
    const indicatorClass = playing ? "bg-emerald-500 animate-ping" : "bg-slate-400";
    const text = playing ? "Reproduciendo diálogo" : "Listo para escuchar";
    statusText.innerHTML = `<span id="status-indicator" class="w-2.5 h-2.5 rounded-full ${indicatorClass} inline-block"></span> ${text}`;
  }
  refreshIcons();
}

export function updateScoreBadge() {
  const conv = state.conversations.find(c => c.id === state.currentConvId);
  if (conv && conv.questions) {
    updateElementText("score-counter", `${Object.keys(state.userAnswers).length} / ${conv.questions.length} Respondidas`);
  }
}

export function renderCurrentConversation() {
  const conv = state.conversations.find(c => c.id === state.currentConvId);
  if (!conv) return;
  state.userAnswers = {};

  updateElementText("label-category", `${conv.category} > ${conv.subcategory || 'General'}`);
  updateElementText("label-difficulty", conv.difficulty || "N5");
  updateElementText("conv-title", conv.title);
  updateElementText("current-badge", `${conv.category} • ${conv.dialogue.length} intervenciones`);

  renderTranscript(conv.dialogue);
  renderQuestions(conv);
  updateScoreBadge();
  refreshIcons();
}

function renderTranscript(dialogue) {
  const transcriptBox = document.getElementById("transcript-box");
  if (!transcriptBox) return;

  transcriptBox.innerHTML = dialogue.map(line => `
    <div class="flex flex-col gap-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <div class="flex items-start gap-2.5">
        <span class="font-bold text-slate-700 min-w-[75px] text-xs uppercase tracking-wide bg-slate-200/80 px-2 py-0.5 rounded text-center flex-shrink-0">${line.speaker}:</span>
        <span class="text-slate-800 text-base leading-relaxed">${line.html || line.text}</span>
      </div>
      ${line.translation ? `<div class="dialogue-translation text-xs text-slate-500 pl-[85px] leading-normal italic">${line.translation}</div>` : ''}
    </div>
  `).join("");
  
  transcriptBox.classList.add("hidden");
  
  const controls = document.getElementById("transcript-controls");
  if (controls) controls.classList.add("hidden");

  updateElementText("transcript-toggle-text", "Ver Transcripción en Japonés");
}

function renderQuestions(conv) {
  const container = document.getElementById("questions-container");
  if (!container) return;
  container.innerHTML = "";

  if (!conv.questions || conv.questions.length === 0) {
    container.innerHTML = `<div class="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">No hay preguntas en esta conversación.</div>`;
    return;
  }

  conv.questions.forEach((q, index) => {
    container.appendChild(createQuestionCard(q, index));
  });
}

function createQuestionCard(q, index) {
  const qCard = document.createElement("div");
  qCard.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3";

  const qTitle = document.createElement("h4");
  qTitle.className = "font-bold text-slate-900 text-sm md:text-base flex items-start gap-2";
  qTitle.innerHTML = `<span class="bg-rose-100 text-rose-700 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">${index + 1}</span> ${q.question}`;
  qCard.appendChild(qTitle);

  const optionsDiv = document.createElement("div");
  optionsDiv.className = "space-y-2 mt-1";

  q.options.forEach((opt, optIndex) => {
    const btnOpt = document.createElement("button");
    btnOpt.className = "cursor-pointer w-full text-left p-3.5 rounded-xl border text-sm font-medium transition-all active:scale-[0.99] flex items-center justify-between border-slate-200 hover:bg-slate-50 text-slate-700";
    btnOpt.innerHTML = `<span>${opt}</span><span class="icon-indicator"></span>`;
    btnOpt.addEventListener("click", () => handleSelectOption(q, optIndex, qCard));
    optionsDiv.appendChild(btnOpt);
  });

  qCard.appendChild(optionsDiv);

  const expDiv = document.createElement("div");
  expDiv.id = `exp-${q.id}`;
  expDiv.className = "hidden mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed";
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
      btn.className = "w-full text-left p-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm";
      btn.querySelector(".icon-indicator").innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-600 pointer-events-none"></i>`;
    } else if (idx === selectedIndex && !isCorrect) {
      btn.className = "w-full text-left p-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between border-rose-500 bg-rose-50 text-rose-900 shadow-sm";
      btn.querySelector(".icon-indicator").innerHTML = `<i data-lucide="x" class="w-4 h-4 text-rose-600 pointer-events-none"></i>`;
    } else {
      btn.className = "w-full text-left p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between border-slate-100 bg-slate-50 text-slate-400 opacity-60";
    }
  });

  const expDiv = cardElement.querySelector(`#exp-${question.id}`);
  if (question.explanation && expDiv) {
    expDiv.innerHTML = `<strong>Explicación:</strong> ${question.explanation}`;
    expDiv.classList.remove("hidden");
  }
  
  updateScoreBadge();
  refreshIcons();
}

export function renderCategoriesDrawer(filterText = "") {
  const container = document.getElementById("dialogues-tree");
  if (!container) return;
  container.innerHTML = "";
  updateElementText("total-convs-counter", `${state.conversations.length} diálogos en total`);

  const groups = groupConversations(filterText);

  for (const [catName, subCats] of Object.entries(groups)) {
    const isExpanded = filterText !== "" || state.openCategories.has(catName);
    const groupDiv = buildAccordionGroup(catName, subCats, isExpanded);
    container.appendChild(groupDiv);
  }
  refreshIcons();
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

function buildAccordionGroup(catName, subCats, isExpanded) {
  let countInCat = Object.values(subCats).reduce((acc, items) => acc + items.length, 0);

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
        const isSelected = conv.id === state.currentConvId;
        const btn = document.createElement("button");
        btn.setAttribute("data-conv-id", conv.id);
        btn.className = `cursor-pointer w-full text-left p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all my-1 ${isSelected ? "bg-rose-500 text-white shadow-sm" : "hover:bg-slate-100 text-slate-700"}`;
        btn.innerHTML = `
          <div class="truncate pr-2 pointer-events-none">
            <div class="font-bold truncate text-[13px]">${conv.title}</div>
            <div class="text-[10px] opacity-75 mt-0.5">${conv.difficulty}</div>
          </div>
          <i data-lucide="chevron-right" class="w-4 h-4 flex-shrink-0 pointer-events-none ${isSelected ? 'text-white' : 'text-slate-400'}"></i>
        `;
        subWrapper.appendChild(btn);
      });
      bodyDiv.appendChild(subWrapper);
    }
    groupDiv.appendChild(bodyDiv);
  }
  return groupDiv;
}