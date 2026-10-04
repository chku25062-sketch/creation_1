import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '理論値計画表 | 理想の1日スケジュール自動最適化エンジン',
  description:
    '生活固定枠と目標タスクから、目標を100%達成する理想の1日（理論値）を自動スケジューリングするWebアプリケーション。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
