import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static('public'));
app.use(express.json());

// Updated to include 3.5 & 3.6 models
const ALLOWED_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash'
];

app.post('/api/prescreen', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded.' });
    }

    const apiKey = req.headers['x-api-key'] || process.env.GEMINI_API_KEY;
    let modelName = req.headers['x-model'];
    const strictness = req.headers['x-strictness'] || 'standard';

    // Updated fallback to active 3.5 model
    if (!modelName || !ALLOWED_MODELS.includes(modelName)) {
      modelName = 'gemini-3.5-flash';
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'Missing API Key. Please enter your Gemini API key in Settings (⚙️).'
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const imageBase64 = req.file.buffer.toString('base64');

    let strictnessInstruction = '';
    if (strictness === 'strict') {
      strictnessInstruction = 'Apply zero-tolerance screening. Reject any minor centering issues, light dust spots, or soft focus.';
    } else if (strictness === 'lenient') {
      strictnessInstruction = 'Provide constructive advice but mark as ACCEPTED unless severe major flaws are present.';
    } else {
      strictnessInstruction = 'Apply standard JetPhotos database screening rules.';
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: req.file.mimetype, data: imageBase64 } },
            {
              text: `Analyze this photo for JetPhotos screening. ${strictnessInstruction} Return strict JSON format with keys: verdict, score, summary, reject_reasons (array of {category, severity, description}), photographer_tips (array of strings).`
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawText = response.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    const data = JSON.parse(rawText);
    return res.json(data);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Error processing photo.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});