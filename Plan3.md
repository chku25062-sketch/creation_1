# ESLint & Prettier 静的解析・コード整形ハーネス導入計画（Plan3）

## 1. 概要と目的

本計画は、本リポジトリに **ESLint**（静的構文解析・コード規約検証）および **Prettier**（コードフォーマッター）を導入し、開発者やエージェントが生成するコードの品質均一化、構文規約逸脱の自動検出、スタイル崩れの自動防止を行うハーネスを構築するための手順と設計方針を定めたものです。  
先行して構築した型検査ハーネス（`typecheck`）およびテストハーネス（`test`）と連携させることで、強固な開発・検証パイプラインを確立します。

---

## 2. 構築手順と詳細計画

### ステップ1: 開発依存パッケージ（devDependencies）の追加

- **実行予定コマンド**:
  ```bash
  npm install -D eslint prettier eslint-config-prettier typescript-eslint
  ```
- **導入パッケージと選定理由**:
  1. `eslint`:
     - JavaScript / TypeScript 向けの標準的かつ強力な静的コード解析ツール。
  2. `prettier`:
     - チーム・エージェント間でのコードスタイル差異を解消するオピニオネイテッドなコードフォーマッター。
  3. `eslint-config-prettier`:
     - ESLint と Prettier のルール競合（主にフォーマット関連ルール）を無効化し、両者を共存させる公式設定。
  4. `typescript-eslint`（推奨追加）:
     - TypeScript コードを ESLint Flat Config 上で正確に解析・型認識するための公式ツールスイート。

---

### ステップ2: 各種設定ファイルの構成

#### 1. `.prettierrc`（ルート直下）

- **配置場所**: `./.prettierrc`
- **想定設定内容**:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2,
    "useTabs": false
  }
  ```
- **方針**:
  - セミコロンあり、シングルクォート、末尾カンマありのモダンな標準スタイルを採用。
  - フォーマット対象外指定のため、必要に応じて `.prettierignore`（`node_modules/`, `package-lock.json` 等）も用意。

#### 2. ESLint 設定ファイル（`eslint.config.js`）

本リポジトリは `"type": "module"`（ESM）であり、ESLint v9 の標準規格である **Flat Config**（`eslint.config.js`）を採用します。

- **配置場所**: `./eslint.config.js`
- **想定設定内容**:
  ```javascript
  import js from '@eslint/js';
  import tseslint from 'typescript-eslint';
  import prettierConfig from 'eslint-config-prettier';

  export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
      ignores: ['node_modules/', 'dist/'],
    },
    {
      rules: {
        // 必要に応じたプロジェクト固有ルールの調整
      },
    },
  );
  ```
- **特徴**:
  - `eslint-config-prettier` を末尾に適用することで、Prettier と重複・衝突する ESLint ルールを完全にオフにします。

---

### ステップ3: `package.json` の `scripts` へのコマンド追加

- **変更内容**:
  ```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint .",
    "format": "prettier --check .",
    "format:fix": "prettier --write ."
  }
  ```
- **方針・目的**:
  - `"lint": "eslint ."`: プロジェクト全体の規約違反・未定義変数・未使用コード等を検出。
  - `"format": "prettier --check ."`: CI/受入検査向けに、コードフォーマットが保たれているかを検査（非破壊）。
  - `"format:fix": "prettier --write ."`: 必要時に全ファイルを一括フォーマットする補助コマンド。

---

## 3. 自律検証計画

構築完了後、以下の検証を順次実行します：

1. **フォーマット検査の検証**
   - コマンド: `npm run format`
   - 期待結果: すべての対象ファイルが整形済みとしてパスすること。
2. **リント検査の検証**
   - コマンド: `npm run lint`
   - 期待結果: 構文・ルールエラーが 0 件で正常終了（終了コード0）すること。
3. **既存ハーネスとの共存確認**
   - `npm run typecheck`（型検査）および `npm test`（テスト）を実行し、設定追加による悪影響がないことを確認。
4. **検知能力の検証（異常系テスト）**
   - フォーマット崩れ（インデント乱れ）や ESLint エラー（未使用変数等）を含むコードを一時的に配置し、正しくエラーとして検知されることを確認。

---

## 4. 次のアクション

本計画書（`Plan3.md`）について開発者の承認をいただいた後、ステップ1（パッケージインストール）から順次実装に着手します。
