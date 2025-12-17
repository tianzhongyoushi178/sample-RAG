import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.VITE_GOOGLE_GENAI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Server API Key not configured' });
    }

    const { question, context } = req.body;

    if (!question || !context) {
        return res.status(400).json({ error: 'Missing question or context' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-2.5-flash';

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                answer: {
                    type: Type.STRING,
                    description: 'The answer to the user\'s question, synthesized from the provided context. If the context does not contain the answer, this field should state that the information is not available.'
                },
                sources: {
                    type: Type.ARRAY,
                    description: 'An array of source documents and locations from the context that were used to formulate the answer. This should only include sources that directly support the information in the answer.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            document: {
                                type: Type.STRING,
                                description: 'The name of the source document, as specified in the `[Document: ...]` tag.'
                            },
                            location: {
                                type: Type.STRING,
                                description: 'The location within the source document, as specified in the `[... Location: ...]` tag (e.g., "Page 1" or a sheet name).'
                            }
                        },
                        required: ['document', 'location']
                    }
                }
            },
            required: ['answer', 'sources']
        };

        const systemInstruction = `You are a helpful and polite customer support assistant for a knowledge base.
Your primary goal is to provide clear, easy-to-understand, and step-by-step answers to the user's questions based *exclusively* on the provided text context.

- Your entire response must be in Japanese.
- Maintain a friendly and professional tone.
- Break down procedures into numbered steps.
- Format using Markdown.
- Do not use external knowledge.
- If the answer is not in the context, state it.
- Cite sources when possible.
- Output JSON.`;

        const userPrompt = `CONTEXT:\n---\n${context}\n---\n\nQUESTION: ${question}`;

        const result = await ai.models.generateContent({
            model: model,
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const text = result.text || '';
        const cleanJson = text.replace(/^```json\n?|\n?```$/g, '');
        const jsonResponse = JSON.parse(cleanJson);

        res.status(200).json(jsonResponse);

    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'Failed to process request', details: error.message });
    }
}
