import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { SendIcon, BotIcon, UserIcon, LinkIcon } from './Icons';
import { marked } from 'marked';

interface ChatWidgetProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isReady: boolean;
  onSourceClick: (fileId: string, location: string) => void;
  width: number;
  onResize: (newWidth: number) => void;
  onResizeEnd: (finalWidth: number) => void;
  isMobile?: boolean;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ messages, onSendMessage, isLoading, isReady, onSourceClick, width, onResize, onResizeEnd, isMobile }) => {
  const [input, setInput] = useState('');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    let finalWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = window.innerWidth - moveEvent.clientX;
      finalWidth = newWidth;
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onResizeEnd(finalWidth);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  const isInputDisabled = isLoading || !isReady;

  return (
    <aside style={{ width: isMobile ? '100%' : `${width}px` }} className="relative bg-white border-l border-gray-200 flex flex-col flex-shrink-0 h-full">
        {!isMobile && (
            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 left-0 h-full w-2 -translate-x-1/2 cursor-col-resize z-10 group"
                aria-label="チャットパネルのサイズを変更"
                role="separator"
                aria-orientation="vertical"
            >
                <div className="w-px h-full bg-gray-200 group-hover:bg-sky-500 transition-colors duration-200" />
            </div>
        )}
       <header 
         className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50/50"
       >
           <h3 className="font-bold text-lg text-gray-900">AIアシスタントに質問</h3>
           <p className="text-xs text-gray-500 mt-1">ナレッジベース全体から横断的に情報を検索します。</p>
       </header>
        <div className="flex-1 p-4 overflow-y-auto min-h-0 bg-gray-50">
            <div className="space-y-4">
                {messages.map((msg) => {
                    const isExpanded = expandedSources[msg.id] || false;
                    const SOURCE_COLLAPSE_THRESHOLD = 3;
                    const hasManySources = msg.sources && msg.sources.length > SOURCE_COLLAPSE_THRESHOLD;

                    const displayedSources = hasManySources && !isExpanded
                        ? msg.sources?.slice(0, SOURCE_COLLAPSE_THRESHOLD)
                        : msg.sources;
                    
                    return (
                        <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                            {msg.sender === 'bot' && <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"><BotIcon className="w-5 h-5 text-white" /></div>}
                            <div className={`max-w-[85%] rounded-lg p-3 shadow-sm ${msg.sender === 'user' ? 'bg-sky-600 text-white' : 'bg-white text-gray-800 border border-gray-200'}`}>
                                {msg.sender === 'user' ? (
                                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                ) : (
                                    <div
                                        className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:my-3 prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900"
                                        dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }}
                                    />
                                )}
                                {displayedSources && displayedSources.length > 0 && (
                                  <div className="mt-3 border-t border-gray-200 pt-3">
                                      <h4 className="text-xs font-semibold text-gray-500 mb-2">ソース:</h4>
                                      <div className="flex flex-wrap gap-2">
                                          {displayedSources.map((source, index) => (
                                             <button 
                                                key={index}
                                                onClick={() => onSourceClick(source.fileId, source.location)}
                                                className="text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-100 rounded-full py-1 px-3 flex items-center gap-1.5 group transition-colors"
                                              >
                                                <LinkIcon className="w-3 h-3 text-sky-500 group-hover:text-sky-600 flex-shrink-0" />
                                                <span className="truncate" title={`${source.documentName} - ${source.location}`}>
                                                    {source.documentName} ({source.location})
                                                </span>
                                              </button> 
                                          ))}
                                      </div>
                                      {hasManySources && (
                                        <button
                                          onClick={() => setExpandedSources(prev => ({ ...prev, [msg.id]: !isExpanded }))}
                                          className="text-xs text-sky-600 hover:underline mt-2 font-medium"
                                        >
                                          {isExpanded ? '折りたたむ' : `他 ${msg.sources!.length - SOURCE_COLLAPSE_THRESHOLD} 件のソースを表示...`}
                                        </button>
                                      )}
                                  </div>
                                )}
                            </div>
                            {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mt-1"><UserIcon className="w-5 h-5 text-gray-600" /></div>}
                        </div>
                    );
                })}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"><BotIcon className="w-5 h-5 text-white" /></div>
                        <div className="rounded-lg p-3 bg-white border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
            <div className="flex items-center bg-gray-100 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-transparent transition-all">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isInputDisabled && handleSend()}
                    placeholder={!isReady ? "AIを準備中..." : "メッセージを入力..."}
                    className="flex-1 bg-transparent py-2 px-4 text-gray-900 placeholder-gray-500 focus:outline-none"
                    disabled={isInputDisabled}
                />
                <button 
                    onClick={handleSend} 
                    disabled={isInputDisabled || !input.trim()} 
                    className="p-3 text-sky-600 hover:text-sky-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    <SendIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    </aside>
  );
};