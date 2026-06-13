const SHEET_NAME = "Leads";
const PIPELINE_SHEET_NAME = "Pipeline";
const CONFIG_SHEET_NAME = "Config";
const STATUS_COLORS = [
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fee2e2", fg: "#991b1b" },
  { bg: "#e2e8f0", fg: "#334155" },
];

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || "listLeads";
  if (action === "refreshPipeline") {
    updatePipelineSummary();
    return jsonOutput({ ok: true });
  }
  if (action === "updateLead") {
    const payload = JSON.parse(params.payload || "{}");
    return updateLead(payload.lead || payload);
  }
  if (action === "saveConfig") {
    const payload = JSON.parse(params.payload || "{}");
    return saveConfig(payload.config || payload);
  }
  if (action !== "listLeads") {
    return jsonOutput({ error: "Unsupported action" });
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonOutput({
      error: "Missing sheet",
      message: "Create a sheet named '" + SHEET_NAME + "' or change SHEET_NAME in Apps Script.",
      leads: [],
    });
  }
  const values = sheet.getDataRange().getValues();
  if (!values.length || !values[0].length) {
    return jsonOutput({ leads: [] });
  }
  const headers = values.shift();
  const leads = values
    .filter((row) => row.some(Boolean))
    .map((row, index) => rowToLead(headers, row, index + 2));

  formatLeadsSheet(sheet);
  updatePipelineSummary();
  return jsonOutput({ leads });
}

function doPost(e) {
  const contents = e && e.postData ? e.postData.contents : "{}";
  const payload = JSON.parse(contents || "{}");
  if (payload.action !== "updateLead" || !payload.lead) {
    return jsonOutput({ error: "Unsupported payload" });
  }

  return updateLead(payload.lead);
}

function updateLead(lead) {
  if (!lead) {
    return jsonOutput({ error: "Missing lead" });
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonOutput({
      error: "Missing sheet",
      message: "Create a sheet named '" + SHEET_NAME + "' or change SHEET_NAME in Apps Script.",
    });
  }
  const values = sheet.getDataRange().getValues();
  if (!values.length || !values[0].length) {
    return jsonOutput({ error: "Missing headers" });
  }
  const headers = values[0];
  const idIndex = findHeaderIndex(headers, ["id", "ID", "lead_id", "Lead ID", "leadId"]);
  const statusIndex = ensureColumn(sheet, headers, "status");
  const notesIndex = ensureColumn(sheet, headers, "notes");
  const updatedAtIndex = ensureColumn(sheet, headers, "updatedAt");
  const whatsappCountIndex = ensureColumn(sheet, headers, "whatsappCount");

  const requestedRow = Number(lead.rowNumber || lead._rowNumber || 0);
  const targetRow = requestedRow > 1
    ? requestedRow - 1
    : values.findIndex((row, index) => index > 0 && idIndex !== -1 && String(row[idIndex]) === String(lead.id));
  if (targetRow === -1) {
    return jsonOutput({ error: "Lead not found", leadId: lead.id || "", rowNumber: lead.rowNumber || "" });
  }

  const rowNumber = targetRow + 1;
  sheet.getRange(rowNumber, statusIndex + 1).setValue(lead.status || "");
  sheet.getRange(rowNumber, notesIndex + 1).setValue(lead.notes || "");
  sheet.getRange(rowNumber, updatedAtIndex + 1).setValue(new Date());
  sheet.getRange(rowNumber, whatsappCountIndex + 1).setValue(Number(lead.whatsappCount || 0));

  formatLeadsSheet(sheet);
  updatePipelineSummary();
  return jsonOutput({ ok: true, rowNumber, status: lead.status || "" });
}

function saveConfig(config) {
  if (!config) {
    return jsonOutput({ error: "Missing config" });
  }

  const spreadsheet = SpreadsheetApp.getActive();
  const configSheet = getOrCreateSheet(spreadsheet, CONFIG_SHEET_NAME);
  configSheet.clear();
  configSheet.getRange(1, 1, 1, 2).setValues([["Chiave", "Valore"]]);
  configSheet.getRange(2, 1, 4, 2).setValues([
    ["statuses", JSON.stringify(config.statuses || [])],
    ["firstTemplate", config.firstTemplate || ""],
    ["followUpTemplate", config.followUpTemplate || ""],
    ["dynamicFields", JSON.stringify(config.dynamicFields || [])],
  ]);
  configSheet.setFrozenRows(1);
  configSheet.getRange(1, 1, 1, 2)
    .setBackground("#182420")
    .setFontColor("#ffffff")
    .setFontWeight("bold");
  configSheet.autoResizeColumns(1, 2);

  const leadsSheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (leadsSheet && Array.isArray(config.dynamicFields)) {
    const headers = leadsSheet.getRange(1, 1, 1, Math.max(leadsSheet.getLastColumn(), 1)).getValues()[0];
    config.dynamicFields.forEach((field) => {
      const key = String(field.key || "").trim();
      if (key) ensureColumn(leadsSheet, headers, key);
    });
    formatLeadsSheet(leadsSheet);
  }

  updatePipelineSummary();
  return jsonOutput({ ok: true });
}

function setupLeadDesk() {
  const spreadsheet = SpreadsheetApp.getActive();
  let leadsSheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!leadsSheet) {
    leadsSheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (leadsSheet.getLastRow() === 0 || leadsSheet.getLastColumn() === 0) {
    leadsSheet.getRange(1, 1, 1, 12).setValues([[
      "id",
      "createdAt",
      "name",
      "phone",
      "email",
      "campaign",
      "source",
      "city",
      "interest",
      "status",
      "notes",
      "whatsappCount",
    ]]);
  }
  formatLeadsSheet(leadsSheet);
  updatePipelineSummary();
}

function formatLeadsSheet(sheet) {
  if (!sheet) return;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  const headers = headerRange.getValues()[0];
  const statusIndex = findHeaderIndex(headers, ["status", "Status", "stato", "Stato"]);
  const updatedAtIndex = findHeaderIndex(headers, ["updatedAt", "Updated At", "updated_at"]);
  const whatsappCountIndex = findHeaderIndex(headers, ["whatsappCount", "WhatsApp Count", "whatsapp_count"]);
  const notesIndex = findHeaderIndex(headers, ["notes", "Notes", "note", "Note"]);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  headerRange
    .setBackground("#182420")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange(1, 1, lastRow, lastColumn)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setWrap(true);

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).setBorder(false, false, true, false, false, false, "#e5e7eb", SpreadsheetApp.BorderStyle.SOLID);
    applyAlternatingRows(sheet, lastRow, lastColumn);
  }

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(1, 1, lastRow, lastColumn).createFilter();

  setColumnWidthIfExists(sheet, headers, "id", 110);
  setColumnWidthIfExists(sheet, headers, "createdAt", 150);
  setColumnWidthIfExists(sheet, headers, "name", 170);
  setColumnWidthIfExists(sheet, headers, "phone", 140);
  setColumnWidthIfExists(sheet, headers, "email", 220);
  setColumnWidthIfExists(sheet, headers, "campaign", 240);
  setColumnWidthIfExists(sheet, headers, "source", 150);
  setColumnWidthIfExists(sheet, headers, "city", 120);
  setColumnWidthIfExists(sheet, headers, "interest", 180);
  setColumnWidthIfExists(sheet, headers, "status", 170);
  setColumnWidthIfExists(sheet, headers, "notes", 320);
  setColumnWidthIfExists(sheet, headers, "updatedAt", 150);
  setColumnWidthIfExists(sheet, headers, "whatsappCount", 120);

  if (statusIndex !== -1 && lastRow > 1) {
    applyStatusFormatting(sheet, statusIndex + 1, 2, lastRow - 1);
  }
  if (updatedAtIndex !== -1 && lastRow > 1) {
    sheet.getRange(2, updatedAtIndex + 1, lastRow - 1, 1).setNumberFormat("dd/mm/yyyy hh:mm");
  }
  if (whatsappCountIndex !== -1 && lastRow > 1) {
    sheet.getRange(2, whatsappCountIndex + 1, lastRow - 1, 1).setHorizontalAlignment("center");
  }
  if (notesIndex !== -1 && lastRow > 1) {
    sheet.getRange(2, notesIndex + 1, lastRow - 1, 1).setWrap(true);
  }
}

function updatePipelineSummary() {
  const spreadsheet = SpreadsheetApp.getActive();
  const leadsSheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!leadsSheet) return;

  const values = leadsSheet.getDataRange().getValues();
  if (!values.length) return;

  const headers = values[0];
  const leads = values
    .slice(1)
    .filter((row) => row.some(Boolean))
    .map((row, index) => rowToLead(headers, row, index + 2));

  const summarySheet = getOrCreateSheet(spreadsheet, PIPELINE_SHEET_NAME);
  summarySheet.clear();

  const now = new Date();
  const summary = buildStatusSummary(leads);
  const campaignSummary = buildCampaignSummary(leads);

  summarySheet.getRange(1, 1, 1, 2).setValues([["Pipeline aggiornata", now]]);
  summarySheet.getRange(3, 1, 1, 5).setValues([["Stato", "Lead", "WhatsApp inviati", "Ultimo lead", "Percentuale"]]);

  if (summary.length) {
    summarySheet.getRange(4, 1, summary.length, 5).setValues(summary);
  }

  const campaignStart = summary.length + 6;
  summarySheet.getRange(campaignStart, 1, 1, 4).setValues([["Campagna", "Lead", "Contattati", "Ultimo lead"]]);
  if (campaignSummary.length) {
    summarySheet.getRange(campaignStart + 1, 1, campaignSummary.length, 4).setValues(campaignSummary);
  }

  const totalRows = Math.max(campaignStart + campaignSummary.length, 4 + summary.length);
  formatPipelineSheet(summarySheet, summary.length, campaignStart, campaignSummary.length, totalRows);
}

function formatPipelineSheet(sheet, statusRows, campaignStart, campaignRows, totalRows) {
  sheet.setFrozenRows(3);
  sheet.getRange(1, 1, totalRows, 5)
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setWrap(true);

  sheet.getRange(1, 1, 1, 2)
    .setBackground("#182420")
    .setFontColor("#ffffff")
    .setFontWeight("bold");
  sheet.getRange(1, 2).setNumberFormat("dd/mm/yyyy hh:mm");

  sheet.getRange(3, 1, 1, 5)
    .setBackground("#0f766e")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  if (statusRows) {
    sheet.getRange(4, 1, statusRows, 5).setBorder(false, false, true, false, false, false, "#e5e7eb", SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(4, 2, statusRows, 2).setHorizontalAlignment("center");
    sheet.getRange(4, 5, statusRows, 1).setNumberFormat("0%");
    applyStatusFormatting(sheet, 1, 4, statusRows);
  }

  sheet.getRange(campaignStart, 1, 1, 4)
    .setBackground("#334155")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  if (campaignRows) {
    sheet.getRange(campaignStart + 1, 1, campaignRows, 4).setBorder(false, false, true, false, false, false, "#e5e7eb", SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(campaignStart + 1, 2, campaignRows, 2).setHorizontalAlignment("center");
  }

  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 170);
  sheet.setColumnWidth(5, 120);
}

function applyAlternatingRows(sheet, lastRow, lastColumn) {
  for (let row = 2; row <= lastRow; row += 1) {
    const color = row % 2 === 0 ? "#ffffff" : "#f8fafc";
    sheet.getRange(row, 1, 1, lastColumn).setBackground(color);
  }
}

function applyStatusFormatting(sheet, column, startRow, rowCount) {
  const range = sheet.getRange(startRow, column, rowCount, 1);
  const statuses = range.getValues().map((row) => String(row[0] || ""));
  statuses.forEach((status, index) => {
    const tone = statusTone(status);
    sheet.getRange(startRow + index, column)
      .setBackground(tone.bg)
      .setFontColor(tone.fg)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  });
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("nuovo")) return STATUS_COLORS[0];
  if (normalized.includes("contattare")) return STATUS_COLORS[1];
  if (normalized.includes("contatt")) return STATUS_COLORS[2];
  if (normalized.includes("appunt") || normalized.includes("meeting")) return STATUS_COLORS[3];
  if (normalized.includes("interess") || normalized.includes("perso") || normalized.includes("lost")) return STATUS_COLORS[4];
  if (normalized.includes("chius") || normalized.includes("closed")) return STATUS_COLORS[5];
  return { bg: "#e6f4f1", fg: "#0f766e" };
}

function setColumnWidthIfExists(sheet, headers, name, width) {
  const index = findHeaderIndex(headers, [name]);
  if (index !== -1) {
    sheet.setColumnWidth(index + 1, width);
  }
}

function buildStatusSummary(leads) {
  const total = leads.length || 1;
  const byStatus = {};

  leads.forEach((lead) => {
    const status = lead.status || "Nuovo";
    if (!byStatus[status]) {
      byStatus[status] = { count: 0, whatsappCount: 0, latest: null };
    }
    byStatus[status].count += 1;
    byStatus[status].whatsappCount += Number(lead.whatsappCount || 0);
    byStatus[status].latest = getLatestDate(byStatus[status].latest, lead.createdAt);
  });

  return Object.keys(byStatus).map((status) => {
    const item = byStatus[status];
    return [status, item.count, item.whatsappCount, item.latest || "", item.count / total];
  });
}

function buildCampaignSummary(leads) {
  const byCampaign = {};

  leads.forEach((lead) => {
    const campaign = lead.campaign || "Senza campagna";
    if (!byCampaign[campaign]) {
      byCampaign[campaign] = { count: 0, contacted: 0, latest: null };
    }
    byCampaign[campaign].count += 1;
    if (String(lead.status || "").toLowerCase().includes("contatt")) {
      byCampaign[campaign].contacted += 1;
    }
    byCampaign[campaign].latest = getLatestDate(byCampaign[campaign].latest, lead.createdAt);
  });

  return Object.keys(byCampaign).map((campaign) => {
    const item = byCampaign[campaign];
    return [campaign, item.count, item.contacted, item.latest || ""];
  });
}

function getLatestDate(current, candidate) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate) > new Date(current) ? candidate : current;
}

function getOrCreateSheet(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function rowToLead(headers, row, rowNumber) {
  const lead = {};
  headers.forEach((header, index) => {
    lead[header] = row[index];
  });

  return {
    _raw: lead,
    id: getLeadValue(lead, ["id", "ID", "lead_id", "Lead ID", "leadId"]) || String(rowNumber),
    rowNumber,
    createdAt: getLeadValue(lead, ["createdAt", "created_time", "Created Time", "timestamp"]),
    name: getLeadValue(lead, ["name", "full_name", "nome", "Full Name"]),
    phone: getLeadValue(lead, ["phone", "phone_number", "telefono", "Phone Number"]),
    email: getLeadValue(lead, ["email", "email_address", "Email"]),
    campaign: getLeadValue(lead, ["campaign", "campaign_name", "campagna", "Campaign Name"]),
    source: getLeadValue(lead, ["source", "platform"]) || "Meta Lead Ads",
    city: getLeadValue(lead, ["city", "citta", "City"]),
    interest: getLeadValue(lead, ["interest", "form_name", "interesse", "Form Name"]),
    status: getLeadValue(lead, ["status", "Status", "stato", "Stato"]) || "Nuovo",
    notes: getLeadValue(lead, ["notes", "Notes", "note", "Note"]) || "",
    updatedAt: getLeadValue(lead, ["updatedAt", "Updated At", "updated_at"]) || "",
    whatsappCount: Number(getLeadValue(lead, ["whatsappCount", "WhatsApp Count", "whatsapp_count"]) || 0),
  };
}

function ensureColumn(sheet, headers, name) {
  const existing = findHeaderIndex(headers, [name]);
  if (existing !== -1) return existing;

  const column = headers.length + 1;
  sheet.getRange(1, column).setValue(name);
  headers.push(name);
  return column - 1;
}

function getLeadValue(lead, names) {
  const keys = Object.keys(lead);
  for (let i = 0; i < names.length; i += 1) {
    const target = String(names[i]).trim().toLowerCase();
    const key = keys.find((item) => String(item).trim().toLowerCase() === target);
    if (key && lead[key] !== "") return lead[key];
  }
  return "";
}

function findHeaderIndex(headers, names) {
  const normalizedHeaders = headers.map((header) => String(header || "").trim().toLowerCase());
  for (let i = 0; i < names.length; i += 1) {
    const index = normalizedHeaders.indexOf(String(names[i]).trim().toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
