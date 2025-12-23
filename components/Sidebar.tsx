import React, { useState, useRef, useEffect } from 'react';
import type { KnowledgeFile, Folder, FilteredFileResult, UserProfile } from '../types';
import { FolderIcon, FileIcon, FolderPlusIcon, UploadIcon, FolderUploadIcon, TrashIcon, LockIcon, UnlockIcon, SearchIcon, XIcon, UserIcon, AdminIcon, ChevronRightIcon, ChevronDownIcon, CloudIcon, CloudOffIcon, InfoIcon } from './Icons';
import { Logo } from './Logo';

interface SidebarProps {
  folders: Folder[];
  files: FilteredFileResult[];
  selectedFolderId: string;
  onFolderSelect: (folderId: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onFileSelect: (file: KnowledgeFile, location?: string) => void;
  onFileUpload: (files: FileList, folderId: string) => void;
  onFolderUpload: (files: FileList, folderId: string) => void;
  onFileMove: (fileId: string, folderId: string) => void;
  onFolderMove: (folderId: string, targetFolderId: string) => void;
  onFileDelete: (fileId: string) => void;
  onFolderDelete: (folderId: string) => void;
  onToggleFileLock: (fileId: string) => void;
  onToggleFolderLock: (folderId: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  userEmail: string | null;
  onLogout: () => void;
  userProfile: UserProfile | null;
  onSwitchToAdmin?: () => void; // Optional now, effectively unused
  onOpenManual: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  files,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  onFileSelect,
  onFileUpload,
  onFolderUpload,
  onFileMove,
  onFolderMove,
  onFileDelete,
  onFolderDelete,
  onToggleFileLock,
  onToggleFolderLock,
  searchTerm,
  onSearchChange,
  userEmail,
  onLogout,
  userProfile,
  onOpenManual,
}) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [draggedOverFolderId, setDraggedOverFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set(['root']));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isSearching = searchTerm.trim() !== '';

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolderIds);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolderIds(newExpanded);
  };

  // Ensure current selected folder is always visible in tree
  useEffect(() => {
    if (selectedFolderId === 'root') return;

    const parentChain = new Set<string>();
    let current = folders.find(f => f.id === selectedFolderId);
    while (current && current.parentId) {
      parentChain.add(current.parentId);
      current = folders.find(f => f.id === current!.parentId);
    }

    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      parentChain.forEach(id => next.add(id));
      return next;
    });
  }, [selectedFolderId, folders]);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), selectedFolderId);
      setNewFolderName('');
      setIsCreatingFolder(false);
      // Ensure the folder where created is expanded
      setExpandedFolderIds(prev => new Set(prev).add(selectedFolderId));
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderUploadClick = () => {
    folderInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFileUpload(files, selectedFolderId);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFolderUpload(files, selectedFolderId);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  };

  const handleFileDragStart = (e: React.DragEvent<HTMLDivElement>, fileId: string) => {
    e.dataTransfer.setData('application/vnd.knowledge-file.id', fileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragStart = (e: React.DragEvent<HTMLDivElement>, folderId: string) => {
    e.dataTransfer.setData('application/vnd.knowledge-folder.id', folderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragOver = (e: React.DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverFolderId !== folderId) {
      setDraggedOverFolderId(folderId);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverFolderId(null);
  };

  const handleFolderDrop = (e: React.DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverFolderId(null);
    const fileId = e.dataTransfer.getData('application/vnd.knowledge-file.id');
    const movedFolderId = e.dataTransfer.getData('application/vnd.knowledge-folder.id');

    if (fileId) {
      onFileMove(fileId, folderId);
    } else if (movedFolderId) {
      if (movedFolderId !== folderId) {
        onFolderMove(movedFolderId, folderId);
      }
    }
  };

  const selectedFolderName = folders.find(f => f.id === selectedFolderId)?.name || 'フォルダ';

  const FolderTree: React.FC<{ parentId: string }> = ({ parentId }) => {
    const children = folders
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (children.length === 0) return null;

    return (
      <ul className="pl-4 border-l border-gray-200 ml-2">
        {children.map(folder => {
          const hasChildren = folders.some(f => f.parentId === folder.id);
          const isExpanded = expandedFolderIds.has(folder.id);

          return (
            <li key={folder.id} className="mt-1">
              <div className="flex items-center group">
                <button
                  onClick={(e) => toggleFolder(folder.id, e)}
                  className={`p-1 rounded-md hover:bg-gray-100 text-gray-500 ${!hasChildren ? 'invisible' : ''}`}
                >
                  {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                </button>
                <div
                  onClick={(e) => { e.stopPropagation(); onFolderSelect(folder.id); }}
                  onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                  onDragLeave={handleFolderDragLeave}
                  onDrop={(e) => handleFolderDrop(e, folder.id)}
                  draggable={true}
                  onDragStart={(e) => handleFolderDragStart(e, folder.id)}
                  className={`flex-1 flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 truncate ${selectedFolderId === folder.id && !isSearching ? 'bg-sky-50 text-sky-700' : 'text-gray-600 hover:bg-gray-100'} ${draggedOverFolderId === folder.id ? 'bg-sky-100 ring-2 ring-sky-300' : ''}`}
                >
                  {folder.isLocked && <LockIcon className="w-3 h-3 mr-2 text-yellow-500 flex-shrink-0" />}
                  <FolderIcon className={`w-5 h-5 mr-2 flex-shrink-0 ${selectedFolderId === folder.id ? 'text-sky-500' : 'text-gray-400'}`} />
                  <span className="font-medium pointer-events-none truncate text-sm">{folder.name}</span>
                </div>
                <div className="ml-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFolderLock(folder.id); }}
                    className="p-1 text-gray-400 hover:text-yellow-500"
                    title={folder.isLocked ? "ロック解除" : "ロック"}
                  >
                    {folder.isLocked ? <LockIcon className="w-3 h-3" /> : <UnlockIcon className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFolderDelete(folder.id); }}
                    className="p-1 text-gray-400 hover:text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed"
                    title={folder.isLocked ? "フォルダがロックされています" : `「${folder.name}」を削除`}
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {isExpanded && <FolderTree parentId={folder.id} />}
            </li>
          );
        })}
      </ul>
    );
  };

  // Removed fixed width (w-[27rem]) to let parent container control sizing (w-full h-full)
  return (
    <aside className="w-full h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="flex-shrink-0 py-4 border-b border-gray-100">
        <Logo />
        {/* Connection Status Indicator */}
        <div className="px-4 mt-2 flex items-center gap-2 text-xs text-gray-400">
          {import.meta.env.VITE_FIREBASE_API_KEY ? (
            <>
              <CloudIcon className="w-3 h-3 text-green-500" />
              <span>Online (Firebase)</span>
            </>
          ) : (
            <>
              <CloudOffIcon className="w-3 h-3 text-orange-500" />
              <span>Offline (Local Mode)</span>
            </>
          )}
        </div>
      </div>
      {/* Action Buttons */}
      <div className="p-4 flex-shrink-0 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <button onClick={handleUploadClick} className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-3 rounded-md transition-colors text-sm shadow-sm" title="ファイルをアップロード">
            <UploadIcon className="w-4 h-4 text-gray-500" />
            ファイル
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" />

          <button onClick={handleFolderUploadClick} className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-3 rounded-md transition-colors text-sm shadow-sm" title="フォルダをアップロード">
            <FolderUploadIcon className="w-4 h-4 text-gray-500" />
            フォルダ
          </button>
          <input type="file" ref={folderInputRef} onChange={handleFolderChange} className="hidden" multiple {...{ webkitdirectory: "" }} />
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 flex-shrink-0 border-b border-gray-200">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ファイル名や内容を検索..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-gray-100 text-gray-900 rounded-md py-2 pl-10 pr-8 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-colors border border-transparent focus:border-sky-300"
            aria-label="ファイルを検索"
          />
          {isSearching && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
              title="検索をクリア"
              aria-label="検索をクリア"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tree and File List */}
      <div className="flex-1 overflow-y-auto p-4">
        {!isSearching && (
          <>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">ナビゲーション</h3>
            {/* Root Folder */}
            <div className="flex items-center group">
              <button
                onClick={(e) => toggleFolder('root', e)}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
              >
                {expandedFolderIds.has('root') ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
              </button>
              <div
                onClick={() => onFolderSelect('root')}
                onDragOver={(e) => handleFolderDragOver(e, 'root')}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, 'root')}
                className={`flex-1 flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 ${selectedFolderId === 'root' ? 'bg-sky-50 text-sky-700' : 'text-gray-600 hover:bg-gray-100'} ${draggedOverFolderId === 'root' ? 'bg-sky-100 ring-2 ring-sky-300' : ''}`}
              >
                <FolderIcon className={`w-5 h-5 mr-2 flex-shrink-0 ${selectedFolderId === 'root' ? 'text-sky-500' : 'text-gray-400'}`} />
                <span className="font-medium truncate text-sm">{folders.find(f => f.id === 'root')?.name || 'マイナレッジ'}</span>
              </div>
            </div>
            {expandedFolderIds.has('root') && <FolderTree parentId="root" />}

            <div className="mt-4 pl-2">
              <button onClick={() => setIsCreatingFolder(prev => !prev)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-full p-2 rounded-md hover:bg-gray-100">
                <FolderPlusIcon className="w-5 h-5" />
                <span>新しいフォルダを作成</span>
              </button>
              {isCreatingFolder && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} placeholder="フォルダ名"
                    className="flex-1 bg-white border border-gray-300 text-gray-900 rounded-md py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500" autoFocus
                  />
                  <button onClick={handleCreateFolder} className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold py-1 px-3 rounded-md">作成</button>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 my-4"></div>
          </>
        )}

        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex-shrink-0">
          {isSearching ? '検索結果' : <>ファイル: <span className="text-sky-600 normal-case">{selectedFolderName}</span></>}
        </h3>
        {files.length > 0 ? (
          <ul className="space-y-1">
            {files.map((result) => (
              <li key={result.id}>
                <div
                  draggable={true} onDragStart={(e) => handleFileDragStart(e, result.file.id)} onClick={() => onFileSelect(result.file, result.location)}
                  className="group p-2 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center">
                    {result.file.isLocked && <LockIcon className="w-3.5 h-3.5 mr-2 text-yellow-500 flex-shrink-0" />}
                    <FileIcon type={result.file.type} className="w-5 h-5 mr-3 flex-shrink-0" />
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium text-gray-700 truncate" title={result.file.name}>{result.file.name}</p>
                      {isSearching && result.folderName && (
                        <p className="text-xs text-gray-500 truncate" title={`フォルダ: ${result.folderName}`}>
                          フォルダ: {result.folderName}
                        </p>
                      )}
                    </div>
                    <div className="ml-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); onToggleFileLock(result.file.id); }} className="p-1 text-gray-400 hover:text-yellow-500" title={result.file.isLocked ? "ロック解除" : "ロック"}>
                        {result.file.isLocked ? <LockIcon className="w-4 h-4" /> : <UnlockIcon className="w-4 h-4" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onFileDelete(result.file.id); }} className="p-1 text-gray-400 hover:text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed" title={result.file.isLocked ? "ファイルがロックされています" : `「${result.file.name}」を削除`}>
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isSearching && result.snippet && (
                    <div className="mt-1.5 pl-8 pr-1">
                      <p className="text-xs text-gray-600 italic line-clamp-2">
                        {result.location && <strong className="font-semibold text-sky-600 not-italic mr-1">{result.location}:</strong>}
                        <span dangerouslySetInnerHTML={{ __html: result.snippet }} />
                      </p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 px-2">
            {isSearching ? '一致するファイルが見つかりません。' : 'このフォルダにはファイルがありません。'}
          </p>
        )}
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0 space-y-3 bg-gray-50/50">
        <button
          onClick={onOpenManual}
          className="w-full flex items-center justify-center gap-2 text-sky-600 bg-white border border-sky-200 hover:bg-sky-50 font-medium py-2 px-4 rounded-md transition-colors shadow-sm"
        >
          <InfoIcon className="w-5 h-5" />
          <span>使い方を見る</span>
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <UserIcon className="w-6 h-6 p-1 bg-gray-200 text-gray-600 rounded-full flex-shrink-0" />
            <span className="text-sm text-gray-700 truncate" title={userEmail || ''}>{userEmail}</span>
          </div>
          <button
            onClick={onLogout}
            className="text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-200 py-1 px-3 rounded-md transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </aside>
  );
};