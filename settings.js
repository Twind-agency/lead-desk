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

render();
