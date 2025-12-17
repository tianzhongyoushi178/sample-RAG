import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.VITE_GOOGLE_GENAI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Server API Key not configured' });
    }

    const { image, mimeType } = req.body;

    if (!image || !mimeType) {
        return res.status(400).json({ error: 'Missing image or mimeType' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.5-flash';

        const imagePart = {
            inlineData: {
                data: image,
                mimeType: mimeType,
            },
        };

        const textPart = {
            text: "Extract all text content from this image. Only return the transcribed text, with no additional commentary, formatting, or explanations.",
        };

        const result = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
        });

        res.status(200).json({ text: result.text || '' });

    } catch (error) {
        console.error('Gemini OCR Error:', error);
        res.status(500).json({ error: 'Failed to process OCR', details: error.message });
    }
}
