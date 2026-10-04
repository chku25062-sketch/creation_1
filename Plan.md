# Node.js + TypeScript 型検査基盤（ハーネス）構築計画

## 1. 概要と目的

本計画は、ゼロからNode.js環境を初期化し、TypeScriptによる静的型検査基盤（型チェックハーネス）を構築するための手順と設計方針を定めたものです。  
コードの生成（トランスパイル出力）を行わず、純粋に型整合性を検証する軽量かつ強固なCI/ローカル検証環境の確立を目的とします。

---

## 2. 構築手順と詳細計画

### ステップ1: `package.json` の新規生成

- **実行予定コマンド**:
  ```bash
  npm init -y
  ```
- **方針・目的**:
  - プロジェクトルートにパッケージマニフェストファイル `package.json` を非対話型で生成します。
  - 必要に応じて `"private": true` などの誤公開防止プロパティを付与します。

---

### ステップ2: 開発依存パッケージ（devDependencies）のインストール

- **実行予定コマンド**:
  ```bash
  npm install -D typescript @types/node
  ```
- **導入パッケージと選定理由**:
  1. `typescript`
     - 型定義の解釈および型検査（`tsc`）を実行するコアパッケージ。
  2. `@types/node`
     - Node.jsの標準組み込みモジュール（`fs`, `path`, `process` 等）に対する型定義を提供。

---

### ステップ3: ルート直下 `tsconfig.json` の設定方針

- **配置場所**: `./tsconfig.json`（プロジェクトルート直下）
- **必須要件**:
  - `"strict": true`: すべての厳格な型検査オプションを一括で有効化。
  - `"noEmit": true`: `.js` や `.d.ts` 等のファイル出力を抑制し、型検査専用（ハーネス）として動作。
- **想定設定内容**:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "noEmit": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true
    },
    "include": ["src/**/*"]
  }
  ```
- **主要オプションの説明**:
  - `target` / `module`: モダンなNode.js環境に合わせた仕様を指定。
  - `esModuleInterop`: CommonJSモジュールとの互換性確保。
  - `skipLibCheck`: 依存ライブラリ内部の型定義重複や競合による誤検知を防止し、高速化を図る。
  - `include`: 型検査対象のディレクトリ範囲を限定（例: `src/` 配下）。

---

### ステップ4: `package.json` の `scripts` へのコマンド追加

- **追加対象スクリプト**:
  ```json
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
  ```
- **実行・運用方法**:
  - コマンドラインから `npm run typecheck` を実行することで、プロジェクト全体の型エラー有無を即座に検証可能とします。

---

## 3. 構築完了後の動作検証計画

1. `src/index.ts` 等の仮ファイルを配置し、正常系（型エラーなし）で `npm run typecheck` がステータスコード0で終了することを確認。
2. 意図的な型不整合（例: `const x: number = "test";`）を記述し、適切にエラーが検知されることを確認。
3. 検証用一時ファイルを削除、または正規コードへ移行。

---

## 4. 次のアクション

本計画（`Plan.md`）について開発者の承認を得た後、ステップ1（`npm init -y`）から順次実際のファイル生成およびパッケージインストールを実施します。
