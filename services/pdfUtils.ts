import type { KnowledgeFileContent } from '../types';
import { ocrImage } from './geminiService';

// This declares the pdfjsLib object that is loaded from the CDN in index.html
declare const pdfjsLib: any;

const MIN_TEXT_LENGTH_FOR_OCR_PER_PAGE = 100; // Characters threshold to trigger OCR recommendation

/**
 * Processes a single PDF page using OCR.
 * @param page A pdf.js page object.
 * @returns A promise that resolves to the OCR-extracted text content of the page.
 */
const processPageWithOcr = async (page: any): Promise<string> => {
    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        // Use a higher scale for better OCR quality. 2.0 corresponds to ~192 DPI for a standard page.
        const viewport = page.getViewport({ scale: 2.0 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
            throw new Error("Could not get 2D context from canvas");
        }

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Convert to JPEG for smaller size compared to PNG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const base64Image = dataUrl.split(',')[1];

        if (base64Image) {
             return await ocrImage(base64Image, 'image/jpeg');
        }
        return '';
    } catch (ocrError) {
        console.error(`OCR failed for page ${page.pageNumber}:`, ocrError);
        // Re-throw to be caught by the generator's per-page error handler
        throw ocrError;
    }
};

/**
 * Processes a single PDF page for standard text extraction.
 * @param page A pdf.js page object.
 * @returns A promise that resolves to the text content of the page.
 */
const processPageForText = async (page: any): Promise<string> => {
    const textContent = await page.getTextContent();
    return textContent.items.map((item: any) => item.str).join(' ');
};

/**
 * Extracts text content from each page of a PDF file.
 * @param file The PDF file to process.
 * @returns A promise resolving to content and an OCR status recommendation.
 */
export const extractTextFromPdf = async (file: File): Promise<{ content: KnowledgeFileContent[], ocrStatus: 'text_only' | 'ocr_recommended' }> => {
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      if (!event.target?.result) {
        return reject(new Error("Failed to read file."));
      }

      try {
        const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const pageContents: KnowledgeFileContent[] = [];
        let totalTextLength = 0;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const pageText = await processPageForText(page);
          pageContents.push({ name: `Page ${i}`, text: pageText });
          totalTextLength += pageText.trim().length;
        }

        const ocrRecommended = pdf.numPages > 0 && (totalTextLength / pdf.numPages) < MIN_TEXT_LENGTH_FOR_OCR_PER_PAGE;
        const ocrStatus = ocrRecommended ? 'ocr_recommended' : 'text_only';
        
        resolve({ content: pageContents, ocrStatus });

      } catch (error) {
        console.error("Error parsing PDF:", error);
        reject(new Error("Could not parse the PDF file."));
      }
    };

    fileReader.onerror = (error) => {
      reject(error);
    };
    
    fileReader.readAsArrayBuffer(file);
  });
};

/**
 * Extracts text content from each page of a PDF from a URL using standard text extraction.
 * @param url The URL of the PDF file to process.
 * @returns A promise resolving to content and an OCR status recommendation.
 */
export const extractTextFromPdfUrl = async (url: string): Promise<{ content: KnowledgeFileContent[], ocrStatus: 'text_only' | 'ocr_recommended' }> => {
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    const pageContents: KnowledgeFileContent[] = [];
    let totalTextLength = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const pageText = await processPageForText(page);
      pageContents.push({ name: `Page ${i}`, text: pageText });
      totalTextLength += pageText.trim().length;
    }

    const ocrRecommended = pdf.numPages > 0 && (totalTextLength / pdf.numPages) < MIN_TEXT_LENGTH_FOR_OCR_PER_PAGE;
    const ocrStatus = ocrRecommended ? 'ocr_recommended' : 'text_only';
    
    return { content: pageContents, ocrStatus };

  } catch (error) {
    console.error("Error parsing PDF from URL:", error);
    throw new Error("Could not parse the PDF file from URL.");
  }
};

/**
 * Asynchronously processes a PDF, yielding the text content for each page.
 * It intelligently applies OCR only to pages with sparse text.
 * @param url The URL of the PDF file to process.
 * @param existingContent The current text content of the file from the database.
 * @param onProgress A callback to report progress.
 * @yields An object containing the page index and its extracted content.
 */
export async function* rescanPdfWithOcrGenerator(
  url: string,
  existingContent: KnowledgeFileContent[],
  onProgress: (progress: string) => void
): AsyncGenerator<{ pageIndex: number; content: KnowledgeFileContent }> {
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress(`ページ ${i} / ${pdf.numPages} を分析中...`);
      const pageIndex = i - 1;

      // If the page already has sufficient text in the database, skip processing it.
      const existingPageContent = existingContent?.[pageIndex];
      if (existingPageContent?.text && existingPageContent.text.trim().length >= MIN_TEXT_LENGTH_FOR_OCR_PER_PAGE) {
        onProgress(`ページ ${i} / ${pdf.numPages}: 既存のテキストを維持`);
        yield {
          pageIndex: pageIndex,
          content: existingPageContent,
        };
        continue;
      }

      const page = await pdf.getPage(i);

      const standardText = await processPageForText(page);
      let pageText = standardText;

      if (standardText.trim().length < MIN_TEXT_LENGTH_FOR_OCR_PER_PAGE) {
        onProgress(`ページ ${i} / ${pdf.numPages} をOCR処理中...`);
        try {
          pageText = await processPageWithOcr(page);
        } catch (ocrError) {
          console.error(`ページ ${i} のOCRに失敗しました。抽出済みのテキストを維持します。`, ocrError);
          // OCR fails, but we keep the standardText, so no data is lost.
        }
      }

      yield {
        pageIndex: pageIndex,
        content: { name: `Page ${i}`, text: pageText },
      };
    }
  } catch (error) {
    console.error("PDFのOCRジェネレータ処理中にエラーが発生しました:", error);
    throw new Error("PDFの処理中にエラーが発生しました。");
  }
}