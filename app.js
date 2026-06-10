const STORAGE_KEY = "leaddesk-state-v1";
const SETTINGS_KEY = "leaddesk-settings-v1";

const defaultStatuses = [
  "Nuovo",
  "Da contattare",
  "Contattato",
  "Appuntamento fissato",
  "Non interessato",
  "Chiuso",
];

const defaultFirstTemplate = "Ciao {{nome}}, ti contatto per la richiesta che hai inviato su {{campagna}}. Quando ti sarebbe comodo sentirci?";
const defaultFollowUpTemplate = "Ciao {{nome}}, ti riscrivo per sapere se hai avuto modo di valutare la nostra proposta. Rimango a disposizione.";

const demoLeads = [
  {
    id: "LD-1008",
    createdAt: "2026-06-09T09:42:00+02:00",
    name: "Giulia Romano",
    phone: "+393491234567",
    email: "giulia.romano@example.com",
    campaign: "Consulenza gratuita - Meta",
    source: "Facebook Lead Ads",
    city: "Milano",
    interest: "Pacchetto premium",
    status: "Nuovo",
    notes: "",
    whatsappCount: 0,
  },
  {
    id: "LD-1007",
    createdAt: "2026-06-09T08:18:00+02:00",
    name: "Marco Bianchi",
    phone: "+393331112233",
    email: "marco.bianchi@example.com",
    campaign: "Preventivo rapido",
    source: "Instagram Lead Ads",
    city: "Roma",
    interest: "Richiesta prezzi",
    status: "Da contattare",
    notes: "Preferisce essere contattato nel pomeriggio.",
    whatsappCount: 0,
  },
  {
    id: "LD-1006",
    createdAt: "2026-06-08T17:05:00+02:00",
    name: "Sara Conti",
    phone: "+393487778899",
    email: "sara.conti@example.com",
    campaign: "Demo prodotto",
    source: "Facebook Lead Ads",
    city: "Torino",
    interest: "Demo online",
    status: "Appuntamento fissato",
    notes: "Call fissata per mercoledi alle 11:00.",
    whatsappCount: 1,
  },
  {
    id: "LD-1005",
    createdAt: "2026-06-08T14:36:00+02:00",
    name: "Luca Esposito",
    phone: "+393208887766",
    email: "luca.esposito@example.com",
    campaign: "Consulenza gratuita - Meta",
    source: "Instagram Lead Ads",
    city: "Napoli",
    interest: "Da valutare",
    status: "Contattato",
    notes: "Ha chiesto dettagli via WhatsApp.",
    whatsappCount: 1,
  },
];

const els = {
  leadList: document.querySelector("#leadList"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  refreshBtn: document.querySelector("#refreshBtn"),
  syncDot: document.querySelector("#syncDot"),
  syncLabel: document.querySelector("#syncLabel"),
  syncHelp: document.querySelector("#syncHelp"),
  metricNew: document.querySelector("#metricNew"),
  metricContact: document.querySelector("#metricContact"),
  metricMeeting: document.querySelector("#metricMeeting"),
  metricClosed: document.querySelector("#metricClosed"),
  metricNewLabel: document.querySelector("#metricNewLabel"),
  metricContactLabel: document.querySelector("#metricContactLabel"),
  metricMeetingLabel: document.querySelector("#metricMeetingLabel"),
  metricClosedLabel: document.querySelector("#metricClosedLabel"),
};

let state = loadState();
let settings = loadSettings();
let selectedId = state.leads[0]?.id || null;
let refreshTimer = null;
let autosaveTimers = {};
let activeEditUntil = 0;

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { leads: demoLeads };
  try {
    const parsed = JSON.parse(saved);
    const leads = Array.isArray(parsed.leads) ? parsed.leads : demoLeads;
    return { leads: leads.map((lead) => ({ whatsappCount: 0, ...lead })) };
  } catch {
    return { leads: demoLeads };
  }
}

function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  const defaults = {
    endpoint: "",
    firstTemplate: defaultFirstTemplate,
    followUpTemplate: defaultFollowUpTemplate,
    statuses: defaultStatuses,
  };

  if (!saved) return defaults;

  try {
    const parsed = JSON.parse(saved);
    return {
      ...defaults,
      ...parsed,
      firstTemplate: parsed.firstTemplate || parsed.template || defaultFirstTemplate,
      followUpTemplate: parsed.followUpTemplate || defaultFollowUpTemplate,
      statuses: normalizeStatuses(parsed.statuses),
    };
  } catch {
    return defaults;
  }
}

function normalizeStatuses(value) {
  const statuses = Array.isArray(value) ? value : String(value || "").split(/\n|,/);
  const cleaned = statuses.map((status) => status.trim()).filter(Boolean);
  return cleaned.length ? cleaned : defaultStatuses;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getContactedStatus() {
  return settings.statuses.find((status) => status.toLowerCase().includes("contatt")) || settings.statuses[2] || settings.statuses[0];
}

function getStatusTone(status) {
  const index = settings.statuses.indexOf(status);
  return ["new", "todo", "contacted", "meeting", "lost", "closed"][index] || "custom";
}

function filteredLeads() {
  const query = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  return state.leads
    .filter((lead) => !status || lead.status === status)
    .filter((lead) => {
      if (!query) return true;
      return [lead.name, lead.phone, lead.email, lead.campaign, lead.city, lead.interest]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function render() {
  renderSync();
  renderFilters();
  renderMetrics();
  renderList();
}

function renderSync() {
  const connected = Boolean(settings.endpoint);
  els.syncDot.classList.toggle("online", connected);
  els.syncLabel.textContent = connected ? "Google Sheet" : "Locale";
  els.syncHelp.textContent = connected ? "Autosave attivo, sync ogni 15 secondi" : "Configura l'endpoint Apps Script";
}

function renderFilters() {
  const current = els.statusFilter.value;
  els.statusFilter.innerHTML = '<option value="">Tutti</option>';
  settings.statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    option.selected = status === current;
    els.statusFilter.appendChild(option);
  });
}

function renderMetrics() {
  const statuses = settings.statuses;
  const contacted = getContactedStatus();
  els.metricNewLabel.textContent = statuses[0] || "Nuovi";
  els.metricContactLabel.textContent = contacted;
  els.metricMeetingLabel.textContent = statuses[3] || "Appuntamenti";
  els.metricClosedLabel.textContent = statuses[5] || "Chiusi";
  els.metricNew.textContent = countStatus(statuses[0]);
  els.metricContact.textContent = countStatus(contacted);
  els.metricMeeting.textContent = countStatus(statuses[3]);
  els.metricClosed.textContent = countStatus(statuses[5]);
}

function countStatus(status) {
  if (!status) return 0;
  return state.leads.filter((lead) => lead.status === status).length;
}

function renderList() {
  els.leadList.innerHTML = "";
  const template = document.querySelector("#leadCardTemplate");
  const leads = filteredLeads();

  if (!leads.length) {
    els.leadList.innerHTML = '<div class="detail-panel"><p>Nessun lead trovato con questi filtri.</p></div>';
    return;
  }

  leads.forEach((lead) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".lead-card");
    const summary = node.querySelector(".lead-summary");
    const expanded = node.querySelector(".lead-expanded");
    const tone = getStatusTone(lead.status);

    card.dataset.id = lead.id;
    card.dataset.statusTone = tone;
    card.classList.toggle("selected", lead.id === selectedId);
    node.querySelector(".lead-status").textContent = lead.status;
    node.querySelector(".lead-name").textContent = lead.name;
    node.querySelector(".lead-meta").textContent = `${formatDate(lead.createdAt)} - ${lead.phone}`;
    node.querySelector(".lead-campaign").textContent = lead.campaign;
    node.querySelector(".expand-icon").textContent = lead.id === selectedId ? "-" : "+";

    summary.addEventListener("click", () => {
      selectedId = selectedId === lead.id ? null : lead.id;
      render();
    });

    if (lead.id === selectedId) {
      expanded.innerHTML = renderExpanded(lead);
      attachExpandedEvents(expanded, lead.id);
    }

    els.leadList.appendChild(node);
  });
}

function renderExpanded(lead) {
  const firstMessage = Number(lead.whatsappCount || 0) === 0;
  const whatsappUrl = buildWhatsappUrl(lead);
  return `
    <div class="detail-grid">
      ${field("Telefono", lead.phone)}
      ${field("Email", lead.email)}
      ${field("Citta", lead.city)}
      ${field("Fonte", lead.source)}
      ${field("Interesse", lead.interest)}
      ${field("Arrivato", formatDate(lead.createdAt))}
    </div>

    <div class="inline-form">
      <label>
        <span>Stato lead</span>
        <select data-role="status">
          ${settings.statuses
            .map((status) => `<option value="${escapeHtml(status)}" ${status === lead.status ? "selected" : ""}>${escapeHtml(status)}</option>`)
            .join("")}
        </select>
      </label>
      <label>
        <span>Messaggio da usare</span>
        <select data-role="message-kind">
          <option value="first" ${firstMessage ? "selected" : ""}>Primo messaggio</option>
          <option value="followup" ${firstMessage ? "" : "selected"}>Follow-up</option>
        </select>
      </label>
    </div>

    <label>
      <span>Note interne</span>
      <textarea data-role="notes" rows="5" placeholder="Aggiungi note, prossimi step, preferenze...">${escapeHtml(lead.notes || "")}</textarea>
    </label>

    <div class="actions">
      <a class="whatsapp" data-role="whatsapp" href="${whatsappUrl}" target="_blank" rel="noopener">Scrivi su WhatsApp</a>
      <span class="notice" data-role="notice">Salvataggio automatico attivo</span>
    </div>`;
}

function attachExpandedEvents(container, id) {
  const status = container.querySelector('[data-role="status"]');
  const notes = container.querySelector('[data-role="notes"]');
  const messageKind = container.querySelector('[data-role="message-kind"]');
  const whatsapp = container.querySelector('[data-role="whatsapp"]');
  const notice = container.querySelector('[data-role="notice"]');

  const updateWhatsappHref = () => {
    const lead = readLeadDraft(id, container);
    whatsapp.href = buildWhatsappUrl(lead, messageKind.value);
  };

  status.addEventListener("change", () => {
    activeEditUntil = Date.now() + 4000;
    notice.textContent = "Salvataggio...";
    const card = container.closest(".lead-card");
    const badge = card?.querySelector(".lead-status");
    if (card) card.dataset.statusTone = getStatusTone(status.value);
    if (badge) badge.textContent = status.value;
    updateLocalLead(id, container);
    renderMetrics();
    updateWhatsappHref();
    scheduleAutosave(id, container, 150);
  });
  notes.addEventListener("input", () => {
    activeEditUntil = Date.now() + 4000;
    notice.textContent = "Salvataggio...";
    updateLocalLead(id, container);
    scheduleAutosave(id, container, 900);
  });
  messageKind.addEventListener("change", updateWhatsappHref);
  whatsapp.addEventListener("click", async (event) => {
    event.preventDefault();
    const url = whatsapp.href;
    const popup = window.open("about:blank", "_blank", "noopener");
    await markLeadContacted(id, container);
    if (popup) {
      popup.location.href = url;
    } else {
      window.location.href = url;
    }
  });
}

function readLeadDraft(id, container) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return null;
  return {
    ...lead,
    status: container.querySelector('[data-role="status"]').value,
    notes: container.querySelector('[data-role="notes"]').value,
  };
}

function updateLocalLead(id, container) {
  const draft = readLeadDraft(id, container);
  if (!draft) return null;
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return null;
  Object.assign(lead, draft, { updatedAt: new Date().toISOString() });
  persist();
  return lead;
}

function field(label, value) {
  return `<div class="field"><small>${label}</small><strong>${escapeHtml(value || "-")}</strong></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildWhatsappUrl(lead, forcedKind) {
  const kind = forcedKind || (Number(lead.whatsappCount || 0) === 0 ? "first" : "followup");
  const template = kind === "followup" ? settings.followUpTemplate : settings.firstTemplate;
  const text = template
    .replaceAll("{{nome}}", lead.name || "")
    .replaceAll("{{campagna}}", lead.campaign || "")
    .replaceAll("{{interesse}}", lead.interest || "");
  return `https://wa.me/${normalizePhone(lead.phone)}?text=${encodeURIComponent(text)}`;
}

async function markLeadContacted(id, container) {
  const lead = state.leads.find((item) => item.id === id);
  const status = container.querySelector('[data-role="status"]');
  status.value = getContactedStatus();
  activeEditUntil = Date.now() + 4000;
  if (lead) {
    lead.whatsappCount = Number(lead.whatsappCount || 0) + 1;
    persist();
  }
  const card = container.closest(".lead-card");
  const badge = card?.querySelector(".lead-status");
  if (card) card.dataset.statusTone = getStatusTone(status.value);
  if (badge) badge.textContent = status.value;
  await saveLead(id, container, "Lead segnato come contattato");
}

async function saveLead(id, container, successMessage) {
  const lead = updateLocalLead(id, container);
  if (!lead) return;
  const notice = container.querySelector('[data-role="notice"]');
  notice.textContent = successMessage;

  if (settings.endpoint) {
    try {
      await fetch(settings.endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "updateLead", lead }),
      });
      notice.textContent = "Inviato al Google Sheet";
    } catch (error) {
      notice.textContent = "Salvato localmente, invio non riuscito";
    }
  } else {
    notice.textContent = "Salvato localmente";
  }

  renderMetrics();
}

function scheduleAutosave(id, container, delay) {
  window.clearTimeout(autosaveTimers[id]);
  autosaveTimers[id] = window.setTimeout(() => {
    saveLead(id, container, "Salvataggio automatico...");
  }, delay);
}

async function refreshLeads(silent = false) {
  if (!settings.endpoint) {
    render();
    return;
  }
  if (silent && Date.now() < activeEditUntil) return;

  if (!silent) els.refreshBtn.textContent = "Aggiorno...";
  try {
    const response = await fetch(`${settings.endpoint}?action=listLeads`);
    const data = await response.json();
    if (Array.isArray(data.leads)) {
      const previousSelected = selectedId;
      state.leads = data.leads.map((lead) => ({ whatsappCount: 0, ...lead }));
      selectedId = state.leads.some((lead) => lead.id === previousSelected) ? previousSelected : state.leads[0]?.id || null;
      persist();
    }
  } catch {
    els.syncHelp.textContent = "Lettura non riuscita, uso dati locali";
  } finally {
    if (!silent) els.refreshBtn.textContent = "Aggiorna";
    render();
  }
}

function startRealtimeSync() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  if (!settings.endpoint) return;
  refreshLeads(true);
  refreshTimer = window.setInterval(() => refreshLeads(true), 15000);
}

els.searchInput.addEventListener("input", render);
els.statusFilter.addEventListener("change", render);
els.refreshBtn.addEventListener("click", () => refreshLeads(false));

render();
startRealtimeSync();
