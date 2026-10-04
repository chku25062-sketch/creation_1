# 「理論値計画表」Webアプリケーション実装計画書（Plan5）

## 1. 概要と目的

本計画は、利用者に目標達成のための理想的な1日（理論値スケジュール）を美しく力強く提示するWebアプリケーション**「理論値計画表 (Theoretical Schedule Planner)」**の設計および実装手順を定めたものです。  
本リポジトリは GitHub 経由で **Vercel** と自動連携されており、変更を push することで即座に本番デプロイが実行される CI/CD 環境となっています。そのため、Vercel 上でのプロダクションビルド（`next build`）が安定してパスし、Supabase 環境変数の有無にかかわらず即座にゲスト体験が可能な堅牢な設計を採用します。

---

## 2. システム構成と技術スタック

| レイヤー              | 採用技術                                                | 選定理由・役割                                                       |
| :-------------------- | :------------------------------------------------------ | :------------------------------------------------------------------- |
| **Framework**         | **Next.js 15+ (App Router) + TypeScript**               | Vercel との完全親和性、高速なSSR/SSG、API Routes、React 19 対応      |
| **Styling**           | **Tailwind CSS (v4) + Lucide Icons**                    | 洗練されたダークモード、ガラスモーフィズム、モダンなタイムラインUI   |
| **Backend / DB**      | **Supabase (`@supabase/supabase-js`, `@supabase/ssr`)** | ユーザー認証（Auth）、スケジュールおよびタスクのクラウド永続化       |
| **State / Storage**   | **Hybrid Storage (LocalStorage + Supabase)**            | ログイン不要ですぐに利用可能 ＋ ログインでクラウド同期・複数端末保存 |
| **Testing & Quality** | **Vitest, ESLint, Prettier, TypeScript Strict**         | 既存の4重自動化ハーネスによる継続的品質検証                          |

---

## 3. ドメインモデルとコア設計

### (1) 生活固定枠 (`FixedSlot`)

日常生活の基盤となる動かせない時間枠：

```typescript
export interface FixedSlot {
  id: string;
  title: string; // 例: 「睡眠」「勤務」「朝の準備」「夕食・入浴」
  category: 'sleep' | 'work' | 'routine' | 'meal';
  startMinutes: number; // 0〜1440（分換算。例: 00:00=0, 23:00=1380）
  endMinutes: number;
  color: string;
}
```

### (2) 目標・タスク (`TaskItem`)

空き時間に割り振るやりたいこと・やるべき目標：

```typescript
export interface TaskItem {
  id: string;
  title: string; // 例: 「基本情報技術者試験の勉強」「ジムで筋トレ」「読書」
  durationMinutes: number; // 所要時間（例: 60分, 90分）
  priority: 'high' | 'medium' | 'low';
  category: 'study' | 'workout' | 'hobby' | 'work' | 'other';
  period: 'day' | 'week' | 'month'; // 計画頻度
}
```

### (3) 理論値タイムブロック (`TheoreticalBlock`)

エンジンによって24時間の中に最適配置された結果：

```typescript
export interface TheoreticalBlock {
  id: string;
  title: string;
  category: string;
  startMinutes: number;
  endMinutes: number;
  isFixed: boolean; // 固定枠か自動配置タスクか
  color: string;
  taskId?: string;
}
```

---

## 4. 理論値自動スケジューリングエンジン (`src/lib/scheduler.ts`)

1. **空き時間スロットの算出**:
   - 24時間（1440分）からすべての固定枠（睡眠・仕事・食事等）を差し引き、利用可能な自由時間スロット（`FreeSlot[]`）を時系列で特定。
2. **優先度・所要時間に基づく最適配置**:
   - タスクを優先度（High → Medium → Low）および所要時間順にソート。
   - 自由時間枠に対して最適なスロットを探索してタイムブロックを生成（ビンパッキング / グリーディマッピング）。
3. **理論値指標の算出**:
   - 総自由時間、目標タスク消化時間、**「理論値達成率（スコア %）」**、未配置タスクの可視化。

---

## 5. UI/UX デザイン設計（統合ダッシュボード）

- **ヘッダー**:
  - アプリタイトル「理論値計画表」、日付・現在時刻表示、ゲスト/ログイン状態表示、Supabase 認証ボタン。
- **メイン指標カード（理論値サマリー）**:
  - 「本日の理論値達成率: 100%」などの力強い目標ステータス。
  - 睡眠時間 / 固定時間 / 目標消化可能時間 / 余白時間のサマリー表示。
- **24時間縦型タイムライン（メインビュー）**:
  - 0:00〜24:00 のグラフィカルなタイムブロック表示。
  - 固定枠（シックなダークトーン）と目標タスク（鮮やかなアクセントグラデーション）の色分け。
  - 現在時刻ラインのリアルタイム表示。
- **時間配分ドーナツチャート**:
  - 1日の理想的な時間構成比率を円グラフで直感的に可視化。
- **設定・入力パネル**:
  - 生活固定枠の編集（睡眠、仕事などの開始・終了時刻変更）。
  - 目標タスクの追加・編集・削除フォーム。
  - 「理論値を再計算する」アクションボタン。

---

## 6. GitHub ⇄ Vercel 連携および Supabase 設計

### (1) 環境変数とフォールバック設計

- `.env.example` および `.env.local` を用意：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **フォールバック**:
  - Vercel デプロイ時に Supabase の環境変数が未設定であっても、モック・LocalStorage ストレージ層にシームレスに切り替わり、ビルドエラーや画面のクラッシュを絶対に起こさないフェイルセーフ設計。

### (2) `package.json` スクリプトの整備

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "lint": "eslint .",
  "format": "prettier --check .",
  "format:fix": "prettier --write ."
}
```

---

## 7. 実装ステップと自律検証計画

### ステップ 1: Next.js + Tailwind CSS + Supabase の導入

- Next.js 関連パッケージ、Tailwind CSS (v4)、Lucide Icons、Supabase クライアントの導入。
- `next.config.ts`, `postcss.config.mjs` 等の設定。

### ステップ 2: スケジューリングエンジンと Vitest 単体テスト

- `src/lib/scheduler.ts` に純粋関数として自動割り振りロジックを実装。
- `src/lib/scheduler.test.ts` を作成し、境界値・重なり防止・優先度順配置を Vitest で網羅検証。

### ステップ 3: ストレージ層（LocalStorage + Supabase）の実装

- `src/lib/storage.ts` にゲスト用ローカル保存と Supabase クラウド保存の共通インターフェースを実装。

### ステップ 4: ダッシュボード UI およびビジュアルタイムラインの実装

- `src/app/page.tsx`, `src/components/*` に 24時間タイムブロック、ドーナツチャート、理論値サマリー、タスク・固定枠エディタを実装。

### ステップ 5: 自律検証とビルドテスト

- [RULES.md](file:///c:/Users/kousu/OneDrive/Desktop/creation_1/RULES.md) に則り、以下の全コマンドを実行・検証：
  1. `npm run typecheck`
  2. `npm run test`
  3. `npm run lint`
  4. `npm run format`
  5. `npm run build`（Vercel デプロイの成否をローカルで事前検証）

---

## 8. 次のアクション

本計画書（`Plan5.md`）について開発者の承認をいただいた後、ステップ1から順次実装に着手します。
