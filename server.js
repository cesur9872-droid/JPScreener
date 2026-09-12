import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes and custom headers
app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'x-api-key', 'x-model', 'x-strictness'],
  methods: ['GET', 'POST', 'OPTIONS']
}));

const upload = multer({ storage: multer.memoryStorage() });
app.use(express.json());

app.get('/', (req, res) => {
  res.send('JetPhotos Screener API Backend is running!');
});

app.post('/api/prescreen', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const apiKey = req.headers['x-api-key'] || process.env.GEMINI_API_KEY;
    let modelName = req.headers['x-model'] || 'gemini-2.5-flash';
    const strictness = req.headers['x-strictness'] || 'standard';

    // Fallback if invalid model sent
    if (modelName.includes('3.5')) {
      modelName = 'gemini-2.5-flash';
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing GEMINI_API_KEY. Set it in Settings or Render env.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const prompt = `You are a strict JetPhotos.com screening assistant. Analyze this aircraft photograph for JetPhotos acceptance standards.
Strictness level requested: ${strictness}.

Return ONLY a raw JSON object with no markdown formatting or backticks matching this structure:
{
  "verdict": "ACCEPTED" or "REJECTED",
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

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [prompt, imagePart]
    });

    let textResponse = response.text.trim();

    if (textResponse.startsWith('```json')) {
      textResponse = textResponse.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (textResponse.startsWith('```')) {
      textResponse = textResponse.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedData = JSON.parse(textResponse);
    return res.json(parsedData);

  } catch (error) {
    console.error('Screening Error:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred while processing the image with Gemini AI.' 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
