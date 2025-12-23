

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  uid: string;
  email: string;
  status: UserStatus;
  isAdmin: boolean;
  createdAt: any; // Firestore Timestamp
  hasCompletedSetup?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  isLocked?: boolean;
}

export interface KnowledgeFileContent {
  name: string; // e.g., "Page 1" or "Sheet Name"
  text: string;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  url?: string; // Firebase Storage URL
  folderId: string;
  content?: KnowledgeFileContent[]; // Extracted text per page for PDFs or per sheet for Excel
  contentLength: number;
  currentPage?: number;
  isLocked?: boolean;
  storagePath?: string; // Full path in Firebase Storage
  ocrStatus?: 'not_scanned' | 'text_only' | 'ocr_applied' | 'ocr_recommended';
  lastOcrScan?: any; // Firestore Timestamp
}

export interface ChatMessageSource {
  documentName: string;
  text: string;
  fileId: string;
  location: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  sources?: ChatMessageSource[];
  timestamp: number;
}

export interface FilteredFileResult {
  id: string;
  file: KnowledgeFile;
  snippet: string; // Can be an empty string if not searching
  location?: string;
  folderName?: string;
}