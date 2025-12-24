import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { KnowledgeFile, Folder, ChatMessage, FilteredFileResult, UserProfile } from './types';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { ChatWidget } from './components/ChatWidget';
import { Manual } from './components/Manual';
import { answerFromKnowledgeBase } from './services/geminiService';
import { extractTextFromFile } from './services/fileUtils';
import * as firebase from './services/firebaseService';
import { LoadingSpinner, InfoIcon, UploadIcon, FolderIcon, BotIcon } from './components/Icons';

// Simple unique ID generator
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

interface FileWithRelativePath {
  file: File;
  relativePath: string;
}

// Helper function to recursively get all files from a dropped directory
async function getFilesFromEntry(entry: any): Promise<FileWithRelativePath[]> {
  const files: FileWithRelativePath[] = [];
  const getFile = (fileEntry: any): Promise<File> => {
    return new Promise((resolve, reject) => fileEntry.file(resolve, reject));
  }

  const traverse = async (currentEntry: any) => {
    if (currentEntry.isFile) {
      const file = await getFile(currentEntry);
      const relativePath = currentEntry.fullPath.startsWith('/') ? currentEntry.fullPath.substring(1) : currentEntry.fullPath;
      files.push({ file, relativePath });
    } else if (currentEntry.isDirectory) {
      const reader = currentEntry.createReader();
      const readEntries = (): Promise<any[]> => new Promise((resolve, reject) => reader.readEntries(resolve, reject));

      let entries = await readEntries();
      while (entries.length > 0) {
        for (const subEntry of entries) {
          await traverse(subEntry);
        }
        entries = await readEntries();
      }
    }
  }

  await traverse(entry);
  return files;
}

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = error => reject(error);
  });
};

// Hook to detect mobile screen
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

const App: React.FC = () => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('ファイルを処理し、アップロードしています...');
  const [isDragging, setIsDragging] = useState(false);

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isAiReady, setIsAiReady] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  // Auth state - Mocked for "No Auth" requirement
  const [user, setUser] = useState<any>({ uid: 'guest', email: 'guest@example.com' });
  const [userProfile, setUserProfile] = useState<UserProfile | null>({
    uid: 'guest',
    email: 'guest@example.com',
    status: 'approved',
    isAdmin: false,
    createdAt: { seconds: Date.now() / 1000 },
    hasCompletedSetup: true
  });

  // OCR state
  const [rescanningFileId, setRescanningFileId] = useState<string | null>(null);
  const [rescanProgress, setRescanProgress] = useState('');

  // UI state for mobile
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'files' | 'chat'>('files');

  const CHAT_MIN_WIDTH = 256;
  const CHAT_MAX_WIDTH = 768;
  const CHAT_DEFAULT_WIDTH = 384;

  const [chatWidth, setChatWidth] = useState(() => {
    const savedWidth = localStorage.getItem('chatWidgetWidth');
    if (savedWidth) {
      const parsedWidth = parseInt(savedWidth, 10);
      return Math.max(CHAT_MIN_WIDTH, Math.min(parsedWidth, CHAT_MAX_WIDTH));
    }
    return CHAT_DEFAULT_WIDTH;
  });

  const handleChatResize = useCallback((newWidth: number) => {
    const clampedWidth = Math.max(CHAT_MIN_WIDTH, Math.min(newWidth, CHAT_MAX_WIDTH));
    setChatWidth(clampedWidth);
  }, []);

  const handleChatResizeEnd = useCallback((finalWidth: number) => {
    const clampedWidth = Math.max(CHAT_MIN_WIDTH, Math.min(finalWidth, CHAT_MAX_WIDTH));
    localStorage.setItem('chatWidgetWidth', clampedWidth.toString());
  }, []);

  // Manual state
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsDataLoading(true);
      try {
        const [loadedFolders, loadedFiles] = await Promise.all([
          firebase.getFolders(),
          firebase.getFilesMetadata(),
        ]);

        if (loadedFolders.length === 0) {
          const rootFolder = { id: 'root', name: 'マイナレッジ', parentId: null };
          setFolders([rootFolder]);
          await firebase.saveFolder(rootFolder);
        } else {
          setFolders(loadedFolders);
        }

        setFiles(loadedFiles);
        setChatMessages([]); // Reset chat on data load
        setIsAiReady(true);
      } catch (e: unknown) {
        console.error("Failed to load data from Firebase:", e);
      } finally {
        setIsDataLoading(false);
      }
    };
    loadData().catch(console.error);
  }, []);

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    if (!parentId) {
      console.error("Cannot create folder without a parent.");
      parentId = 'root';
    }
    const newFolder: Folder = { id: generateId(), name, parentId, isLocked: false };
    setFolders(prev => [...prev, newFolder]);
    await firebase.saveFolder(newFolder);
  };

  const handleFileSelect = (file: KnowledgeFile, location?: string) => {
    let pageNumberToSet = 1;

    if (location && file.type === 'pdf') {
      const pageNumberMatch = location.match(/Page (\d+)/);
      if (pageNumberMatch && pageNumberMatch[1]) {
        pageNumberToSet = parseInt(pageNumberMatch[1], 10);
      }
    }

    if (!location && selectedFile?.id === file.id) {
      return;
    }

    setSelectedFile({ ...file, currentPage: pageNumberToSet });
    // Mobile: automatically switch to file view logic handled in render
  };

  const processAndSaveFiles = useCallback(async (filesToProcess: { file: File, folderId: string }[]) => {
    const processAndUploadFile = async (file: File, folderId: string): Promise<KnowledgeFile | null> => {
      try {
        const { content, ocrStatus, contentLength } = await extractTextFromFile(file);

        let fileType: 'pdf' | 'image' | 'text' | 'docx' = 'text';
        if (file.name.toLowerCase().endsWith('.pdf')) fileType = 'pdf';
        else if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.name.toLowerCase().endsWith('.docx')) fileType = 'docx';

        const metadata: Omit<KnowledgeFile, 'url'> = {
          id: generateId(),
          name: file.name,
          type: fileType,
          folderId,
          content,
          contentLength,
          isLocked: false,
          ocrStatus,
          ...(ocrStatus === 'ocr_applied' ? { lastOcrScan: { seconds: Math.floor(Date.now() / 1000) } } : {})
        };

        return await firebase.uploadAndSaveFile(file, metadata);
      } catch (error: any) {
        console.error(`Failed to process or upload ${file.name}:`, error);
        alert(`ファイル「${file.name}」の処理またはアップロードに失敗しました。\n詳細: ${error.message}`);
        return null;
      }
    };

    const filePromises = filesToProcess.map(({ file, folderId }) => processAndUploadFile(file, folderId));

    try {
      const results = await Promise.all(filePromises);
      const newFiles = results.filter((f): f is KnowledgeFile => f !== null);
      if (newFiles.length > 0) {
        setFiles(prev => [...prev, ...newFiles]);
      }
    } catch (e: unknown) {
      console.error("An unexpected error occurred during file processing:", e);
      alert("ファイル処理中に予期せぬエラーが発生しました。");
    }
  }, []);

  const handleFileUpload = useCallback(async (uploadedFiles: FileList, folderId: string) => {
    setProcessingMessage('ファイルを処理しています... スキャンされた書類や画像の場合、AIによる文字認識に時間がかかることがあります。');
    setIsProcessingFile(true);
    const filesToProcess = Array.from(uploadedFiles).map(file => ({ file, folderId }));
    await processAndSaveFiles(filesToProcess);
    setIsProcessingFile(false);
  }, [processAndSaveFiles]);

  const processFolderUpload = useCallback(async (filesToUpload: { file: File, relativePath: string }[], targetFolderId: string) => {
    setProcessingMessage('フォルダを処理しています... スキャンされた書類や画像が含まれる場合、時間がかかることがあります。');
    setIsProcessingFile(true);
    try {
      const allFolders = [...folders];
      const newFoldersToCreate: Folder[] = [];
      const filesToProcess: { file: File; folderId: string }[] = [];

      const findOrCreateFolderId = (path: string, currentFolders: Folder[]): string => {
        let currentParentId = targetFolderId;
        const pathParts = path.split('/').filter(p => p);

        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i];
          const existingFolder = currentFolders.find(f => f.name === part && f.parentId === currentParentId);
          if (existingFolder) {
            currentParentId = existingFolder.id;
          } else {
            const newFolder: Folder = { id: generateId(), name: part, parentId: currentParentId, isLocked: false };
            newFoldersToCreate.push(newFolder);
            currentFolders.push(newFolder);
            currentParentId = newFolder.id;
          }
        }
        return currentParentId;
      };

      const combinedFolders = [...allFolders];
      for (const { file, relativePath } of filesToUpload) {
        if (!relativePath) continue;

        const pathParts = relativePath.split('/');
        pathParts.pop();

        let folderId = targetFolderId;
        if (pathParts.length > 0) {
          folderId = findOrCreateFolderId(pathParts.join('/'), combinedFolders);
        }
        filesToProcess.push({ file, folderId });
      }

      if (newFoldersToCreate.length > 0) {
        setFolders(prev => [...prev, ...newFoldersToCreate]);
        for (const folder of newFoldersToCreate) {
          await firebase.saveFolder(folder);
        }
      }

      if (filesToProcess.length > 0) {
        await processAndSaveFiles(filesToProcess);
      }
    } catch (err: unknown) {
      console.error("Folder upload failed", err);
      alert("フォルダのアップロードに失敗しました。");
    } finally {
      setIsProcessingFile(false);
    }
  }, [folders, processAndSaveFiles]);

  const handleFolderUpload = useCallback(async (uploadedFiles: FileList, targetFolderId: string) => {
    const filesToUpload = Array.from(uploadedFiles).map(file => ({
      file,
      relativePath: (file as any).webkitRelativePath
    }));
    await processFolderUpload(filesToUpload, targetFolderId);
  }, [processFolderUpload]);

  const handleFileMove = async (fileId: string, targetFolderId: string) => {
    const fileToMove = files.find(f => f.id === fileId);
    if (!fileToMove || fileToMove.folderId === targetFolderId) return;

    const updatedFile = { ...fileToMove, folderId: targetFolderId };

    setFiles(prevFiles =>
      prevFiles.map(file =>
        file.id === fileId ? updatedFile : file
      )
    );

    await firebase.updateFileMetadata(updatedFile);
  };

  const handleFolderMove = async (movedFolderId: string, targetFolderId: string) => {
    if (movedFolderId === targetFolderId || movedFolderId === 'root') return;

    const isDescendant = (childId: string, parentId: string, currentFolders: Folder[]): boolean => {
      let parent = currentFolders.find(f => f.id === childId)?.parentId;
      while (parent) {
        if (parent === parentId) return true;
        parent = currentFolders.find(f => f.id === parent)?.parentId;
      }
      return false;
    };

    if (isDescendant(targetFolderId, movedFolderId, folders)) {
      alert("フォルダをその子孫フォルダに移動することはできません。");
      return;
    }

    const folderToMove = folders.find(f => f.id === movedFolderId);
    if (!folderToMove) return;

    const updatedFolder = { ...folderToMove, parentId: targetFolderId };
    setFolders(prevFolders =>
      prevFolders.map(folder =>
        folder.id === movedFolderId ? updatedFolder : folder
      )
    );
    await firebase.saveFolder(updatedFolder);
  };

  const handleFileDelete = async (fileId: string) => {
    const fileToDelete = files.find(f => f.id === fileId);
    if (!fileToDelete) return;
    if (fileToDelete.isLocked) {
      alert("ロックされているファイルは削除できません。");
      return;
    }
    if (!confirm(`本当に「${fileToDelete.name}」を削除しますか？`)) return;

    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
    }
    setFiles(prev => prev.filter(f => f.id !== fileId));
    await firebase.deleteFile(fileToDelete);
  };

  const handleFolderDelete = async (folderId: string) => {
    const folderToDelete = folders.find(f => f.id === folderId);
    if (!folderToDelete) return;
    if (folderToDelete.isLocked) {
      alert("ロックされているフォルダは削除できません。");
      return;
    }
    if (!confirm(`本当に「${folderToDelete.name}」フォルダを削除しますか？\nこのフォルダ内のすべてのファイルとサブフォルダも削除されます。`)) {
      return;
    }

    const foldersToDelete = new Set<string>([folderId]);
    const filesToDeleteIds = new Set<string>();

    const findChildren = (parentId: string) => {
      folders.forEach(folder => {
        if (folder.parentId === parentId) {
          foldersToDelete.add(folder.id);
          findChildren(folder.id);
        }
      });
    };

    findChildren(folderId);

    files.forEach(file => {
      if (foldersToDelete.has(file.folderId)) {
        filesToDeleteIds.add(file.id);
      }
    });

    const isLockedInside = files.some(f => filesToDeleteIds.has(f.id) && f.isLocked) ||
      folders.some(f => foldersToDelete.has(f.id) && f.isLocked);

    if (isLockedInside) {
      alert("フォルダ内にロックされたアイテムが含まれているため、削除できません。");
      return;
    }

    if (selectedFolderId && foldersToDelete.has(selectedFolderId)) {
      setSelectedFolderId('root');
    }
    if (selectedFile && filesToDeleteIds.has(selectedFile.id)) {
      setSelectedFile(null);
    }

    setFolders(prev => prev.filter(f => !foldersToDelete.has(f.id)));
    setFiles(prev => prev.filter(f => !filesToDeleteIds.has(f.id)));

    await firebase.deleteFolderAndContents(folderId);
  };

  const handleToggleFileLock = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const updatedFile = { ...file, isLocked: !file.isLocked };
    setFiles(prev => prev.map(f => f.id === fileId ? updatedFile : f));
    await firebase.updateFileMetadata(updatedFile);
  };

  const handleToggleFolderLock = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    const updatedFolder = { ...folder, isLocked: !folder.isLocked };
    setFolders(prev => prev.map(f => f.id === folderId ? updatedFolder : f));
    await firebase.saveFolder(updatedFolder);
  };


  const getKnowledgeContext = useMemo(() => {
    return files
      .filter(file => file.content && file.content.length > 0)
      .flatMap(file =>
        file.content!.map(
          (contentItem) => `[Document: ${file.name}, Location: ${contentItem.name}]\n${contentItem.text}`
        )
      )
      .join('\n\n---\n\n');
  }, [files, isAiReady]);

  const handleSendMessage = async (message: string) => {
    const userMessage: ChatMessage = {
      id: generateId(),
      sender: 'user',
      text: message,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      // Explicitly type result to handle potential 'unknown' type issues
      const result = await answerFromKnowledgeBase(message, getKnowledgeContext) as { answer: string; sources: any[] };

      const botMessage: ChatMessage = {
        id: generateId(),
        sender: 'bot',
        text: String(result.answer || ''),
        sources: (result.sources || []).map((source: any) => {
          const docName = String(source.document || '');
          const file = files.find(f => f.name === docName);
          return {
            documentName: docName,
            text: `(Source text not implemented)`,
            fileId: file ? String(file.id) : 'unknown',
            location: String(source.location || '')
          };
        }),
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, botMessage]);
    } catch (error: unknown) {
      console.error("Failed to get answer from knowledge base:", error);
      let errorMessageText: string = "申し訳ありません、AIアシスタントでエラーが発生しました。しばらくしてからもう一度お試しください。";
      if (error instanceof Error) {
        errorMessageText = error.message;
      } else if (typeof error === 'string') {
        errorMessageText = error;
      } else {
        errorMessageText = String(error);
      }

      const errorMessage: ChatMessage = {
        id: generateId(),
        sender: 'bot',
        text: errorMessageText,
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSourceClick = (fileId: string, location: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      if (file.type === 'pdf') {
        const pageNumberMatch = location.match(/Page (\d+)/);
        const pageNumber = pageNumberMatch ? parseInt(pageNumberMatch[1], 10) : 1;
        setSelectedFile({ ...file, currentPage: pageNumber });
      } else {
        setSelectedFile(file);
      }
      // On mobile, if a source is clicked, we might want to switch to the files tab
      // However, typical behavior in chat is to stay in chat. 
      // If we want to show the file, we must switch tab.
      if (isMobile) {
        setMobileTab('files');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const allEntries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      allEntries.push(items[i].webkitGetAsEntry());
    }

    const isFolder = allEntries.some(entry => entry && entry.isDirectory);

    if (isFolder) {
      if (allEntries.length > 1) {
        alert("一度に複数のフォルダをドラッグ＆ドロップすることはできません。");
        return;
      }
      const folderEntry = allEntries.find(entry => entry.isDirectory);
      if (folderEntry) {
        const filesToUpload = await getFilesFromEntry(folderEntry);
        await processFolderUpload(filesToUpload, selectedFolderId);
      }
    } else {
      const filesArray = Array.from(e.dataTransfer.files);
      const filesToProcess = filesArray.map(file => ({ file, folderId: selectedFolderId }));
      await processAndSaveFiles(filesToProcess);
    }
  };

  const filteredFiles: FilteredFileResult[] = useMemo(() => {
    const lowerCaseSearchTerm = searchTerm.trim().toLowerCase();

    const escapeHtml = (unsafe: string) =>
      unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    if (!lowerCaseSearchTerm) {
      return files
        .filter(file => file.folderId === selectedFolderId)
        .map(file => ({ id: file.id, file, snippet: '' }));
    }

    const results: FilteredFileResult[] = [];
    const folderNameMap = new Map(folders.map(f => [f.id, f.name]));

    for (const file of files) {
      const isFileNameMatch = file.name.toLowerCase().indexOf(lowerCaseSearchTerm) !== -1;
      const contentMatches: FilteredFileResult[] = [];

      if (file.content) {
        for (const contentItem of file.content) {
          const textLower = contentItem.text.toLowerCase();
          const index = textLower.indexOf(lowerCaseSearchTerm);
          if (index !== -1) {
            const snippetRadius = 40;
            const start = Math.max(0, index - snippetRadius);
            const end = Math.min(contentItem.text.length, index + lowerCaseSearchTerm.length + snippetRadius);

            let snippetText = contentItem.text.substring(start, end);
            snippetText = escapeHtml(snippetText);

            const termInOriginalCase = contentItem.text.substring(index, index + lowerCaseSearchTerm.length);
            const escapedTerm = escapeHtml(termInOriginalCase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedTerm, 'gi');

            let contentSnippet = snippetText.replace(regex, `<strong class="text-sky-700 bg-sky-100 not-italic font-semibold px-1 rounded">${escapeHtml(termInOriginalCase)}</strong>`);

            if (start > 0) contentSnippet = '...' + contentSnippet;
            if (end < contentItem.text.length) contentSnippet += '...';

            contentMatches.push({
              id: `${file.id}-${contentItem.name.replace(/\s/g, '-')}`, // Create a unique ID for React key
              file,
              snippet: contentSnippet,
              location: contentItem.name,
              folderName: folderNameMap.get(file.folderId) as string
            });
          }
        }
      }

      if (contentMatches.length > 0) {
        results.push(...contentMatches);
      } else if (isFileNameMatch) {
        const originalName = escapeHtml(file.name);
        const nameMatchIndex = file.name.toLowerCase().indexOf(lowerCaseSearchTerm);
        const termInName = file.name.substring(nameMatchIndex, nameMatchIndex + lowerCaseSearchTerm.length);

        const escapedTermInName = escapeHtml(termInName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedTermInName, 'gi');
        const snippet: string = originalName.replace(
          regex,
          `<strong class="text-sky-700 bg-sky-100 not-italic font-semibold px-1 rounded">${escapeHtml(termInName)}</strong>`
        );

        results.push({
          id: file.id,
          file,
          snippet: snippet,
          folderName: folderNameMap.get(file.folderId) as string
        });
      }
    }
    return results;
  }, [files, folders, searchTerm, selectedFolderId]);

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    if (term) {
      setSelectedFile(null);
    }
  };

  const handleFolderSelect = (id: string) => {
    setSelectedFolderId(id);
    setSearchTerm('');
    setSelectedFile(null);
  };

  const handleLogout = async () => {
    // "Logout" simply reloads the page to reset the session for a "guest" setup
    window.location.reload();
  };

  const handleFileRescan = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    if (!confirm(`「${file.name}」を再スキャンしてテキスト認識を最適化しますか？\nテキストが少ないページにのみOCRが適用され、ファイルの内容が更新されます。この処理には数分かかる場合があります。`)) {
      return;
    }

    setRescanningFileId(fileId);
    setRescanProgress('スキャンを準備しています...');

    const onProgress = (progress: string) => setRescanProgress(progress);

    try {
      const updatedFile = await firebase.rescanSinglePdf(file, onProgress);
      setFiles(prev => prev.map(f => f.id === fileId ? updatedFile : f));
      if (selectedFile?.id === fileId) {
        setSelectedFile(updatedFile);
      }
    } catch (e: any) {
      console.error("Rescan failed in App.tsx", e);
      const detail = e?.message ? `\n詳細: ${e.message}` : '';
      alert(`OCRスキャンに失敗しました。${detail}`);
    } finally {
      setRescanningFileId(null);
      setRescanProgress('');
    }
  };

  const renderContent = () => {
    if (isDataLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-700 h-full">
          <LoadingSpinner className="text-sky-600 w-12 h-12" />
          <p className="mt-4 text-lg">ナレッジベースを読み込んでいます...</p>
        </div>
      );
    }

    return (
      <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden relative flex-col">
        {/* Main Workspace Area */}
        <div className="flex-1 flex overflow-hidden relative">

          {/* Sidebar Container */}
          {/* Desktop: Always visible. Mobile: Visible only on 'files' tab when no file selected */}
          <div className={`
                    flex-col border-r border-gray-200 bg-white h-full
                    md:flex md:w-[27rem] md:flex-shrink-0
                    ${mobileTab === 'files' && !selectedFile ? 'flex w-full' : 'hidden'}
                `}>
            <Sidebar
              folders={folders}
              files={filteredFiles}
              selectedFolderId={selectedFolderId}
              onFolderSelect={handleFolderSelect}
              onCreateFolder={handleCreateFolder}
              onFileSelect={handleFileSelect}
              onFileUpload={handleFileUpload}
              onFolderUpload={handleFolderUpload}
              onFileMove={handleFileMove}
              onFolderMove={handleFolderMove}
              onFileDelete={handleFileDelete}
              onFolderDelete={handleFolderDelete}
              onToggleFileLock={handleToggleFileLock}
              onToggleFolderLock={handleToggleFolderLock}
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              userEmail={user?.email}
              onLogout={handleLogout}
              userProfile={userProfile}
              onOpenManual={() => setShowManual(true)}
            />
          </div>

          {/* Manual Modal */}
          {showManual && <Manual onClose={() => setShowManual(false)} />}

          {/* Main Content Container */}
          {/* Desktop: Always visible. Mobile: Visible only on 'files' tab when file selected */}
          <main className={`
                    flex-1 flex-col min-w-0 overflow-hidden bg-gray-50
                    md:flex
                    ${mobileTab === 'files' && selectedFile ? 'flex w-full' : 'hidden'}
                `}>
            <div className="flex-1 h-full relative">
              {selectedFile ? (
                <MainContent
                  file={selectedFile}
                  onFileDelete={handleFileDelete}
                  searchTerm={searchTerm}
                  onBackToSearch={() => { setSelectedFile(null); }}
                  userProfile={userProfile}
                  onFileRescan={handleFileRescan}
                  isRescanning={rescanningFileId === selectedFile.id}
                  rescanProgress={rescanningFileId === selectedFile.id ? rescanProgress : ''}
                  showBackButton={isMobile || !!searchTerm}
                />
              ) : (
                // Desktop only welcome screen within main area
                <div className="hidden md:flex flex-col items-center justify-center h-full text-center bg-white rounded-lg shadow-sm border border-gray-200 p-8 m-4">
                  <div className="max-w-md">
                    <InfoIcon className="w-16 h-16 text-sky-500 mx-auto" />
                    <h2 className="mt-6 text-2xl font-bold text-gray-800">ナレッジベースへようこそ</h2>
                    <p className="mt-3 text-gray-500">
                      左側のサイドバーからファイルを選択して表示するか、新しいファイルをアップロードしてください。
                    </p>
                    <div className="mt-8 flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                      <UploadIcon className="w-10 h-10 text-gray-400" />
                      <p className="mt-3 text-gray-400">または、ここにファイルやフォルダをドラッグ＆ドロップしてアップロードできます。</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Chat Widget Container */}
          {/* Desktop: Always visible on right. Mobile: Visible only on 'chat' tab, full width */}
          <div
            className={`
                        flex-col border-l border-gray-200 bg-white h-full z-10
                        md:flex
                        ${mobileTab === 'chat' ? 'flex w-full' : 'hidden'}
                    `}
            style={{ width: !isMobile ? `${chatWidth}px` : undefined }}
          >
            <ChatWidget
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              isLoading={isChatLoading}
              isReady={isAiReady}
              onSourceClick={handleSourceClick}
              width={chatWidth}
              onResize={handleChatResize}
              onResizeEnd={handleChatResizeEnd}
              isMobile={isMobile}
            />
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden h-16 bg-white border-t border-gray-200 flex flex-shrink-0 items-center justify-around z-50 pb-safe">
          <button
            onClick={() => setMobileTab('files')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${mobileTab === 'files' ? 'text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FolderIcon className="w-6 h-6" />
            <span className="text-xs font-medium">ファイル</span>
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${mobileTab === 'chat' ? 'text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <BotIcon className="w-6 h-6" />
            <span className="text-xs font-medium">AIチャット</span>
          </button>
        </nav>
      </div>
    );
  };

  return (
    <div
      className="h-screen bg-gray-50 text-gray-900 overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {renderContent()}
      {userProfile?.status === 'approved' && (
        <>
          {isDragging && (
            <div className="absolute inset-0 bg-sky-100/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 pointer-events-none">
              <UploadIcon className="w-24 h-24 text-sky-500 animate-bounce" />
              <p className="mt-6 text-2xl font-bold text-sky-700">ここにドロップしてアップロード</p>
            </div>
          )}
          {isProcessingFile && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
              <LoadingSpinner className="text-sky-600 w-12 h-12" />
              <p className="mt-4 text-lg text-gray-700">{processingMessage}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;