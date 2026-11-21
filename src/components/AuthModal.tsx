'use client';

import React, { useState } from 'react';
import { X, Cloud, Lock, Mail, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (email: string) => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user?.email) {
          setSuccessMsg('アカウントが作成されました。ログイン状態に移行します。');
          onAuthSuccess(data.user.email);
          setTimeout(() => onClose(), 1000);
        } else {
          setSuccessMsg('確認メールを送信しました。メールボックスをご確認ください。');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user?.email) {
          onAuthSuccess(data.user.email);
          onClose();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '認証に失敗しました';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isSupabaseConfigured
                ? isSignUp
                  ? 'アカウント作成'
                  : 'クラウドログイン'
                : 'クラウド連携設定'}
            </h3>
            <p className="text-xs text-slate-500">複数端末での計画表同期 & バックアップ保存</p>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-2.5 text-xs text-slate-700">
              <Info className="h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold text-slate-900">現在ローカル保存モードで稼働中です</p>
                <p className="mt-1 text-slate-600">
                  作成した計画表はお使いのブラウザに自動保存されており、ログイン不要で今すぐご利用いただけます。
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
              <p className="font-semibold text-slate-800">Supabase クラウド同期の有効化手順:</p>
              <ol className="mt-1.5 list-inside list-decimal space-y-1 text-slate-600">
                <li>Supabase でプロジェクトを作成</li>
                <li>
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-blue-700">.env.local</code>{' '}
                  に環境変数を設定:
                  <div className="mt-1 rounded bg-slate-50 p-2 font-mono text-[10px] text-slate-700 border border-slate-200">
                    NEXT_PUBLIC_SUPABASE_URL=...
                    <br />
                    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
                  </div>
                </li>
              </ol>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 shadow-xs"
            >
              このまま利用を続ける
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-700">メールアドレス</label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700">パスワード</label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '処理中...' : isSignUp ? '新規登録' : 'ログイン'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-slate-500 hover:text-blue-600 transition"
              >
                {isSignUp ? 'すでにアカウントをお持ちの方はこちら' : '新規アカウント作成はこちら'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
