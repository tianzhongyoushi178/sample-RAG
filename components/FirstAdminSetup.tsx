import React from 'react';
import { AdminIcon } from './Icons';

interface FirstAdminSetupProps {
    onCompleteSetup: () => void;
}

export const FirstAdminSetup: React.FC<FirstAdminSetupProps> = ({ onCompleteSetup }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-900">
            <div className="max-w-xl bg-slate-800 rounded-lg shadow-2xl p-8 md:p-12">
                <AdminIcon className="w-16 h-16 text-sky-400 mx-auto mb-6" />
                <h1 className="text-3xl font-bold text-white mb-4">ようこそ、管理者様</h1>
                <p className="text-slate-300 mb-8 leading-relaxed">
                    このアプリケーションの最初のユーザーとして登録されたため、あなたのアカウントは自動的に<strong className="text-sky-400">管理者</strong>として設定されました。
                    <br />
                    管理者として、新規ユーザーの承認、ナレッジベース内の全ファイルの管理、および各種設定の変更が可能です。
                </p>
                <button
                    onClick={onCompleteSetup}
                    className="w-full max-w-xs mx-auto bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500"
                >
                    ダッシュボードへ進む
                </button>
            </div>
        </div>
    );
};
