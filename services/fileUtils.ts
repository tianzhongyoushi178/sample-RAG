import { extractTextFromPdf } from './pdfUtils';
import { extractTextFromDocx } from './wordUtils';
import { ocrImage } from './geminiService';
import type { KnowledgeFileContent } from '../types';

export interface ExtractionResult {
    content: KnowledgeFileContent[];
    ocrStatus: 'text_only' | 'ocr_recommended' | 'ocr_applied';
    contentLength: number;
}

/**
 * Helper to convert File to Base64
 */
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            } else {
                reject(new Error("Failed to convert file to base64"));
            }
        };
        reader.onerror = error => reject(error);
    });
};

/**
 * Extracts text content from various file types.
 * @param file The file to process.
 * @returns A promise resolving to the extraction result.
 */
export const extractTextFromFile = async (file: File): Promise<ExtractionResult> => {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.pdf')) {
        const { content, ocrStatus } = await extractTextFromPdf(file);
        return {
            content,
            ocrStatus,
            contentLength: content.reduce((acc, val) => acc + val.text.length, 0)
        };
    }

    if (fileName.endsWith('.docx')) {
        const text = await extractTextFromDocx(file);
        const content = [{ name: 'Document Content', text }];
        return {
            content,
            ocrStatus: 'text_only',
            contentLength: text.length
        };
    }

    if (fileName.endsWith('.txt')) {
        const text = await file.text();
        const content = [{ name: 'Text Content', text }];
        return {
            content,
            ocrStatus: 'text_only',
            contentLength: text.length
        };
    }

    if (file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        const ocrText = await ocrImage(base64, file.type);
        const content = [{ name: 'Image Content', text: ocrText }];
        return {
            content,
            ocrStatus: 'ocr_applied',
            contentLength: ocrText.length
        };
    }

    throw new Error(`サポートされていないファイル形式です: ${file.name}`);
};
