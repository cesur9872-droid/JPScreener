import express from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

// --- CORS & Preflight Middleware ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-api-key, x-model, x-strictness');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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
    const modelName = req.headers['x-model'] || 'gemini-2.5-flash';
    const strictness = req.headers['x-strictness'] || 'standard';

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing GEMINI_API_KEY on server and client.' });
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
  "score": "A number from 0 to 100",
  "summary": "Brief overall assessment",
  "reject_reasons": [
    {
      "category": "e.g., Centering, Softness/Blur, Dust Spots, Over-exposure, Framing",
      "severity": "Low", "Medium", or "High",
      "description": "Specific details on why it violates guidelines"
    }
  ],
  "photographer_tips": [
    "Actionable editing tips to fix the issues"
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
