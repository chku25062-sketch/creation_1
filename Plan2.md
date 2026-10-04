# Vitest 自動テストスイート導入計画（Plan2）

## 1. 概要と目的

本計画は、本リポジトリに **Vitest** による自動テストスイートを導入し、エージェントやCI環境が自律的に受入テスト・ユニットテストを実行できるテストハーネスを構築するための手順と設計方針を定めたものです。  
先行して導入した TypeScript 型検査ハーネス（`npm run typecheck`）と組み合わせることで、「型検査 + 自動テスト」による二重の品質保証基盤を確立します。

---

## 2. 構築手順と詳細計画

### ステップ1: 開発依存パッケージ（devDependencies）の追加

- **実行予定コマンド**:
  ```bash
  npm install -D vitest
  ```
- **導入パッケージと選定理由**:
  - `vitest`:
    - Vite ベースの高速なテストランナー。
    - TypeScript を設定不要（Zero-config）でネイティブにサポート。
    - Jest 互換の API（`describe`, `it`, `expect` など）を提供し、直感的でメンテナンス性の高いテストコードを記述可能。

---

### ステップ2: ルート直下 `vitest.config.ts` の作成と設定

- **配置場所**: `./vitest.config.ts`（プロジェクトルート直下）
- **想定設定内容**:
  ```typescript
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts'],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
  });
  ```
- **主要設定項目の解説**:
  - `globals: true`: 各テストファイルでのインポート省略を許容（明示的な `import { describe, it, expect } from 'vitest'` との併用も可能）。
  - `environment: 'node'`: Node.js 実行環境を明示。
  - `include: ['src/**/*.{test,spec}.ts']`: `src/` 配下のテストファイルのみを探索・実行対象に限定。

---

### ステップ3: `package.json` の `scripts` へのコマンド追加

- **変更内容**:
  ```json
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
  ```
- **方針・目的**:
  - デフォルトの `vitest` はファイル監視（watch）モードで起動するため、エージェントの自律実行やCI環境に適した「1回実行して終了する」`vitest run` を `"test"` に割り当てます。
  - 必要に応じて開発者用の監視モード `"test:watch": "vitest"` の追加も視野に入れます。

---

### ステップ4: 動作検証用サンプルテスト（`src/index.test.ts`）の作成

- **配置場所**: `./src/index.test.ts`
- **対象コード（`src/index.ts`）の軽微な拡張**:
  テストしやすいよう、既存の [src/index.ts](file:///c:/Users/kousu/OneDrive/Desktop/creation_1/src/index.ts) に純粋関数を追加します。
  ```typescript
  export const greeting: string = 'Hello, TypeScript!';

  export function add(a: number, b: number): number {
    return a + b;
  }
  ```
- **テストファイル内容（`src/index.test.ts`）**:
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { greeting, add } from './index.js';

  describe('Initial Smoke Tests', () => {
    it('greeting変数が正しく定義されていること', () => {
      expect(greeting).toBe('Hello, TypeScript!');
    });

    it('add関数が正しく数値を加算すること', () => {
      expect(add(2, 3)).toBe(5);
    });
  });
  ```

---

## 3. 自律検証計画

構築完了後、以下の検証を順次実行します：

1. **テストスイートの実行確認**
   - コマンド: `npm test`（または `npm run test`）
   - 期待結果: すべてのテストケース（2件）がパスし、終了コード0で完了すること。
2. **型検査ハーネスとの整合性確認**
   - コマンド: `npm run typecheck`
   - 期待結果: テストファイル（`src/index.test.ts`）および設定ファイル（`vitest.config.ts`）を含め、型エラーが一切発生しないこと。
3. **テスト失敗の検知確認（異常系）**
   - 意図的に失敗するアサーション（例: `expect(add(2, 3)).toBe(999);`）を一時的にテストし、正しくエラーが検出され終了コード1となることを確認。

---

## 4. 次のアクション

本計画書（`Plan2.md`）について開発者の承認をいただいた後、ステップ1（`npm install -D vitest`）から順次実装に着手します。
