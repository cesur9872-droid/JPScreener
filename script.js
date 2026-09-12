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
const VALID_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash'];

// Startup Settings Initialization
document.addEventListener('DOMContentLoaded', () => {
  const savedKey = localStorage.getItem('user_gemini_api_key') || '';
  let savedModel = localStorage.getItem('user_gemini_model');
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  const savedStrictness = localStorage.getItem('app_strictness') || 'standard';
  const savedAutoDust = localStorage.getItem('app_auto_dust') === 'true';

  // Force clean migration away from deprecated gemini-2.5 models
  if (!savedModel || !VALID_MODELS.includes(savedModel)) {
    savedModel = 'gemini-3.6-flash';
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

  // Clean canvas background (Pure White like JetPhotos/Photoshop panel)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const maxVal = Math.max(...hist) || 1;

  ctx.beginPath();
  ctx.moveTo(0, height);

  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * width;
    const barHeight = (hist[i] / maxVal) * (height - 5);
    ctx.lineTo(x, height - barHeight);
  }

  ctx.lineTo(width, height);
  ctx.closePath();

  // Solid Gray Histogram Fill
  ctx.fillStyle = '#808080';
  ctx.fill();

  // Light Blue Outline Stroke (Photoshop / JetPhotos Style)
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// API Trigger (Direct Browser Gemini 3.6 Flash Integration)
screenBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  const userApiKey = localStorage.getItem('user_gemini_api_key') || '';
  let userModel = localStorage.getItem('user_gemini_model') || 'gemini-3.6-flash';
  const strictness = localStorage.getItem('app_strictness') || 'standard';

  if (!userApiKey) {
    alert('Please click Settings (gear icon) and enter your Gemini API Key!');
    return;
  }

  if (!VALID_MODELS.includes(userModel)) {
    userModel = 'gemini-3.6-flash';
  }

  resultsSection.classList.remove('hidden');
  loadingSpinner.classList.remove('hidden');
  resultsContent.classList.add('hidden');

  try {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(selectedFile);
    });

    const promptText = `You are a strict JetPhotos.com screening assistant. Analyze this aircraft photograph for JetPhotos acceptance standards.
Strictness level requested: ${strictness}.

Return ONLY a raw JSON object with no markdown formatting or backticks matching this structure:
{
  "verdict": "ACCEPTED",
  "score": 85,
  "summary": "Brief overall assessment",
  "reject_reasons": [
    {
      "category": "Centering",
      "severity": "High",
      "description": "Aircraft is off-center towards the top."
    }
  ],
  "photographer_tips": [
    "Crop tighter at the bottom."
  ]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${userModel}:generateContent?key=${userApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: selectedFile.type,
                data: base64Data
              }
            }
          ]
        }]
      })
    });

    const resData = await response.json();
    loadingSpinner.classList.add('hidden');

    if (!response.ok) {
      return alert(resData.error?.message || 'Gemini API request failed.');
    }

    let rawText = resData.candidates[0].content.parts[0].text.trim();

    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedData = JSON.parse(rawText);
    resultsContent.classList.remove('hidden');
    displayResults(parsedData);

  } catch (err) {
    console.error(err);
    loadingSpinner.classList.add('hidden');
    alert('An error occurred during screening. Open developer tools (F12) for details.');
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
