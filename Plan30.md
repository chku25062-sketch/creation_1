# Plan30: 「質問から作成」と「クイック設定」の完全統合設計書（単一ウィザード化）

---

## 1. エグゼクティブサマリー

### 1.1. 本改修の背景と目的
現在、予定表の作成・設定には以下の2つの独立したモーダルが存在していました。
1. **「質問に答えて予定表を作成」 (`NewTableWizardModal`)**: 新規表を作成するためのステップバイステップ形式の質問ウィザード。
2. **「クイック設定」 (`TableQuickSettingsModal`)**: 既存の表のルール（時間帯、頻度）やタスク所要時間を調整するための設定モーダル（約860行）。

ユーザーからの極めて鋭い指摘（「質問から作成の時現在表に設定されているものも反映できるようにしたら、クイック設定はいらないのでは？」）に基づき、本改修では **「質問から作成」を「新規作成」と「既存編集」の両方に対応する単一の統合ウィザードへ昇華**させます。
これにより、**`TableQuickSettingsModal.tsx` を完全に廃止・統合**し、ユーザー体験の統一とコードベースの大幅なスリム化（約860行の削除）を実現します。

---

## 2. 統合アーキテクチャ設計

### 2.1. メンタルモデルの統一
ユーザーが「新しく表を作る」ときも「既存の表を調整する」ときも、全く同一の入力画面（テーマ/ルール決定 → タスク入力 → 確認・調整）で操作できるようにします。

```
[呼び出し導線]
├─ 「質問から新しく作る」ボタン ───> targetTable: null (新規作成モード)
└─ 「表のルール・タスク設定」   ───> targetTable: activeTable (既存編集モード)
                                           │
                                           ▼
                    ┌─────────────────────────────────────────┐
                    │ NewTableWizardModal (単一統合ウィザード)│
                    │ ・targetTableの有無で初期値・文言を分岐 │
                    │ ・既存表データからのPre-fill（逆算復元）│
                    │ ・Step 3でのタスク所要時間クイック調整  │
                    └─────────────────────────────────────────┘
                                           │
                                           ▼
                    ┌─────────────────────────────────────────┐
                    │ onApplyTable(table)                     │
                    │ ・新規: 新規IDで追加                    │
                    │ ・編集: 既存ID維持で更新                │
                    └─────────────────────────────────────────┘
```

---

## 3. 具体的な実装仕様

### 3.1. `NewTableWizardModal.tsx` のインターフェース拡張
```typescript
interface NewTableWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTable: (newTable: ImportedTableData, isEditMode?: boolean) => void;
  targetTable?: ImportedTableData | null; // ★ 編集対象の既存表（nullなら新規作成）
}
```

### 3.2. 既存表データからの逆算復元（Pre-fill ロジック）
`isOpen` かつ `targetTable` が渡された場合、以下のパラメータを既存表から抽出してステートに流し込みます。

1. **表の名前**: `targetTable.name`
2. **表の分類（`tableType`）**: `getTableClassification(targetTable)`
   - `fixed_slot` → `'fixed'`
   - `daily_task` → `'daily'`
   - `weekly_task` → `'weekly'`
3. **活動時間帯（`timeSlot`）**:
   - `axisConfig.startTime` と `endTime` を照合し、朝（06:00〜12:00）、昼（12:00〜18:00）、夜（18:00〜23:00）、終日（nullまたは00:00〜24:00）を判定。
4. **日課のペース設定（`dailyRepeatPattern`）**:
   - `columnMode === 'cycle'` かつ `numCols === 1`: `'everyday'`（毎日同じ）
   - `columnMode === 'weekday'`: `'weekdays'`（曜日を指定）
     - タスクが存在する列インデックスから `taskTargetDays` を抽出。
   - `columnMode === 'cycle'` かつ `numCols > 1`: `'cycle'`（○日周期で交代）
     - `numCols` を `dailyCycleLength` としてセット。
     - `targetTable.cycleStartDay` を `dailyCycleStartDay` としてセット。
5. **固定枠の設定**:
   - `axisConfig.startTime` / `endTime` を `fixedStartTime` / `fixedEndTime` にセット。
6. **既存タスク一覧（`draftTasks`）の復元**:
   - 表内の全セルからユニークなタスクを抽出。
   - 各タスクのタイトル、所要時間（`customDurationMinutes` または時間差分）、曜日、担当Day（`colIndex`）、週目標回数（`targetWeeklyCount`）を保持した `AddedTaskDraft` の配列を作成し、Step 3 に初期配置。

### 3.3. Step 3（登録タスク一覧）でのクイック所要時間調整
旧クイック設定の利点（所要時間のパパッと調整）を継承するため、Step 3 の各タスクカードに 5分刻みのステッパー（`- 5分` / `+ 5分`）を追加。モーダルを開いたまま一覧で即座に所要時間を調整できるようにします。

### 3.4. 画面タイトル・ボタン文言の切り替え
- **新規作成モード**:
  - タイトル: 「質問に答えて予定表を作成」
  - 完了ボタン: 「表を作成する」
- **既存編集モード**:
  - タイトル: 「表のルール・タスク設定: {表の名前}」
  - 完了ボタン: 「変更を保存して適用」

---

## 4. `ImportedTablesManager.tsx` の改修と旧コード削除

1. **クイック設定ボタンの置き換え**:
   - デスクトップ上部バーおよびモバイル設定ドロワーの「クイック設定」ボタンのラベルを「表のルール設定」に変更。
   - クリック時に `targetTable: activeTable` を渡して `NewTableWizardModal` を開く。
2. **`TableQuickSettingsModal` の完全削除**:
   - `TableQuickSettingsModal.tsx`（約860行）のインポートおよび呼び出しを完全除去。
   - ファイル自体の削除により、二重管理を根絶。

---

## 5. 実施計画

1. **フェーズ 1**: `NewTableWizardModal.tsx` に `targetTable` Pre-fill ロジックと Step 3 所要時間ステッパーを実装。
2. **フェーズ 2**: `ImportedTablesManager.tsx` の呼び出しを統合ウィザードへ切り替え。
3. **フェーズ 3**: `TableQuickSettingsModal.tsx` を安全に廃止・削除。
4. **フェーズ 4**: 型チェック、単体テスト、ビルド検証。

---

## 6. 実施完了レポート

### 6.1. 達成成果のまとめ
- **単一ウィザードへの完全統合**:
  - `NewTableWizardModal.tsx` に `targetTable?: ImportedTableData | null` を追加し、既存表データからの Pre-fill（表名、分類、時間帯、ペース/サイクル、タスク一覧の逆算復元）を実装。
  - 新規作成時（「質問に答えて予定表を作成」）と既存編集時（「表のルール・タスク設定」）でタイトル・説明文・完了ボタンをスマートに切り替え。
  - Step 3（登録タスク一覧）に所要時間クイック調整ステッパー（`-5分` / `+5分`）を新設。モーダルを開いて一覧を見ながらパパッと分数を調整可能に。
- **レガシーコードの完全撤廃**:
  - 不要となった `src/components/TableQuickSettingsModal.tsx`（約864行）を完全に削除。
  - `ImportedTablesManager.tsx` の呼び出しを統合ウィザードへ切り替え、モーダル管理コードをスリム化。
- **品質検証**:
  - `npm run typecheck`: 型エラー 0件。
  - `npm run test`: 全9ファイル 211テスト全件合格。
  - `npm run lint`: ESLint エラー 0件。
  - `npm run build`: Next.js 16 プロダクションビルド正常完了。

