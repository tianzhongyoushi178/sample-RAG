import React, { useState } from 'react';
import { signUpWithEmail, signInWithEmail } from '../services/firebaseService';
import { LoadingSpinner, UserIcon } from './Icons';

export const AuthScreen: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPendingMessage, setShowPendingMessage] = useState(false);
    const [showLoginSuggestion, setShowLoginSuggestion] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setShowLoginSuggestion(false);
        setIsLoading(true);

        try {
            if (isLogin) {
                await signInWithEmail(email, password);
                // onAuthChange in App.tsx will handle the redirect
            } else {
                await signUpWithEmail(email, password);
                setShowPendingMessage(true);
            }
        } catch (err: any) {
            switch (err.code) {
                case 'auth/invalid-email':
                    setError('無効なメールアドレス形式です。');
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setError('メールアドレスまたはパスワードが間違っています。');
                    break;
                case 'auth/email-already-in-use':
                    setError('このメールアドレスは既に使用されています。');
                    setShowLoginSuggestion(true);
                    break;
                 case 'auth/weak-password':
                    setError('パスワードは6文字以上で設定してください。');
                    break;
                default:
                    setError('エラーが発生しました。しばらくしてからもう一度お試しください。');
                    console.error("Auth error:", err);
                    break;
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (showPendingMessage) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-4">
                <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-2xl text-center">
                    <UserIcon className="w-16 h-16 text-sky-400 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold text-white mb-4">ご登録ありがとうございます</h1>
                    <p className="text-slate-400 mb-6">
                        アカウントの登録が完了しました。現在、管理者による承認待ちです。
                        承認が完了次第、ログインできるようになります。
                    </p>
                    <button
                        onClick={() => {
                            setShowPendingMessage(false);
                            setIsLogin(true);
                            setEmail('');
                            setPassword('');
                        }}
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
                    >
                        ログイン画面に戻る
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <div className="w-full max-w-sm p-8 bg-slate-800 rounded-lg shadow-2xl">
                <h1 className="text-3xl font-bold text-center text-sky-400 mb-6">
                    {isLogin ? 'ログイン' : '新規登録'}
                </h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                            メールアドレス
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-slate-700 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                            placeholder="your@email.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="password"className="block text-sm font-medium text-slate-300 mb-1">
                            パスワード
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-slate-700 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
                            placeholder="••••••••"
                        />
                    </div>
                    {error && (
                        <div className="text-red-400 text-sm text-center p-3 rounded-md bg-red-500/10 border border-red-500/30">
                            <p>{error}</p>
                            {showLoginSuggestion && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsLogin(true);
                                        setError('');
                                        setShowLoginSuggestion(false);
                                    }}
                                    className="mt-2 font-semibold text-sky-400 hover:text-sky-300 underline"
                                >
                                    ログイン画面に切り替える
                                </button>
                            )}
                        </div>
                    )}
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center items-center bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 disabled:bg-sky-800 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <LoadingSpinner className="w-6 h-6" /> : (isLogin ? 'ログイン' : '登録する')}
                        </button>
                    </div>
                </form>
                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                            setShowLoginSuggestion(false);
                        }}
                        className="text-sm text-slate-400 hover:text-sky-400 transition-colors"
                    >
                        {isLogin ? 'アカウントをお持ちでないですか？ 新規登録' : '既にアカウントをお持ちですか？ ログイン'}
                    </button>
                </div>
            </div>
        </div>
    );
};