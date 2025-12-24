declare const mammoth: any;

/**
 * Extracts raw text from a Word (.docx) file using mammoth.js.
 * @param file The docx file to process.
 * @returns A promise resolving to the extracted text.
 */
export const extractTextFromDocx = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value || '';
    } catch (error) {
        console.error("Error extracting text from DOCX:", error);
        throw new Error("Wordファイルの解析に失敗しました。");
    }
};
