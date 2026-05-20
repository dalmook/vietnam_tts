const VOICES = [
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
];

const state = {
  singleObjectUrl: null
};

const $ = (selector) => document.querySelector(selector);

const apiBaseInput = $("#apiBaseInput");
const apiTokenInput = $("#apiTokenInput");
const healthButton = $("#healthButton");
const voiceSelect = $("#voiceSelect");
const rateInput = $("#rateInput");
const rateOutput = $("#rateOutput");
const repeatShortInput = $("#repeatShortInput");
const textInput = $("#textInput");
const filenameInput = $("#filenameInput");
const singleGenerateButton = $("#singleGenerateButton");
const singleDownloadLink = $("#singleDownloadLink");
const audioPreview = $("#audioPreview");
const batchFileInput = $("#batchFileInput");
const batchGenerateButton = $("#batchGenerateButton");
const batchProgress = $("#batchProgress");
const statusPanel = $(".status-panel");
const statusText = $("#statusText");

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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function batchStatusMessage(job) {
  const progress = Number(job.progress_percent || 0).toFixed(1);
  const current = job.current || 0;
  const total = job.total || 0;
  const created = job.created || 0;
  const failed = job.failed || 0;
  const currentFile = job.current_file ? ` / ${job.current_file}` : "";
  return `ZIP 생성 중: ${progress}% (${current}/${total}) / 성공 ${created} / 실패 ${failed}${currentFile}`;
}

async function fetchBatchJob(jobId) {
  const response = await fetch(apiUrl(`/api/jobs/${jobId}`), {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

async function downloadBatchJob(jobId, downloadUrl) {
  const response = await fetch(apiUrl(downloadUrl || `/api/jobs/${jobId}/download`), {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const blob = await response.blob();
  const filename = contentDispositionFilename(
    response.headers.get("Content-Disposition"),
    "vietnamese_tts_batch.zip"
  );
  downloadBlob(blob, filename);
  return filename;
}

async function waitForBatchJob(jobId) {
  while (true) {
    const job = await fetchBatchJob(jobId);
    batchProgress.hidden = false;
    batchProgress.value = Number(job.progress_percent || 0);

    if (job.status === "completed") {
      batchProgress.value = 100;
      const filename = await downloadBatchJob(jobId, job.download_url);
      setStatus(`ZIP 생성 완료: ${filename}`, "success");
      return;
    }

    if (job.status === "failed") {
      const detail = job.message || "작업 실패";
      throw new Error(detail);
    }

    setStatus(batchStatusMessage(job));
    await sleep(1500);
  }
}

function populateVoices(voices = VOICES) {
  voiceSelect.innerHTML = "";
  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice;
    option.textContent = voice;
    voiceSelect.appendChild(option);
  });
  voiceSelect.value = localStorage.getItem("ttsVoice") || "vi-VN-Neural2-A";
}

async function loadVoices() {
  populateVoices();
  try {
    const response = await fetch(apiUrl("/api/voices"), {
      headers: authHeaders()
    });
    if (response.ok) {
      const payload = await response.json();
      if (Array.isArray(payload.voices)) {
        populateVoices(payload.voices);
      }
    }
  } catch {
    // The built-in list keeps the app usable before the NAS API is online.
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

async function generateSingle() {
  const text = textInput.value.trim();
  if (!text) {
    setStatus("베트남어 텍스트를 입력하세요.", "error");
    return;
  }

  setStatus("MP3 생성 중...");
  singleGenerateButton.disabled = true;
  singleDownloadLink.hidden = true;
  audioPreview.hidden = true;

  try {
    const response = await fetch(apiUrl("/api/synthesize"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        text,
        voice_name: voiceSelect.value,
        speaking_rate: Number(rateInput.value),
        repeat_short: repeatShortInput.checked,
        filename: filenameInput.value.trim() || null
      })
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const blob = await response.blob();
    const filename = contentDispositionFilename(
      response.headers.get("Content-Disposition"),
      "vietnamese_tts.mp3"
    );

    if (state.singleObjectUrl) {
      URL.revokeObjectURL(state.singleObjectUrl);
    }
    state.singleObjectUrl = URL.createObjectURL(blob);
    audioPreview.src = state.singleObjectUrl;
    audioPreview.hidden = false;
    singleDownloadLink.href = state.singleObjectUrl;
    singleDownloadLink.download = filename;
    singleDownloadLink.hidden = false;

    setStatus(`생성 완료: ${filename}`, "success");
  } catch (error) {
    setStatus(`생성 실패: ${error.message}`, "error");
  } finally {
    singleGenerateButton.disabled = false;
  }
}

async function generateBatch() {
  const file = batchFileInput.files[0];
  if (!file) {
    setStatus("CSV 또는 XLSX 파일을 선택하세요.", "error");
    return;
  }

  setStatus("작업 등록 중...");
  batchGenerateButton.disabled = true;
  batchProgress.hidden = false;
  batchProgress.value = 0;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("voice_name", voiceSelect.value);
  formData.append("speaking_rate", rateInput.value);

  try {
    const response = await fetch(apiUrl("/api/batch"), {
      method: "POST",
      headers: authHeaders(),
      body: formData
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const job = await response.json();
    if (!job.job_id) {
      throw new Error("작업 ID를 받지 못했습니다.");
    }
    setStatus(`작업 등록 완료: ${job.job_id}`);
    await waitForBatchJob(job.job_id);
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
  apiBaseInput.value = localStorage.getItem("ttsApiBase") || "http://localhost:18084";
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
  voiceSelect.addEventListener("change", () => {
    localStorage.setItem("ttsVoice", voiceSelect.value);
  });
  rateInput.addEventListener("input", () => {
    rateOutput.value = Number(rateInput.value).toFixed(2);
    localStorage.setItem("ttsRate", rateInput.value);
  });
}

restoreSettings();
populateVoices();
bindTabs();
bindSettings();
healthButton.addEventListener("click", checkHealth);
singleGenerateButton.addEventListener("click", generateSingle);
batchGenerateButton.addEventListener("click", generateBatch);
loadVoices();
