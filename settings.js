const SETTINGS_KEY = "leaddesk-settings-v1";
const STORAGE_KEY = "leaddesk-state-v1";

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

const els = {
  endpointInput: document.querySelector("#endpointInput"),
  firstMessageTemplate: document.querySelector("#firstMessageTemplate"),
  followUpMessageTemplate: document.querySelector("#followUpMessageTemplate"),
  statusNames: document.querySelector("#statusNames"),
  dynamicFields: document.querySelector("#dynamicFields"),
  detectFieldsBtn: document.querySelector("#detectFieldsBtn"),
  detectNotice: document.querySelector("#detectNotice"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsNotice: document.querySelector("#settingsNotice"),
  syncDot: document.querySelector("#syncDot"),
  syncLabel: document.querySelector("#syncLabel"),
  syncHelp: document.querySelector("#syncHelp"),
};

let settings = loadSettings();

function loadSettings() {
  const defaults = {
    endpoint: "",
    firstTemplate: defaultFirstTemplate,
    followUpTemplate: defaultFollowUpTemplate,
    statuses: defaultStatuses,
    dynamicFields: [],
  };
  const saved = localStorage.getItem(SETTINGS_KEY);
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

function dynamicFieldsToText(fields) {
  return normalizeDynamicFields(fields)
    .map((field) => `${field.key} | ${field.label}`)
    .join("\n");
}

function normalizeStatuses(value) {
  const statuses = Array.isArray(value) ? value : String(value || "").split(/\n|,/);
  const cleaned = statuses.map((status) => status.trim()).filter(Boolean);
  return cleaned.length ? cleaned : defaultStatuses;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { leads: [] };
  try {
    const parsed = JSON.parse(saved);
    return { leads: Array.isArray(parsed.leads) ? parsed.leads : [] };
  } catch {
    return { leads: [] };
  }
}

function render() {
  const connected = Boolean(settings.endpoint);
  els.endpointInput.value = settings.endpoint;
  els.firstMessageTemplate.value = settings.firstTemplate;
  els.followUpMessageTemplate.value = settings.followUpTemplate;
  els.statusNames.value = settings.statuses.join("\n");
  els.dynamicFields.value = dynamicFieldsToText(settings.dynamicFields);
  els.syncDot.classList.toggle("online", connected);
  els.syncLabel.textContent = connected ? "Google Sheet" : "Locale";
  els.syncHelp.textContent = connected ? "Dashboard in sync automatico" : "Configura l'endpoint Apps Script";
}

els.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  settings = {
    endpoint: els.endpointInput.value.trim(),
    firstTemplate: els.firstMessageTemplate.value.trim() || defaultFirstTemplate,
    followUpTemplate: els.followUpMessageTemplate.value.trim() || defaultFollowUpTemplate,
    statuses: normalizeStatuses(els.statusNames.value),
    dynamicFields: normalizeDynamicFields(els.dynamicFields.value),
  };

  const state = loadState();
  state.leads = state.leads.map((lead) => ({
    ...lead,
    status: settings.statuses.includes(lead.status) ? lead.status : settings.statuses[0],
  }));

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.settingsNotice.textContent = "Configurazione salvata";
  render();
});

els.detectFieldsBtn.addEventListener("click", async () => {
  const endpoint = els.endpointInput.value.trim();
  if (!endpoint) {
    els.detectNotice.textContent = "Inserisci prima l'endpoint";
    return;
  }

  els.detectNotice.textContent = "Rilevo...";
  try {
    const response = await fetch(`${endpoint}?action=listLeads`);
    const data = await response.json();
    const lead = Array.isArray(data.leads) ? data.leads[0] : null;
    const raw = lead && lead._raw ? lead._raw : {};
    const excluded = new Set([
      "id",
      "lead_id",
      "lead id",
      "leadid",
      "createdat",
      "created_time",
      "created time",
      "timestamp",
      "name",
      "full_name",
      "full name",
      "nome",
      "phone",
      "phone_number",
      "phone number",
      "telefono",
      "email",
      "email_address",
      "campaign",
      "campaign_name",
      "campaign name",
      "campagna",
      "source",
      "platform",
      "city",
      "citta",
      "status",
      "stato",
      "notes",
      "note",
      "updatedat",
      "updated_at",
      "whatsappcount",
      "whatsapp_count",
    ]);
    const detected = Object.keys(raw)
      .filter((key) => !excluded.has(key.trim().toLowerCase()))
      .map((key) => ({ key, label: humanizeField(key) }));

    settings.dynamicFields = detected;
    els.dynamicFields.value = dynamicFieldsToText(detected);
    els.detectNotice.textContent = detected.length ? `${detected.length} campi trovati` : "Nessun campo extra trovato";
  } catch {
    els.detectNotice.textContent = "Rilevamento non riuscito";
  }
});

function humanizeField(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

render();
