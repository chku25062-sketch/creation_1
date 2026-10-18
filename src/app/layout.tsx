import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '理論値計画表 | 理想の1日スケジュール自動最適化エンジン',
  description:
    '生活固定枠と目標タスクから、目標を100%達成する理想の1日（理論値）を自動スケジューリングするWebアプリケーション。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full overflow-hidden">
      <body className="h-full h-[100dvh] overflow-hidden overscroll-none bg-[#fbfaf5] text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
        {children}
      </body>
    </html>
  );
}
