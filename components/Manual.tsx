import React from 'react';
import { XIcon, ChevronRightIcon, ChevronLeftIcon } from './Icons';

interface ManualProps {
    onClose: () => void;
}

export const Manual: React.FC<ManualProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden relative animate-fade-in-up">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">使い方マニュアル</h2>
                        <p className="text-sm text-gray-500 mt-1">初心者の方でも簡単にお使いいただけます</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        title="閉じる"
                    >
                        <XIcon className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-8 space-y-16">

                    {/* Section 1: Upload */}
                    <section className="flex flex-col md:flex-row items-center gap-8">
                        <div className="flex-1 space-y-4">
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-sky-100 text-sky-600 font-bold text-lg">1</div>
                            <h3 className="text-xl font-bold text-gray-800">ファイルをアップロードする</h3>
                            <p className="text-gray-600 leading-relaxed">
                                お手持ちのPDFファイルや画像を、画面にドラッグ＆ドロップするだけで簡単に取り込めます。<br />
                                サイドバーの「ファイル」ボタンからもアップロード可能です。読み込んだファイルはAIが自動で認識し、会話の材料にします。
                            </p>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-sm transition-transform hover:scale-[1.02] duration-300">
                            <img src="/images/manual_upload.png" alt="Upload Illustration" className="w-full h-auto object-contain" />
                        </div>
                    </section>

                    {/* Section 2: Organize */}
                    <section className="flex flex-col md:flex-row-reverse items-center gap-8">
                        <div className="flex-1 space-y-4">
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-sky-100 text-sky-600 font-bold text-lg">2</div>
                            <h3 className="text-xl font-bold text-gray-800">フォルダで整理する</h3>
                            <p className="text-gray-600 leading-relaxed">
                                増えてきたファイルはフォルダを作成して整理整頓。<br />
                                ドラッグ＆ドロップでファイルの移動も自由自在です。大事なファイルには「ロック」をかけて保護することもできます。
                            </p>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-sm transition-transform hover:scale-[1.02] duration-300">
                            <img src="/images/manual_folders.png" alt="Folders Illustration" className="w-full h-auto object-contain" />
                        </div>
                    </section>

                    {/* Section 3: Chat */}
                    <section className="flex flex-col md:flex-row items-center gap-8">
                        <div className="flex-1 space-y-4">
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-sky-100 text-sky-600 font-bold text-lg">3</div>
                            <h3 className="text-xl font-bold text-gray-800">AIと会話する</h3>
                            <p className="text-gray-600 leading-relaxed">
                                「この資料の要約は？」「〇〇について教えて」とチャットで質問してみましょう。<br />
                                あなたのナレッジベースにある情報をもとに、AIが即座に回答を作成してくれます。
                            </p>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-sm transition-transform hover:scale-[1.02] duration-300">
                            <img src="/images/manual_chat.png" alt="Chat Illustration" className="w-full h-auto object-contain" />
                        </div>
                    </section>

                    {/* Footer Message */}
                    <div className="text-center py-12 bg-sky-50 rounded-2xl">
                        <h3 className="text-lg font-bold text-sky-900 mb-2">準備はいいですか？</h3>
                        <p className="text-sky-700 mb-6">さあ、あなたの新しいナレッジベースを体験しましょう。</p>
                        <button
                            onClick={onClose}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:-translate-y-1 hover:shadow-xl"
                        >
                            始める
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
