import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, UserStatus } from '../types';
import * as firebase from '../services/firebaseService';
import { getAuth } from 'firebase/auth';
import { ArrowLeftIcon, LoadingSpinner, SyncIcon } from './Icons';

const MissingUserGuide = () => (
    <div className="bg-white rounded-lg border border-amber-200 shadow-sm">
        <h3 className="text-lg font-semibold p-4 border-b border-amber-100 text-amber-600">ユーザーアカウントの同期に関する注意</h3>
        <div className="p-4 space-y-3 text-sm text-gray-600">
            <p>
                「このメールアドレスは既に使用されています」というエラーが表示されているにもかかわらず、そのユーザーが下のリストに表示されない場合があります。
            </p>
            <p>
                これは、ユーザー登録処理が途中で中断された場合に発生することがあります。アカウント自体は認証システムに作成されていますが、管理用のプロフィールが作成されていない状態です。
            </p>
            <p className="font-semibold text-gray-800">
                解決策:
            </p>
            <p>
                対象のユーザーに、<strong className="text-gray-900">「新規登録」ではなく「ログイン」画面からログイン</strong>するよう依頼してください。ログインに成功すると、プロフィールが自動的に作成され、「承認待ちのユーザー」リストに表示されるようになります。その後、通常通り承認または拒否の操作が可能です。
            </p>
        </div>
    </div>
);


export const AdminDashboard: React.FC<{ onBackToMain: () => void; }> = ({ onBackToMain }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [isRescanning, setIsRescanning] = useState(false);
    const [rescanMessage, setRescanMessage] = useState('');
    const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const allUsers = await firebase.getAllUsers();
            setUsers(allUsers);
        } catch (e) {
            console.error("Failed to fetch users:", e);
            setError("ユーザーリストの読み込みに失敗しました。");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Just mock current user ID for the guest admin session
        setCurrentAdminId('guest');
        fetchUsers();
    }, []);

    const handleUpdateStatus = async (uid: string, status: UserStatus) => {
        try {
            await firebase.updateUserStatus(uid, status);
            setUsers(prevUsers => prevUsers.map(u => u.uid === uid ? { ...u, status } : u));
        } catch (e) {
            console.error("Failed to update user status:", e);
            alert("ユーザーの状態の更新に失敗しました。");
        }
    };
    
    const handleToggleAdmin = async (uid: string, currentIsAdmin: boolean) => {
        const action = currentIsAdmin ? "削除" : "付与";
        if(!confirm(`本当にこのユーザーの管理者権限を${action}しますか？`)) return;
        
        try {
            await firebase.updateUserAdminRole(uid, !currentIsAdmin);
            setUsers(prevUsers => prevUsers.map(u => u.uid === uid ? { ...u, isAdmin: !currentIsAdmin } : u));
        } catch (e) {
            console.error("Failed to update admin role:", e);
            alert("管理者権限の更新に失敗しました。");
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setSyncMessage('同期を開始します... ストレージ内のファイル数によって時間がかかる場合があります。');
        try {
            const stats = await firebase.syncStorageToFirestore();
            setSyncMessage(`同期が完了しました。 ${stats.synced}件のファイルをインポートし、${stats.skipped}件をスキップしました。エラー: ${stats.errors}件。メイン画面に戻ると変更が反映されます。`);
        } catch (e) {
            console.error("Sync failed:", e);
            setSyncMessage('同期中にエラーが発生しました。詳細はコンソールを確認してください。');
        } finally {
            setIsSyncing(false);
        }
    };
    
    const handleRescan = async () => {
        if (!confirm('既存のすべてのPDFファイルを再スキャンしてテキスト認識を最適化しますか？\n各ファイルのテキストが少ないページにのみOCRが適用されます。ファイル数によっては完了までに時間がかかる場合があります。')) {
            return;
        }
        setIsRescanning(true);
        setRescanMessage('再スキャンを開始します...');
        try {
            const onProgress = (progress: string) => {
                setRescanMessage(progress);
            };
            const stats = await firebase.rescanAllPdfs(onProgress);
            setRescanMessage(`再スキャンが完了しました。${stats.rescanned}件のPDFを処理し、${stats.errors}件のエラーが発生しました。`);
        } catch (e) {
            console.error("Rescan failed:", e);
            setRescanMessage('再スキャン中にエラーが発生しました。詳細はコンソールを確認してください。');
        } finally {
            setIsRescanning(false);
        }
    };

    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    }, [users]);
    
    const pendingUsers = sortedUsers.filter(u => u.status === 'pending');
    const approvedUsers = sortedUsers.filter(u => u.status === 'approved');
    const rejectedUsers = sortedUsers.filter(u => u.status === 'rejected');

    const UserList: React.FC<{ title: string; userList: UserProfile[]; accentColor: string }> = ({ title, userList, accentColor }) => (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <h3 className={`text-lg font-semibold p-4 border-b border-gray-200 ${accentColor}`}>{title} ({userList.length})</h3>
            {userList.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                    {userList.map(user => (
                        <li key={user.uid} className="p-4 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="font-medium text-gray-800">{user.email}</p>
                                <p className="text-xs text-gray-500">
                                    登録日: {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString('ja-JP') : 'N/A'}
                                </p>
                                {user.isAdmin && <p className="text-xs font-bold text-sky-600 mt-1">管理者</p>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {user.uid === currentAdminId ? (
                                    <span className="text-xs font-semibold text-gray-500 py-1 px-3">(自分)</span>
                                ) : (
                                    <>
                                        {user.status !== 'approved' && (
                                            <button onClick={() => handleUpdateStatus(user.uid, 'approved')} className="text-xs bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded-md transition-colors">承認</button>
                                        )}
                                        {user.status !== 'rejected' && (
                                            <button onClick={() => handleUpdateStatus(user.uid, 'rejected')} className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded-md transition-colors">拒否</button>
                                        )}
                                        {user.status !== 'pending' && (
                                            <button onClick={() => handleUpdateStatus(user.uid, 'pending')} className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-1 px-3 rounded-md transition-colors">保留</button>
                                        )}
                                        <button onClick={() => handleToggleAdmin(user.uid, user.isAdmin)} className={`text-xs ${user.isAdmin ? 'bg-gray-600 hover:bg-gray-500' : 'bg-sky-600 hover:bg-sky-500'} text-white font-bold py-1 px-3 rounded-md transition-colors`}>
                                            {user.isAdmin ? '管理者から削除' : '管理者に設定'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : <p className="p-4 text-sm text-gray-500">該当するユーザーはいません。</p>}
        </div>
    );

    return (
        <div className="flex-1 flex flex-col p-6 bg-gray-50 overflow-y-auto">
            <header className="flex items-center justify-between mb-6 flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-900">管理者ダッシュボード</h1>
                <button
                    onClick={onBackToMain}
                    className="flex items-center gap-2 py-2 px-4 text-sm text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-md transition-colors shadow-sm"
                    title="メイン画面に戻る"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                    <span>メイン画面に戻る</span>
                </button>
            </header>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <LoadingSpinner className="text-sky-600 w-10 h-10" />
                </div>
            ) : error ? (
                <div className="flex-1 flex items-center justify-center text-red-500">{error}</div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-purple-200 shadow-sm">
                        <h3 className={`text-lg font-semibold p-4 border-b border-purple-100 text-purple-600`}>データ同期</h3>
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-gray-600">
                                Firebase Storageに直接アップロードされ、まだナレッジベースに登録されていないファイルをインポートします。<br/>
                                この処理は、特にPDFファイルが多い場合、時間がかかることがあります。インポートされたファイルはルートフォルダに追加されます。
                            </p>
                            <button 
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-purple-800 disabled:cursor-wait"
                            >
                                {isSyncing ? <LoadingSpinner className="w-5 h-5" /> : <SyncIcon className="w-5 h-5" />}
                                <span>クラウドストレージと同期</span>
                            </button>
                            {syncMessage && (
                                <p className="text-sm text-gray-700 bg-gray-100 p-3 rounded-md border border-gray-200">{syncMessage}</p>
                            )}
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-lg border border-teal-200 shadow-sm">
                        <h3 className={`text-lg font-semibold p-4 border-b border-teal-100 text-teal-600`}>テキスト再スキャン</h3>
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-gray-600">
                                既存のすべてのPDFファイルを再処理し、OCR（光学文字認識）を適用してテキストデータを更新します。<br/>
                                これにより、スキャンされた書類や画像ベースのPDFの検索精度が向上します。ファイル数によっては時間がかかります。
                            </p>
                            <button 
                                onClick={handleRescan}
                                disabled={isRescanning}
                                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-teal-800 disabled:cursor-wait"
                            >
                                {isRescanning ? <LoadingSpinner className="w-5 h-5" /> : <SyncIcon className="w-5 h-5" />}
                                <span>全PDFを再スキャン</span>
                            </button>
                            {rescanMessage && (
                                <p className="text-sm text-gray-700 bg-gray-100 p-3 rounded-md border border-gray-200">{rescanMessage}</p>
                            )}
                        </div>
                    </div>

                    <MissingUserGuide />

                    <UserList title="承認待ちのユーザー" userList={pendingUsers} accentColor="text-yellow-600" />
                    <UserList title="承認済みのユーザー" userList={approvedUsers} accentColor="text-green-600" />
                    <UserList title="拒否されたユーザー" userList={rejectedUsers} accentColor="text-red-600" />
                </div>
            )}
        </div>
    );
};