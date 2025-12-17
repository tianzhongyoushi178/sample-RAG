// NOTE: This service now delegates to the backend (Vercel Serverless Functions)
// to secure the API Key.

export const answerFromKnowledgeBase = async (question: string, context: string): Promise<{ answer: string; sources: { document: string; location: string }[] }> => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, context }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse;

  } catch (error) {
    console.error("Gemini API call failed:", error);
    if (error instanceof Error) {
      throw new Error(`AIへの問い合わせに失敗しました: ${error.message}`);
    }
    throw new Error("AIへの問い合わせ中にエラーが発生しました。");
  }
};


export const ocrImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image, mimeType }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';

  } catch (error) {
    console.error("Gemini OCR call failed:", error);
    if (error instanceof Error) {
      throw new Error(`OCR処理に失敗しました: ${error.message}`);
    }
    throw new Error("OCR処理中にエラーが発生しました。");
  }
};