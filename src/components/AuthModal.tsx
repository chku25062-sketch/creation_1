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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {isSupabaseConfigured
                ? isSignUp
                  ? 'アカウント作成'
                  : 'クラウドログイン'
                : 'クラウド連携設定'}
            </h3>
            <p className="text-xs text-slate-400">複数端末での理論値同期 & クラウド保存</p>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start gap-2.5 text-xs text-slate-300">
              <Info className="h-4 w-4 shrink-0 text-cyan-400" />
              <div>
                <p className="font-semibold text-white">現在ゲストモードで100%稼働中です</p>
                <p className="mt-1 text-slate-400">
                  作成した理論値計画表はブラウザ（ローカル）に自動保存されます。
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800/80 bg-slate-900/80 p-3 text-xs">
              <p className="font-semibold text-slate-300">Supabase クラウド同期の有効化手順:</p>
              <ol className="mt-1.5 list-inside list-decimal space-y-1 text-slate-400">
                <li>Supabase でプロジェクトを作成</li>
                <li>
                  Vercel または <code className="text-cyan-300">.env.local</code> に環境変数を設定:
                  <div className="mt-1 rounded bg-slate-950 p-2 font-mono text-[10px] text-cyan-400">
                    NEXT_PUBLIC_SUPABASE_URL=...
                    <br />
                    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
                  </div>
                </li>
              </ol>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-xl bg-slate-800 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              ゲストモードを継続して利用する
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400">メールアドレス</label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">パスワード</label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '処理中...' : isSignUp ? '新規登録' : 'ログイン'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-slate-400 hover:text-cyan-400"
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
