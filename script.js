const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const dropContent = document.getElementById('dropContent');
const imageWrapper = document.getElementById('imageWrapper');
const previewImage = document.getElementById('previewImage');
const filterCanvas = document.getElementById('filterCanvas');
const gridOverlay = document.getElementById('gridOverlay');
const toolbar = document.getElementById('toolbar');

const toggleGridBtn = document.getElementById('toggleGridBtn');
const toggleDustBtn = document.getElementById('toggleDustBtn');
const resetViewBtn = document.getElementById('resetViewBtn');

const screenBtn = document.getElementById('screenBtn');
const histogramSection = document.getElementById('histogramSection');
const histogramCanvas = document.getElementById('histogramCanvas');
const resultsSection = document.getElementById('resultsSection');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultsContent = document.getElementById('resultsContent');

// Settings Elements
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const themeSelect = document.getElementById('themeSelect');
const strictnessSelect = document.getElementById('strictnessSelect');
const autoDustCheckbox = document.getElementById('autoDustCheckbox');

let selectedFile = null;
let originalImageObject = new Image();

// Valid API Models
const VALID_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'];

// Startup Settings Initialization
document.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('user_gemini_api_key') || '';
  let savedModel = localStorage.getItem('user_gemini_model');
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  const savedStrictness = localStorage.getItem('app_strictness') || 'standard';
  const savedAutoDust = localStorage.getItem('app_auto_dust') === 'true';

  if (!savedModel || !VALID_MODELS.includes(savedModel)) {
    savedModel = 'gemini-3.5-flash';
    localStorage.setItem('user_gemini_model', savedModel);
  }

  if (apiKeyInput) apiKeyInput.value = savedKey;
  if (modelSelect) modelSelect.value = savedModel;
  if (themeSelect) themeSelect.value = savedTheme;
  if (strictnessSelect) strictnessSelect.value = savedStrictness;
  if (autoDustCheckbox) autoDustCheckbox.checked = savedAutoDust;

  applyTheme(savedTheme);
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Settings Listeners
openSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

saveSettingsBtn.addEventListener('click', () => {
  const theme = themeSelect.value;
  localStorage.setItem('user_gemini_api_key', apiKeyInput.value.trim());
  localStorage.setItem('user_gemini_model', modelSelect.value);
  localStorage.setItem('app_theme', theme);
  localStorage.setItem('app_strictness', strictnessSelect.value);
  localStorage.setItem('app_auto_dust', autoDustCheckbox.checked);

  applyTheme(theme);
  settingsModal.classList.add('hidden');
  alert('Settings saved!');
});

// Drag & Drop
dropZone.addEventListener('click', (e) => {
  if (e.target.closest('.toolbar') || e.target.closest('button')) return;
  imageInput.click();
});

imageInput.addEventListener('change', (e) => e.target.files.length && handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) return alert('Upload a valid image.');
  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    originalImageObject.src = e.target.result;

    originalImageObject.onload = () => {
      dropContent.classList.add('hidden');
      imageWrapper.classList.remove('hidden');
      toolbar.classList.remove('hidden');
      histogramSection.classList.remove('hidden');
      screenBtn.disabled = false;

      generateBWHistogram(originalImageObject);

      if (autoDustCheckbox.checked) {
        applyJetPhotosEqualizeFilter();
        toggleDustBtn.classList.add('active');
      }
    };
  };
  reader.readAsDataURL(file);
}

// Inspector Controls
toggleGridBtn.addEventListener('click', () => {
  gridOverlay.classList.toggle('hidden');
  toggleGridBtn.classList.toggle('active');
});

toggleDustBtn.addEventListener('click', () => {
  if (filterCanvas.classList.contains('hidden')) {
    applyJetPhotosEqualizeFilter();
    toggleDustBtn.classList.add('active');
  } else {
    resetView();
  }
});

resetViewBtn.addEventListener('click', resetView);

function resetView() {
  previewImage.classList.remove('hidden');
  filterCanvas.classList.add('hidden');
  gridOverlay.classList.add('hidden');
  toggleGridBtn.classList.remove('active');
  toggleDustBtn.classList.remove('active');
}

function applyJetPhotosEqualizeFilter() {
  const canvas = filterCanvas;
  const ctx = canvas.getContext('2d');
  const w = originalImageObject.naturalWidth;
  const h = originalImageObject.naturalHeight;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(originalImageObject, 0, 0);

  const srcData = ctx.getImageData(0, 0, w, h);
  const data = srcData.data;
  const totalPixels = w * h;

  const histR = new Array(256).fill(0), histG = new Array(256).fill(0), histB = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    histR[data[i]]++; histG[data[i + 1]]++; histB[data[i + 2]]++;
  }

  const cdfR = new Array(256).fill(0), cdfG = new Array(256).fill(0), cdfB = new Array(256).fill(0);
  cdfR[0] = histR[0]; cdfG[0] = histG[0]; cdfB[0] = histB[0];
  for (let i = 1; i < 256; i++) {
    cdfR[i] = cdfR[i - 1] + histR[i];
    cdfG[i] = cdfG[i - 1] + histG[i];
    cdfB[i] = cdfB[i - 1] + histB[i];
  }

  const cdfMinR = cdfR.find(v => v > 0) || 1;
  const cdfMinG = cdfG.find(v => v > 0) || 1;
  const cdfMinB = cdfB.find(v => v > 0) || 1;

  const lutR = new Uint8Array(256), lutG = new Uint8Array(256), lutB = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lutR[i] = Math.round(((cdfR[i] - cdfMinR) / (totalPixels - cdfMinR)) * 255);
    lutG[i] = Math.round(((cdfG[i] - cdfMinG) / (totalPixels - cdfMinG)) * 255);
    lutB[i] = Math.round(((cdfB[i] - cdfMinB) / (totalPixels - cdfMinB)) * 255);
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lutR[data[i]];
    data[i + 1] = lutG[data[i + 1]];
    data[i + 2] = lutB[data[i + 2]];
  }

  ctx.putImageData(srcData, 0, 0);
  previewImage.classList.add('hidden');
  filterCanvas.classList.remove('hidden');
}

function generateBWHistogram(imgObj) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = imgObj.naturalWidth;
  canvas.height = imgObj.naturalHeight;
  ctx.drawImage(imgObj, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const bwHist = new Array(256).fill(0);

  for (let i = 0; i < imgData.length; i += 4) {
    const lum = Math.round(0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]);
    bwHist[lum]++;
  }

  drawBWHistogramCanvas(bwHist);
}

function drawBWHistogramCanvas(hist) {
  const ctx = histogramCanvas.getContext('2d');
  const width = histogramCanvas.width;
  const height = histogramCanvas.height;
  ctx.clearRect(0, 0, width, height);
  const maxVal = Math.max(...hist);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#334155');
  gradient.addColorStop(0.5, '#94a3b8');
  gradient.addColorStop(1, '#ffffff');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * width;
    const barHeight = (hist[i] / maxVal) * (height - 10);
    ctx.lineTo(x, height - barHeight);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}

// API Trigger
screenBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const userApiKey = localStorage.getItem('user_gemini_api_key') || '';
  let userModel = localStorage.getItem('user_gemini_model') || 'gemini-3.5-flash';
  const strictness = localStorage.getItem('app_strictness') || 'standard';

  if (!VALID_MODELS.includes(userModel)) {
    userModel = 'gemini-3.5-flash';
  }

  resultsSection.classList.remove('hidden');
  loadingSpinner.classList.remove('hidden');
  resultsContent.classList.add('hidden');

  const formData = new FormData();
  formData.append('photo', selectedFile);

  try {
    const response = await fetch('https://jetphotosscreener.onrender.com/api/prescreen', {
      method: 'POST',
      headers: {
        'x-api-key': userApiKey,
        'x-model': userModel,
        'x-strictness': strictness
      },
      body: formData
    });

    const data = await response.json();
    loadingSpinner.classList.add('hidden');

    if (!response.ok) return alert(data.error || 'Request failed.');

    resultsContent.classList.remove('hidden');
    displayResults(data);
  } catch (err) {
    console.error(err);
    loadingSpinner.classList.add('hidden');
    alert('An error occurred during screening.');
  }
});

function displayResults(data) {
  const badge = document.getElementById('verdictBadge');
  badge.textContent = data.verdict;
  badge.className = `badge ${data.verdict}`;

  document.getElementById('scoreText').textContent = data.score;
  document.getElementById('summaryText').textContent = data.summary;

  const reasonsList = document.getElementById('reasonsList');
  reasonsList.innerHTML = '';
  if (data.reject_reasons && data.reject_reasons.length > 0) {
    data.reject_reasons.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>[${item.category}] (${item.severity} Severity):</strong> ${item.description}`;
      reasonsList.appendChild(li);
    });
  } else {
    reasonsList.innerHTML = '<li>No rejection reasons found. Photo looks good!</li>';
  }

  const tipsList = document.getElementById('tipsList');
  tipsList.innerHTML = '';
  if (data.photographer_tips && data.photographer_tips.length > 0) {
    data.photographer_tips.forEach(tip => {
      const li = document.createElement('li');
      li.textContent = tip;
      tipsList.appendChild(li);
    });
  }
}
