const LANGUAGES = [
  {
    key: "vi",
    code: "vi-VN",
    label: "베트남어",
    folder: "vietnamese",
    textInputId: "textViInput",
    voiceSelectId: "voiceViSelect",
    defaultVoice: "vi-VN-Neural2-A",
    columns: ["베트남어", "vietnamese", "vietnam", "vi", "vi-vn"],
    voices: [
      "vi-VN-Neural2-A",
      "vi-VN-Neural2-D",
      "vi-VN-Chirp3-HD-Zephyr",
      "vi-VN-Chirp3-HD-Kore",
      "vi-VN-Chirp3-HD-Charon",
      "vi-VN-Chirp3-HD-Despina",
      "vi-VN-Chirp3-HD-Erinome",
      "vi-VN-Chirp3-HD-Gacrux",
      "vi-VN-Chirp3-HD-Laomedeia",
      "vi-VN-Chirp3-HD-Vindemiatrix",
      "vi-VN-Chirp3-HD-Enceladus",
      "vi-VN-Chirp3-HD-Fenrir",
      "vi-VN-Chirp3-HD-Iapetus",
      "vi-VN-Chirp3-HD-Umbriel",
      "vi-VN-Chirp3-HD-Zubenelgenubi",
      "vi-VN-Wavenet-A",
      "vi-VN-Wavenet-B",
      "vi-VN-Wavenet-C",
      "vi-VN-Wavenet-D",
      "vi-VN-Standard-A",
      "vi-VN-Standard-B",
      "vi-VN-Standard-C",
      "vi-VN-Standard-D"
    ]
  },
  {
    key: "ko",
    code: "ko-KR",
    label: "한국어",
    folder: "korean",
    textInputId: "textKoInput",
    voiceSelectId: "voiceKoSelect",
    defaultVoice: "ko-KR-Neural2-A",
    columns: ["한국어", "한글", "korean", "ko", "ko-kr"],
    voices: [
      "ko-KR-Neural2-A",
      "ko-KR-Neural2-B",
      "ko-KR-Neural2-C",
      "ko-KR-Wavenet-A",
      "ko-KR-Wavenet-B",
      "ko-KR-Wavenet-C",
      "ko-KR-Wavenet-D",
      "ko-KR-Standard-A",
      "ko-KR-Standard-B",
      "ko-KR-Standard-C",
      "ko-KR-Standard-D"
    ]
  },
  {
    key: "en",
    code: "en-US",
    label: "영어",
    folder: "english",
    textInputId: "textEnInput",
    voiceSelectId: "voiceEnSelect",
    defaultVoice: "en-US-Neural2-F",
    columns: ["영어", "english", "en", "en-us"],
    voices: [
      "en-US-Neural2-A",
      "en-US-Neural2-C",
      "en-US-Neural2-D",
      "en-US-Neural2-E",
      "en-US-Neural2-F",
      "en-US-Neural2-G",
      "en-US-Neural2-H",
      "en-US-Neural2-I",
      "en-US-Neural2-J",
      "en-US-Wavenet-A",
      "en-US-Wavenet-B",
      "en-US-Wavenet-C",
      "en-US-Wavenet-D",
      "en-US-Wavenet-E",
      "en-US-Wavenet-F",
      "en-US-Wavenet-G",
      "en-US-Wavenet-H",
      "en-US-Wavenet-I",
      "en-US-Wavenet-J",
      "en-US-Standard-A",
      "en-US-Standard-B",
      "en-US-Standard-C",
      "en-US-Standard-D",
      "en-US-Standard-E",
      "en-US-Standard-F",
      "en-US-Standard-G",
      "en-US-Standard-H",
      "en-US-Standard-I",
      "en-US-Standard-J"
    ]
  }
];

const CATEGORY_COLUMNS = ["카테고리", "분류", "category", "group"];

const state = {
  singleObjectUrls: []
};

const $ = (selector) => document.querySelector(selector);

const apiBaseInput = $("#apiBaseInput");
const apiTokenInput = $("#apiTokenInput");
const healthButton = $("#healthButton");
const rateInput = $("#rateInput");
const rateOutput = $("#rateOutput");
const repeatShortInput = $("#repeatShortInput");
const filenameInput = $("#filenameInput");
const singleGenerateButton = $("#singleGenerateButton");
const singleResults = $("#singleResults");
const batchFileInput = $("#batchFileInput");
const batchGenerateButton = $("#batchGenerateButton");
const batchProgress = $("#batchProgress");
const statusPanel = $(".status-panel");
const statusText = $("#statusText");

const languageControls = LANGUAGES.map((language) => ({
  ...language,
  textInput: $(`#${language.textInputId}`),
  voiceSelect: $(`#${language.voiceSelectId}`)
}));

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusPanel.classList.toggle("error", type === "error");
  statusPanel.classList.toggle("success", type === "success");
}

function normalizeApiBase() {
  return apiBaseInput.value.trim().replace(/\/+$/, "");
}

function apiUrl(path) {
  const base = normalizeApiBase();
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}

function authHeaders(json = false) {
  const headers = {};
  const token = apiTokenInput.value.trim();
  if (token) {
    headers["X-API-Token"] = token;
  }
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function parseError(response) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text);
    return payload.detail || text || response.statusText;
  } catch {
    return text || response.statusText;
  }
}

function contentDispositionFilename(header, fallback) {
  if (!header) {
    return fallback;
  }
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    return decodeURIComponent(encoded[1]);
  }
  const plain = header.match(/filename="?([^"]+)"?/i);
  return plain ? plain[1] : fallback;
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function sanitizeFilename(value, fallback = "tts") {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

function filenameStemFromText(text, fallback) {
  return sanitizeFilename(text, fallback).slice(0, 36).trim() || fallback;
}

function requestedFilename(prefix, language, text) {
  if (prefix) {
    return `${sanitizeFilename(prefix)}_${language.key}`;
  }
  return `${language.key}_${filenameStemFromText(text, language.folder)}`;
}

function zipPathForTask(task, usedPaths) {
  const rowNumber = String(task.rowIndex + 1).padStart(3, "0");
  const base = task.category
    ? `${rowNumber}_${sanitizeFilename(task.category)}`
    : `${rowNumber}_${filenameStemFromText(task.text, "sentence")}`;
  const stem = sanitizeFilename(`${base}_${task.language.key}`);
  let path = `${task.language.folder}/${stem}.mp3`;
  let suffix = 2;

  while (usedPaths.has(path)) {
    path = `${task.language.folder}/${stem}_${suffix}.mp3`;
    suffix += 1;
  }
  usedPaths.add(path);
  return path;
}

function populateVoiceSelect(language, voices = language.voices) {
  const select = language.voiceSelect;
  const previous = select.value;
  const stored =
    localStorage.getItem(`ttsVoice_${language.key}`) ||
    (language.key === "vi" ? localStorage.getItem("ttsVoice") : "") ||
    previous ||
    language.defaultVoice;
  const availableVoices = voices.length ? voices : language.voices;

  select.innerHTML = "";
  availableVoices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice;
    option.textContent = voice;
    select.appendChild(option);
  });

  if (availableVoices.includes(stored)) {
    select.value = stored;
  } else if (availableVoices.includes(language.defaultVoice)) {
    select.value = language.defaultVoice;
  } else {
    select.value = availableVoices[0] || "";
  }
}

function populateVoiceSelects(voices) {
  languageControls.forEach((language) => {
    const languageVoices = Array.isArray(voices)
      ? voices.filter((voice) => voice.startsWith(`${language.code}-`))
      : language.voices;
    populateVoiceSelect(language, languageVoices);
  });
}

async function loadVoices() {
  populateVoiceSelects();
  try {
    const response = await fetch(apiUrl("/api/voices"), {
      headers: authHeaders()
    });
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload.voices)) {
        populateVoiceSelects(payload.voices);
      }
    }
  } catch {
    // The built-in lists keep the app usable before the NAS API is online.
  }
}

async function checkHealth() {
  setStatus("연결 확인 중...");
  try {
    const response = await fetch(apiUrl("/health"), {
      headers: authHeaders()
    });
    if (!response.ok) {
      throw new Error(await parseError(response));
    }
    setStatus("API 서버 연결 정상", "success");
  } catch (error) {
    setStatus(`연결 실패: ${error.message}`, "error");
  }
}

async function synthesizeMp3({ text, voiceName, repeatShort, filename }) {
  const response = await fetch(apiUrl("/api/synthesize"), {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({
      text,
      voice_name: voiceName,
      speaking_rate: Number(rateInput.value),
      repeat_short: repeatShort,
      filename
    })
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const blob = await response.blob();
  const downloadName = contentDispositionFilename(
    response.headers.get("Content-Disposition"),
    `${filename || "tts"}.mp3`
  );
  return { blob, filename: downloadName };
}

function clearSingleResults() {
  state.singleObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.singleObjectUrls = [];
  singleResults.innerHTML = "";
  singleResults.hidden = true;
}

function addSingleResult(language, blob, filename) {
  const url = URL.createObjectURL(blob);
  state.singleObjectUrls.push(url);

  const item = document.createElement("article");
  item.className = "result-item";

  const title = document.createElement("div");
  title.className = "result-title";
  const strong = document.createElement("strong");
  strong.textContent = language.label;
  const span = document.createElement("span");
  span.textContent = filename;
  title.append(strong, span);

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = url;

  const link = document.createElement("a");
  link.className = "download-link";
  link.href = url;
  link.download = filename;
  link.textContent = "다운로드";

  item.append(title, audio, link);
  singleResults.appendChild(item);
  singleResults.hidden = false;
}

function singleGenerationItems() {
  return languageControls
    .map((language) => ({
      language,
      text: language.textInput.value.trim(),
      voiceName: language.voiceSelect.value
    }))
    .filter((item) => item.text);
}

async function generateSingle() {
  const items = singleGenerationItems();
  if (!items.length) {
    setStatus("텍스트를 하나 이상 입력하세요.", "error");
    return;
  }

  clearSingleResults();
  singleGenerateButton.disabled = true;

  try {
    const prefix = filenameInput.value.trim();
    for (const [index, item] of items.entries()) {
      setStatus(`${item.language.label} MP3 생성 중... (${index + 1}/${items.length})`);
      const requestedName = requestedFilename(prefix, item.language, item.text);
      const result = await synthesizeMp3({
        text: item.text,
        voiceName: item.voiceName,
        repeatShort: repeatShortInput.checked,
        filename: requestedName
      });
      addSingleResult(item.language, result.blob, result.filename);
    }
    setStatus(`MP3 생성 완료: ${items.length}개`, "success");
  } catch (error) {
    setStatus(`생성 실패: ${error.message}`, "error");
  } finally {
    singleGenerateButton.disabled = false;
  }
}

function requireBatchLibraries() {
  if (!window.XLSX || !window.JSZip) {
    throw new Error("CSV/XLSX 또는 ZIP 라이브러리를 불러오지 못했습니다.");
  }
}

async function readRows(file) {
  requireBatchLibraries();
  const data = await file.arrayBuffer();
  const workbook = window.XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("첫 번째 시트를 찾지 못했습니다.");
  }
  return window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false
  });
}

function findColumn(headers, candidates) {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const candidate of candidates) {
    const column = normalized.get(normalizeHeader(candidate));
    if (column) {
      return column;
    }
  }
  return "";
}

function resolveColumns(rows) {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  return {
    category: findColumn(headers, CATEGORY_COLUMNS),
    languages: new Map(
      languageControls.map((language) => [language.key, findColumn(headers, language.columns)])
    )
  };
}

function batchTasks(rows) {
  const columns = resolveColumns(rows);
  const tasks = [];

  rows.forEach((row, rowIndex) => {
    languageControls.forEach((language) => {
      const column = columns.languages.get(language.key);
      const text = column ? String(row[column] || "").trim() : "";
      if (!text) {
        return;
      }
      const category = columns.category ? String(row[columns.category] || "").trim() : "";
      tasks.push({
        language,
        text,
        rowIndex,
        category,
        voiceName: language.voiceSelect.value
      });
    });
  });

  return tasks;
}

async function generateBatch() {
  const file = batchFileInput.files[0];
  if (!file) {
    setStatus("CSV 또는 XLSX 파일을 선택하세요.", "error");
    return;
  }

  batchGenerateButton.disabled = true;
  batchProgress.hidden = false;
  batchProgress.value = 0;

  try {
    setStatus("파일 읽는 중...");
    const rows = await readRows(file);
    if (!rows.length) {
      throw new Error("생성할 행이 없습니다.");
    }

    const tasks = batchTasks(rows);
    if (!tasks.length) {
      throw new Error("베트남어, 한국어, 영어 컬럼에서 생성할 텍스트를 찾지 못했습니다.");
    }

    const zip = new window.JSZip();
    const usedPaths = new Set();

    for (const [index, task] of tasks.entries()) {
      const progress = Math.round((index / tasks.length) * 90);
      batchProgress.value = progress;
      setStatus(`${task.language.label} MP3 생성 중... (${index + 1}/${tasks.length})`);
      const filename = zipPathForTask(task, usedPaths);
      const requestFilename = filename.split("/").pop().replace(/\.mp3$/i, "");
      const result = await synthesizeMp3({
        text: task.text,
        voiceName: task.voiceName,
        repeatShort: repeatShortInput.checked,
        filename: requestFilename
      });
      zip.file(filename, result.blob);
    }

    setStatus("ZIP 파일 묶는 중...");
    batchProgress.value = 95;
    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, "multilingual_tts_batch.zip");
    batchProgress.value = 100;
    setStatus(`ZIP 생성 완료: ${tasks.length}개 MP3`, "success");
  } catch (error) {
    setStatus(`ZIP 생성 실패: ${error.message}`, "error");
  } finally {
    batchGenerateButton.disabled = false;
  }
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      document.querySelectorAll(".tab-button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      $("#singleTab").classList.toggle("active", target === "single");
      $("#batchTab").classList.toggle("active", target === "batch");
    });
  });
}

function restoreSettings() {
  apiBaseInput.value = localStorage.getItem("ttsApiBase") || "https://vietnam.dalbong2.synology.me";
  apiTokenInput.value = localStorage.getItem("ttsApiToken") || "";
  rateInput.value = localStorage.getItem("ttsRate") || "0.85";
  rateOutput.value = Number(rateInput.value).toFixed(2);
}

function bindSettings() {
  apiBaseInput.addEventListener("change", () => {
    localStorage.setItem("ttsApiBase", normalizeApiBase());
    loadVoices();
  });
  apiTokenInput.addEventListener("change", () => {
    localStorage.setItem("ttsApiToken", apiTokenInput.value.trim());
    loadVoices();
  });
  languageControls.forEach((language) => {
    language.voiceSelect.addEventListener("change", () => {
      localStorage.setItem(`ttsVoice_${language.key}`, language.voiceSelect.value);
      if (language.key === "vi") {
        localStorage.setItem("ttsVoice", language.voiceSelect.value);
      }
    });
  });
  rateInput.addEventListener("input", () => {
    rateOutput.value = Number(rateInput.value).toFixed(2);
    localStorage.setItem("ttsRate", rateInput.value);
  });
}

restoreSettings();
populateVoiceSelects();
bindTabs();
bindSettings();
healthButton.addEventListener("click", checkHealth);
singleGenerateButton.addEventListener("click", generateSingle);
batchGenerateButton.addEventListener("click", generateBatch);
loadVoices();
