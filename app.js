const STORAGE_KEY = "leaddesk-state-v1";
const SETTINGS_KEY = "leaddesk-settings-v1";
const SYNC_INTERVAL_MS = 60000;

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
let selectedId = null;
let refreshTimer = null;
let autosaveTimers = {};
let activeEditUntil = 0;
let pendingUpdates = {};

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
    dynamicFields: [],
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
      dynamicFields: normalizeDynamicFields(parsed.dynamicFields),
    };
  } catch {
    return defaults;
  }
}

function normalizeDynamicFields(value) {
  if (Array.isArray(value)) {
    return value
      .map((field) => ({
        key: String(field.key || "").trim(),
        label: String(field.label || field.key || "").trim(),
      }))
      .filter((field) => field.key);
  }

  return String(value || "")
    .split(/\n/)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return { key: parts[0] || "", label: parts[1] || parts[0] || "" };
    })
    .filter((field) => field.key);
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
  els.syncHelp.textContent = connected ? "Autosave attivo, controllo nuovi lead ogni 60 secondi" : "Configura l'endpoint Apps Script";
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
    const toggle = node.querySelector(".lead-toggle");
    const expandButton = node.querySelector(".expand-icon");
    const quickStatus = node.querySelector(".quick-status");
    const quickWhatsapp = node.querySelector(".compact-whatsapp");
    const expanded = node.querySelector(".lead-expanded");
    const tone = getStatusTone(lead.status);

    card.dataset.id = lead.id;
    card.dataset.statusTone = tone;
    card.classList.toggle("selected", lead.id === selectedId);
    node.querySelector(".lead-status").textContent = lead.status;
    node.querySelector(".lead-name").textContent = lead.name;
    node.querySelector(".lead-meta").textContent = `${formatDate(lead.createdAt)} - ${lead.phone}`;
    node.querySelector(".lead-campaign").textContent = lead.campaign;
    expandButton.textContent = lead.id === selectedId ? "-" : "+";
    quickWhatsapp.href = buildWhatsappUrl(lead);
    quickWhatsapp.innerHTML = `${whatsappIcon()}${Number(lead.whatsappCount || 0) > 0 ? "Riscrivi su WhatsApp" : "Scrivi su WhatsApp"}`;
    quickStatus.innerHTML = settings.statuses
      .map((status) => `<option value="${escapeHtml(status)}" ${status === lead.status ? "selected" : ""}>${escapeHtml(status)}</option>`)
      .join("");

    const toggleExpanded = () => {
      selectedId = selectedId === lead.id ? null : lead.id;
      render();
    };

    toggle.addEventListener("click", toggleExpanded);
    expandButton.addEventListener("click", toggleExpanded);
    quickStatus.addEventListener("change", () => updateLeadFromClosedCard(lead.id, card, quickStatus.value));
    quickWhatsapp.addEventListener("click", async (event) => {
      event.preventDefault();
      const url = quickWhatsapp.href;
      const popup = window.open("about:blank", "_blank", "noopener");
      await markLeadContactedFromCard(lead.id, card);
      if (popup) {
        popup.location.href = url;
      } else {
        window.location.href = url;
      }
    });

    if (lead.id === selectedId) {
      expanded.innerHTML = renderExpanded(lead);
      attachExpandedEvents(expanded, lead.id);
    }

    els.leadList.appendChild(node);
  });
}

function renderExpanded(lead) {
  return `
    <div class="detail-grid">
      ${field("Telefono", lead.phone)}
      ${field("Email", lead.email)}
      ${field("Citta", lead.city)}
      ${field("Fonte", lead.source)}
      ${field("Interesse", lead.interest)}
      ${field("Arrivato", formatDate(lead.createdAt))}
    </div>

    ${renderDynamicFields(lead)}

    <label>
      <span>Note interne</span>
      <textarea data-role="notes" rows="5" placeholder="Aggiungi note, prossimi step, preferenze...">${escapeHtml(lead.notes || "")}</textarea>
    </label>

    <div class="actions">
      <span class="notice" data-role="notice">Salvataggio automatico attivo</span>
    </div>`;
}

function renderDynamicFields(lead) {
  const fields = normalizeDynamicFields(settings.dynamicFields);
  if (!fields.length) return "";

  const rows = fields
    .map((fieldConfig) => {
      const value = getDynamicValue(lead, fieldConfig.key);
      if (value === "") return "";
      return field(fieldConfig.label || fieldConfig.key, value);
    })
    .filter(Boolean)
    .join("");

  if (!rows) return "";

  return `
    <section class="dynamic-fields" aria-label="Risposte form">
      <h3>Risposte form</h3>
      <div class="detail-grid">${rows}</div>
    </section>`;
}

function getDynamicValue(lead, key) {
  const raw = lead._raw || {};
  const direct = raw[key] ?? lead[key];
  if (direct !== undefined && direct !== null && direct !== "") return direct;

  const normalizedKey = String(key || "").trim().toLowerCase();
  const rawKey = Object.keys(raw).find((item) => String(item).trim().toLowerCase() === normalizedKey);
  if (rawKey && raw[rawKey] !== undefined && raw[rawKey] !== null) return raw[rawKey];

  return "";
}

function attachExpandedEvents(container, id) {
  const notes = container.querySelector('[data-role="notes"]');
  const notice = container.querySelector('[data-role="notice"]');
  notes.addEventListener("input", () => {
    activeEditUntil = Date.now() + 4000;
    notice.textContent = "Salvataggio...";
    updateLocalLead(id, container);
    scheduleAutosave(id, container, 900);
  });
}

function readLeadDraft(id, container) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return null;
  return {
    ...lead,
    status: lead.status,
    notes: container.querySelector('[data-role="notes"]').value,
  };
}

async function updateLeadFromClosedCard(id, card, status) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return;
  lead.status = status;
  lead.updatedAt = new Date().toISOString();
  persist();
  activeEditUntil = Date.now() + 4000;
  paintCardStatus(card, status);
  renderMetrics();
  await saveLeadObject(lead);
}

async function markLeadContactedFromCard(id, card) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return;
  lead.status = getContactedStatus();
  lead.whatsappCount = Number(lead.whatsappCount || 0) + 1;
  lead.updatedAt = new Date().toISOString();
  persist();
  activeEditUntil = Date.now() + 4000;
  const quickStatus = card.querySelector(".quick-status");
  if (quickStatus) quickStatus.value = lead.status;
  paintCardStatus(card, lead.status);
  renderMetrics();
  await saveLeadObject(lead);
}

function paintCardStatus(card, status) {
  const badge = card?.querySelector(".lead-status");
  if (card) card.dataset.statusTone = getStatusTone(status);
  if (badge) badge.textContent = status;
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

function whatsappIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="wa-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
  </svg>`;
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
  await saveLeadObject(lead, notice);

  renderMetrics();
}

async function saveLeadObject(lead, notice) {
  if (settings.endpoint) {
    try {
      pendingUpdates[lead.id] = { ...lead, pendingAt: Date.now() };
      const params = new URLSearchParams({
        action: "updateLead",
        payload: JSON.stringify({ lead }),
      });
      const response = await fetch(`${settings.endpoint}?${params.toString()}`);
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "Update failed");
      if (notice) notice.textContent = "Inviato al Google Sheet";
      window.setTimeout(() => refreshLeads(true), 500);
    } catch (error) {
      if (notice) notice.textContent = "Salvato localmente, invio non riuscito";
    }
  } else {
    if (notice) notice.textContent = "Salvato localmente";
  }
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
      state.leads = mergePendingUpdates(data.leads.map((lead) => ({ whatsappCount: 0, ...lead })));
      selectedId = silent ? null : state.leads.some((lead) => lead.id === previousSelected) ? previousSelected : null;
      persist();
    }
  } catch {
    els.syncHelp.textContent = "Lettura non riuscita, uso dati locali";
  } finally {
    if (!silent) els.refreshBtn.textContent = "Aggiorna";
    render();
  }
}

function mergePendingUpdates(sheetLeads) {
  const now = Date.now();
  return sheetLeads.map((sheetLead) => {
    const pending = pendingUpdates[sheetLead.id];
    if (!pending) return sheetLead;

    const sheetMatchesPending = sheetLead.status === pending.status && String(sheetLead.notes || "") === String(pending.notes || "");
    if (sheetMatchesPending) {
      delete pendingUpdates[sheetLead.id];
      return sheetLead;
    }

    if (now - pending.pendingAt < 30000) {
      return { ...sheetLead, ...pending };
    }

    delete pendingUpdates[sheetLead.id];
    return sheetLead;
  });
}

function startRealtimeSync() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  if (!settings.endpoint) return;
  refreshLeads(true);
  refreshTimer = window.setInterval(() => refreshLeads(true), SYNC_INTERVAL_MS);
}

els.searchInput.addEventListener("input", render);
els.statusFilter.addEventListener("change", render);
els.refreshBtn.addEventListener("click", () => refreshLeads(false));

render();
startRealtimeSync();
