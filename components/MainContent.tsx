import React from 'react';
import type { KnowledgeFile, UserProfile } from '../types';
import { PdfViewer } from './PdfViewer';
import { TrashIcon, DownloadIcon, ArrowLeftIcon, LockIcon } from './Icons';

interface MainContentProps {
  file: KnowledgeFile | null;
  onFileDelete: (fileId: string) => void;
  searchTerm: string;
  onBackToSearch: () => void;
  userProfile: UserProfile | null;
  onFileRescan: (fileId: string) => void;
  isRescanning: boolean;
  rescanProgress: string;
  showBackButton?: boolean;
}

export const MainContent: React.FC<MainContentProps> = ({ file, onFileDelete, searchTerm, onBackToSearch, userProfile, onFileRescan, isRescanning, rescanProgress, showBackButton }) => {
  if (!file) {
    return null; // The welcome message is now in App.tsx
  }

  // Ensure file content exists before trying to render. It might be loaded asynchronously.
  if (file.type === 'pdf') {
    if (!file.url) return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="mt-4 text-gray-600">PDFのURLを読み込んでいます...</p>
      </div>
    );
    // Add a key to ensure the component re-mounts when the file changes
    return <PdfViewer 
      file={file}
      initialPage={file.currentPage} 
      key={file.id} 
      onDelete={() => onFileDelete(file.id)}
      showBackButton={showBackButton || !!searchTerm}
      onBackToSearch={onBackToSearch}
      userProfile={userProfile}
      onFileRescan={() => onFileRescan(file.id)}
      isRescanning={isRescanning}
      rescanProgress={rescanProgress}
    />;
  }
  
  if (file.type === 'demo3d') {
    const handleDownload = () => {
      if (!file.url) {
        alert("ダウンロードするファイルが見つかりません。");
        return;
      }
      // Create a temporary link element to trigger download from firebase url
      const a = document.createElement('a');
      a.href = file.url;
      a.target = '_blank'; // Using target blank can help in some browsers
      a.download = file.name; // Set the file name for download
      document.body.appendChild(a);
      a.click();
      // Clean up by removing the link
      document.body.removeChild(a);
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              {file.isLocked && <LockIcon className="w-6 h-6 text-yellow-500 flex-shrink-0" title="このファイルはロックされています" />}
              <h2 className="text-2xl font-bold text-sky-600 truncate">{file.name}</h2>
            </div>
            <div className="flex items-center gap-4">
                {(showBackButton || !!searchTerm) && (
                    <button
                        onClick={onBackToSearch}
                        className="flex items-center gap-2 py-2 px-3 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        title="戻る"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                        <span>戻る</span>
                    </button>
                )}
                <button 
                    onClick={() => onFileDelete(file.id)} 
                    className="p-2 rounded-full bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    title={file.isLocked ? "ファイルがロックされています" : "ファイルを削除"}
                    disabled={file.isLocked}
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-gray-50 rounded-md p-8 border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800">ファイルをダウンロード</h3>
            <p className="text-gray-500 mt-2 max-w-lg">
                このファイル形式（.demo3D）は、ブラウザで表示できません。<br />
                ファイルをダウンロードし、専用のビューアアプリケーションで開いてください。
            </p>
            <button
              onClick={handleDownload}
              className="mt-6 flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-sky-500 transition-all duration-200 shadow-sm"
            >
              <DownloadIcon className="w-5 h-5" />
              ダウンロード
            </button>
        </div>
      </div>
    );
  }

  if (file.type === 'image') {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
             <div className="flex-shrink-0 bg-white border-b border-gray-200 rounded-t-lg p-2 flex items-center justify-between gap-4 sticky top-0 z-10">
                <div className="flex items-center gap-2 w-1/3">
                    {(showBackButton || !!searchTerm) && (
                        <button 
                            onClick={onBackToSearch} 
                            className="flex items-center gap-2 py-2 px-3 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors" 
                            title="戻る"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                            <span>戻る</span>
                        </button>
                    )}
                </div>
                <h2 className="text-lg font-semibold text-gray-800 truncate px-2">{file.name}</h2>
                <div className="flex items-center justify-end gap-2 w-1/3">
                     {file.isLocked && <LockIcon className="w-5 h-5 text-yellow-500" title="このファイルはロックされています" />}
                      <button 
                          onClick={() => onFileDelete(file.id)} 
                          className="p-2 rounded-full bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" 
                          title={file.isLocked ? "ファイルがロックされています" : "ファイルを削除"}
                          disabled={file.isLocked}
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                </div>
             </div>
             <div className="flex-1 overflow-auto p-4 flex flex-col items-center bg-gray-50">
                 <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200 max-w-full">
                    <img src={file.url} alt={file.name} className="max-w-full max-h-[70vh] object-contain" />
                 </div>
                 
                 <div className="mt-6 w-full max-w-3xl bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                     <h3 className="text-sm font-semibold text-sky-600 mb-2 uppercase tracking-wider">AI認識テキスト (OCR)</h3>
                     <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded border border-gray-200">
                         {file.content && file.content[0] ? file.content[0].text : "テキストが検出されませんでした。"}
                     </div>
                 </div>
             </div>
        </div>
      );
  }

  return (
    <div className="flex items-center justify-center h-full text-center">
      <p className="text-gray-500">サポートされていないファイル形式です。</p>
    </div>
  );
};