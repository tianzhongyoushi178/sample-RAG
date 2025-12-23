import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ZoomOutIcon, LoadingSpinner, TrashIcon, LockIcon, ScanIcon } from './Icons';
import type { KnowledgeFile, UserProfile } from '../types';

// pdfjsLib is loaded from a CDN in index.html
declare const pdfjsLib: any;

interface PdfViewerProps {
  file: KnowledgeFile;
  initialPage?: number;
  onDelete: () => void;
  showBackButton?: boolean;
  onBackToSearch?: () => void;
  userProfile: UserProfile | null;
  onFileRescan: () => void;
  isRescanning: boolean;
  rescanProgress: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ file, initialPage = 1, onDelete, showBackButton, onBackToSearch, userProfile, onFileRescan, isRescanning, rescanProgress }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.5);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      if (!file.url) {
        setError('PDFファイルのURLが見つかりません。');
        return;
      }
      setError(null);
      setPdfDoc(null);
      try {
        // Use local proxy to bypass CORS for remote URLs, but use direct blob for local
        const isBlob = file.url.startsWith('blob:');
        const proxyUrl = isBlob ? file.url : `/api/proxy?url=${encodeURIComponent(file.url)}`;

        const doc = await pdfjsLib.getDocument({
          url: proxyUrl,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        }).promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(Math.min(initialPage, doc.numPages));
      } catch (e) {
        console.error('Failed to load PDF:', e);
        setError('PDFファイルの読み込みに失敗しました。ファイルが破損しているか、アクセス権限に問題がある可能性があります。');
      }
    };
    loadPdf();

    return () => {
      // No cleanup needed for URLs
    }
  }, [file.url, initialPage]);

  // Auto-fit to width when PDF loads
  useEffect(() => {
    const fitToWidth = async () => {
      if (!pdfDoc || !containerRef.current) return;
      try {
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current.clientWidth;
        // Subtract padding (p-4 = 32px approx) + extra margin
        const availableWidth = containerWidth - 48;
        if (availableWidth > 0 && viewport.width > 0) {
          const scale = availableWidth / viewport.width;
          setZoom(scale);
        }
      } catch (e) {
        console.error("Auto-fit failed", e);
      }
    };
    fitToWidth();
  }, [pdfDoc]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel previous render if possible (by checking current render ID or flag)
    // Since we can't easily cancel proper promises without abort controller support in PDF.js (partially supported),
    // we use a flag to ignore obsolete results.
    const renderId = Date.now();
    // @ts-ignore - custom property for cancellation
    canvasRef.current._renderId = renderId;

    setIsRendering(true);
    setError(null);

    try {
      const page = await pdfDoc.getPage(currentPage);

      // If another render started, abort
      // @ts-ignore
      if (canvasRef.current._renderId !== renderId) return;

      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        const renderTask = page.render(renderContext);

        // Store render task to cancel if needed
        // @ts-ignore
        canvas._renderTask = renderTask;

        try {
          await renderTask.promise;
        } catch (renderError: any) {
          if (renderError?.name === 'RenderingCancelledException') {
            // Ignore cancellation errors
            return;
          }
          throw renderError;
        }
      }
    } catch (e: any) {
      // @ts-ignore
      if (canvasRef.current?._renderId !== renderId) return; // Ignore if obsolete

      console.error("Failed to render page:", e);
      setError(`ページ ${currentPage} の描画に失敗しました。`);
    } finally {
      // @ts-ignore
      if (canvasRef.current?._renderId === renderId) {
        setIsRendering(false);
      }
    }
  }, [pdfDoc, currentPage, zoom]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const goToPage = (pageNumber: number) => {
    setCurrentPage(Math.max(1, Math.min(pageNumber, numPages)));
  }

  const getOcrStatus = () => {
    if (isRescanning) {
      return <span className="text-sm text-sky-600 animate-pulse">{rescanProgress}</span>;
    }
    switch (file.ocrStatus) {
      case 'ocr_applied':
        const date = file.lastOcrScan?.seconds ? new Date(file.lastOcrScan.seconds * 1000).toLocaleDateString('ja-JP') : '';
        return <span className="text-sm text-green-600 font-medium" title={`最終スキャン: ${date}`}>テキスト認識: OCR適用済み</span>;
      case 'ocr_recommended':
        return <span className="text-sm text-amber-600 font-medium" title="このPDFは画像が主体のようです。検索精度を向上させるためにOCRスキャンを推奨します。">テキスト認識: OCR推奨</span>;
      case 'text_only':
        return <span className="text-sm text-gray-500">テキスト認識: 抽出済み</span>;
      default:
        return <span className="text-sm text-gray-400">テキスト認識: 不明</span>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 rounded-t-lg p-2 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {showBackButton && onBackToSearch && (
            <>
              <button
                onClick={onBackToSearch}
                className="flex items-center gap-2 py-2 px-3 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors whitespace-nowrap"
                title="検索結果に戻る"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span className="hidden sm:inline">戻る</span>
              </button>
              <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block"></div>
            </>
          )}
          <button onClick={() => setZoom(z => z - 0.2)} disabled={zoom < 0.5 || isRescanning} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
            <ZoomOutIcon className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-700 w-12 text-center text-sm hidden sm:inline-block">
            {(zoom * 100).toFixed(0)}%
          </span>
          <button onClick={() => setZoom(z => z + 0.2)} disabled={zoom > 3 || isRescanning} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
            <ZoomInIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || isRescanning} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-700 whitespace-nowrap">
            ページ {currentPage} / {numPages || '--'}
          </span>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages || isRescanning} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          {file.isLocked && <LockIcon className="w-5 h-5 text-yellow-500" title="このファイルはロックされています" />}
          <button
            onClick={onFileRescan}
            disabled={isRescanning || file.isLocked}
            className="p-2 rounded-full bg-gray-100 hover:bg-sky-100 text-gray-500 hover:text-sky-600 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            title={file.isLocked ? "ファイルがロックされています" : "再スキャンしてテキストを最適化"}
          >
            {isRescanning ? <LoadingSpinner className="w-5 h-5 text-sky-600" /> : <ScanIcon className="w-5 h-5" />}
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-full bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            title={file.isLocked ? "ファイルがロックされています" : "ファイルを削除"}
            disabled={file.isLocked || isRescanning}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-shrink-0 bg-gray-50 p-2 text-center border-b border-gray-200">
        {getOcrStatus()}
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto p-4 flex justify-center bg-gray-100">
        {error ? (
          <div className="text-red-500 flex items-center justify-center h-full bg-white rounded-lg p-6 shadow-sm">{error}</div>
        ) : (
          <div className="relative">
            {(isRendering || isRescanning) && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 backdrop-blur-sm">
                <LoadingSpinner className="text-sky-600 w-10 h-10" />
              </div>
            )}
            <canvas ref={canvasRef} className="rounded-md shadow-lg" />
          </div>
        )}
      </div>
    </div>
  );
};