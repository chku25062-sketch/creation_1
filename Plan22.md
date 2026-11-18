# 表データ作成UI刷新とテンプレート導入計画（Plan22）

---

## 1. はじめに・策定の目的

本作「理論値スケジュール」において、表形式データ（`ImportedTableData`）は時間割、生活リズム（睡眠・食事）、習慣ルーティン（日課）、課題・目標（週次タスク）を定義し、アルゴリズムがタイムラインへ最適配置するための**中核データソース**です。

しかし、従来の表データ作成・編集UI（`ImportedTablesManager`）はグリッド操作（行・列・時限軸）を中心とした設計になっており、**「初めて利用するユーザーにとって何を設定すれば目的のスケジュールが組めるのか分かりづらい」** という課題を抱えていました。

本計画（Plan22）では、既存の高度なグリッド操作パネルを維持しつつ、初心者でも迷わず直感的にスケジュールを構築できるよう、**各表データの設定項目の先頭に「✨ テンプレートから設定」を導入する**UI/UX刷新方針を策定・体系化します。これにより、新規表作成時だけでなく、開いている表に対してもテンプレートを一発で適用・変更できるようになります。

---

## 2. 背景と現状の課題分析

```mermaid
flowchart TD
    subgraph Current["現状の表作成フロー（課題）"]
        BtnAdd["『新しい表を追加』ボタン"] --> EmptyGrid["5×5 の空サイクルグリッドが生成"]
        EmptyGrid --> Confusion["初心者ユーザーの混乱:\n・日課を作りたいのに列（Day 1..5）の意味が不明\n・固定枠と自動配分の違いが設定を見ないと分からない\n・時限軸やコマ分数をどう調整すべきか迷う"]
    end

    subgraph Proposed["Plan22 による新フロー（狙い）"]
        NewBtn["『表を作成』"] --> ChooseMode{"作成方法の選択"}
        ChooseMode -->|初心者・定型用途| TemplateWizard["✨ テンプレートから作成\n（日課 / 週次 / 固定枠 から選択）"]
        ChooseMode -->|既存ユーザー・自由編集| CustomEmpty["従来の空テーブル作成 / インポート"]
        TemplateWizard --> FormField["必要最小限の項目だけを入力\n（タイトル、所要時間、頻度、時間帯）"]
        FormField --> AutoBuild["最適な表データが自動生成\n（適切な軸・セル・配置モードが即時適用）"]
    end
```

### 2.1. 初心者が直面する3大ハードル
1. **表の二次元構造（行×列）への落とし込みが難しい**:
   - 「毎日20分読書したい」「週に3回筋トレしたい」という単純な要求に対して、「何行何列の表を作ればよいのか」をユーザー自身が設計しなければならない。
2. **設定項目が多岐にわたり、何が必須か判断できない**:
   - `placementMode`（固定/自動）、`columnMode`（曜日/周期）、`cycleStartDay`、`startTime` / `endTime`、`periodMinutes`、`intervalMinutes`、`hasLunch`、`dailyRepeatCount`、`weeklyRepeatCount` など、高度な制御パラメータが並んでいるため、初見ではどの項目を触るべきか圧倒されてしまう。
3. **固定枠（生活リズム）と自動タスク（習慣・課題）の切り替えが分かりにくい**:
   - 開始時刻を入れると固定枠になり、空にすると自動配分になるなど、内部仕様を理解していないと意図通りのタイムライン配置にならない。

---

## 3. アップデートの全体構想

### 3.1. コンセプト:「目的から選ぶ、シンプル設定ウィザード」
表の構造（行・列・セル）から考えるのではなく、**「どのようなスケジュールを登録したいか（目的）」** から逆算して入力させるアプローチへ転換します。

ユーザーが作成時に選ぶ **3大タスク種別テンプレート**:
1. **🏃 日課（デイリータスク / ルーティン）**: 毎日または決まった曜日に継続してこなしたい習慣・学習
2. **📅 週次タスク（ウィークリータスク / 課題・目標）**: 週の空き時間に消化したいレポート・プロジェクト
3. **📌 固定タスク（固定枠 / 生活リズム・時間割）**: 授業、勤務、睡眠、食事など、時間が確定している枠

```mermaid
classDiagram
    class TemplateCategory {
        <<enumeration>>
        DAILY_ROUTINE : 日課（毎日・特定曜日）
        WEEKLY_TASK : 週次タスク（目標・課題）
        FIXED_SLOT : 固定タスク（生活リズム・時間割）
    }

    class DailyRoutineConfig {
        +title: string
        +durationMinutes: number
        +targetDays: WeekdaySelector
        +dailyRepeatCount: number | 'auto'
        +preferredTimeRange: TimeRangeSelector
    }

    class WeeklyTaskConfig {
        +title: string
        +durationMinutes: number
        +weeklyTargetCount: number
        +expiryWeeks: 1 | 2 | 'none'
        +preferredTimeRange: TimeRangeSelector
    }

    class FixedSlotConfig {
        +title: string
        +slotType: 'single' | 'timetable'
        +fixedStartTime: string
        +fixedEndTime: string
        +targetDays: WeekdaySelector
        +hasAttachedTask: boolean
    }

    TemplateCategory ..> DailyRoutineConfig : 選択時
    TemplateCategory ..> WeeklyTaskConfig : 選択時
    TemplateCategory ..> FixedSlotConfig : 選択時
```

---

## 4. テンプレート種別とピックアップ設定項目

各タスク種別ごとに、ユーザーに提示する設定項目を**必要最小限（ピックアップ項目）**に絞り込みます。
高度な軸設定（昼休み、休憩分数、行ヘッダー等）は裏側で最適なデフォルト値が自動構成されます。

### 4.1. 🏃 日課テンプレート（ルーティン・習慣タスク）
- **対象例**: 筋トレ、英会話、読書、ストレッチ、散歩、瞑想
- **内部配置方式**: `placementMode: 'auto'`
- **構成モード**:
  - **モードA. 単一メニュー（決まったタスクをこなす）**: 例「読書」「瞑想」「ストレッチ」
  - **モードB. ローテーション（日替わり・サイクル巡回）**: 例「筋トレ（胸/背中/脚/休）」「学習（単語/文法/長文）」

#### ピックアップ設定項目（ユーザー入力とUI仕様）
1. **メニュー構成**: `[ ● 単一メニュー | ○ ローテーション（日替わり） ]`
2. **【単一メニューの場合】**:
   - **タスク名**: テキスト自由入力（例:「読書」「ストレッチ」）
   - **所要時間（ロール式ドラムピッカー）**:
     - **選択ボタンを完全撤廃**し、上下に回転スクロールする「ドラムロール（ホイールピッカー）」を採用。
     - 1分〜180分（1分〜60分は1分刻み、60分以降は5分刻み等）をロール回転して直感的に選択可能。ボタンが画面を占有せず、自由な分数をスムーズに指定できます。
   - **実施頻度・曜日（枠数の最適化）**:
     - `[ ● 毎日（曜日指定なし） ]`:
       - **★最適化仕様**: 毎日実施する場合、無駄な7列グリッドを展開せず、**1行×1列（1マス）のコンパクト表**を生成します（列ヘッダー: `['毎日']`）。スケジューラー上は曜日制限なし（全曜日対象）として毎日配置されます。
     - `[ ○ 曜日を指定する ]`:
       - 曜日を指定する場合のみ月〜日の7列を展開し、`[ 月 | 火 | 水 | 木 | 金 | 土 | 日 ]` から対象曜日を個別選択（平日のみ等のプリセットあり）。
3. **【ローテーションの場合】**:
   - **ローテーション方式**: `[ 曜日別（月〜日の7日固定） | N日サイクル（Day 1, Day 2... 周期） ]`
   - **メニューリスト（各日のタイトルと所要時間）**:
     - 曜日別の場合: 月曜〜日曜の各曜日にタスク名・所要時間を入力（休み・未実施の曜日は空欄）
     - N日サイクルの場合: 「Day 1: [胸トレ] 30分」「Day 2: [背中トレ] 30分」「Day 3: [脚トレ] 30分」「Day 4: [オフ] 0分」のようにリスト追加（日数の追加・削除自由）
   - **サイクルの開始曜日（N日サイクルの場合）**: `[ 月曜日〜日曜日 ]`（周期の頭）
4. **1日の実施回数（ロール式ドラムピッカー）**:
   - **選択ボタンを完全撤廃**し、所要時間と同様に上下スクロールで回転する「ドラムロールピッカー」を採用。
   - `[ 自動 (推奨), 1回, 2回, 3回, 4回, 5回, 6回, 7回, 8回, 9回, 10回, 11回, 12回 ]` を上下ロールで回転選択。
5. **時間帯の希望（任意）**:
   - `終日自由 (指定なし)`
   - `午前中 (06:00〜12:00)` / `午後 (12:00〜18:00)` / `夜 (18:00〜23:00)`
   - `カスタム指定 (開始時刻 〜 終了時刻)`

#### 【日課】ピックアップ項目と実際に設定される項目の対応
| ピックアップ設定項目（UI） | 実際に設定される内部プロパティ（ImportedTableData） | 設定される値・挙動 |
| :--- | :--- | :--- |
| **タスク名 / メニューリスト** | `table.name`, 各セルの `title`, `text` | 単一なら該当セルに同名、ローテーションなら日替わりタイトルをセルへ展開 |
| **所要時間（ロール式ドラムピッカー）** | `axisConfig.periodMinutes`, 各セルの所要時間 | ドラムロールで回転選択された分数（1〜180分）をコマ分数・タスクの所要時間（分）に設定 |
| **実施頻度: 毎日** | `columnMode: 'weekday'`, **`numCols: 1`**, `colHeaders: ['毎日']` | **7列展開を廃止し、1行1列の最小表を生成**（曜日制約なしで全曜日に自動配分） |
| **実施頻度: 曜日指定** | `columnMode: 'weekday'`, `numCols: 7`, `colHeaders` | 選択曜日列のみセルに文字を入れ、非対象列は `null` セル化 |
| **実施頻度: N日サイクル** | `columnMode: 'cycle'`, `numCols: N`, `colHeaders` | N列（Day 1〜N）の表を生成しサイクル巡回 |
| **サイクルの開始曜日** | `table.cycleStartDay` | N日サイクルの場合、起算曜日（0:月〜6:日）をセット |
| **1日の実施回数（ロール式ドラムピッカー）**| `table.dailyRepeatCount` | ドラムロールで回転選択された回数（1〜12）または `'auto'` として設定 |
| **時間帯の希望** | `axisConfig.startTime`, `axisConfig.endTime` | 最早開始時刻・最新終了時刻（指定区間）に反映（未指定時は `null`） |
| *(自動補完・隠蔽項目)* | `placementMode: 'auto'` | 固定枠にせず、空き枠へ自動配分するモードに固定 |
| *(自動補完・隠蔽項目)* | `weeklyRepeatCount: 'auto'` | 曜日の指定通りに配置するため週回数は自動 |
| *(自動補完・隠蔽項目)* | `weeklyTaskExpiryWeeks: 1` | 当週有効（1週間）に設定 |
| *(自動補完・隠蔽項目)* | `axisConfig.intervalMinutes: 0`, `hasLunch: false` | 休憩・昼休みなしでシンプル化 |

---

### 4.2. 📅 週次タスクテンプレート（課題・目標・プロジェクト）
- **対象例**: レポート作成、資格試験の勉強、部屋の掃除、買い出し
- **内部配置方式**: `placementMode: 'auto'`
- **ピックアップ設定項目（ユーザー入力）**:
  1. **タスク名**: 例「プログラミング課題」「レポート作成」
  2. **1回の所要時間**: `[ 30分 | 60分 | 90分 | 120分 | カスタム入力 ]`
  3. **週の目標日数・回数**: `[ 週1回 | 週2回 | 週3回 | 週5回 | 自動 ]`
  4. **有効期限**: `[ 今週中 (1週間・推奨) | 2週間 | 期限なし ]`
  5. **時間帯の希望（任意）**: 日課と同様に指定可能

#### 【週次タスク】ピックアップ項目と実際に設定される項目の対応
| ピックアップ設定項目（UI） | 実際に設定される内部プロパティ（ImportedTableData） | 設定される値・挙動 |
| :--- | :--- | :--- |
| **タスク名** | `table.name`, `cells[0][c].title`, `cells[0][c].text` | 表名および目標回数分のセルにタイトル設定 |
| **1回の所要時間** | `axisConfig.periodMinutes` | 1回の消化枠サイズ（分）に設定 |
| **週の目標日数・回数** | `table.weeklyRepeatCount`, `numCols`, `colHeaders` | `3` 回なら 3列（`['Day 1', 'Day 2', 'Day 3']`）の表を生成 |
| **有効期限** | `weeklyTaskExpiryWeeks`, `axisConfig.weeklyTaskExpiryWeeks` | `1`, `2`, または `'none'`（期限切れタスクの自動管理） |
| **時間帯の希望** | `axisConfig.startTime`, `axisConfig.endTime` | 自動配分する候補区間の上限・下限を縛る（未指定時は終日） |
| *(自動補完・隠蔽項目)* | `placementMode: 'auto'` | スケジューラーが空き枠を見つけて柔軟配置 |
| *(自動補完・隠蔽項目)* | `columnMode: 'cycle'` | 曜日固定ではなく、週の中で自由に回数をこなす周期モード |
| *(自動補完・隠蔽項目)* | `dailyRepeatCount: 1` | 原則として1日1回消化（同日に重複配置させない） |
| *(自動補完・隠蔽項目)* | `numRows: 1` | 1行のシンプル構造に統一 |

---

### 4.3. 📌 固定タスクテンプレート（生活リズム・時間割枠）
- **対象例**: 大学の講義時間割、アルバイト、部活動、睡眠、食事
- **内部配置方式**: `placementMode: 'fixed'`
- **サブタイプ選択**:
  - **A. 単一固定枠（生活リズム・勤務など）**
  - **B. 時間割（講義・スクール）**

#### A. 単一固定枠（睡眠・食事・アルバイトなど）
- **ピックアップ設定項目（ユーザー入力）**:
  1. **枠名**: 例「睡眠」「朝食」「アルバイト」
  2. **開始時刻 〜 終了時刻**: 例 `00:00 〜 08:00`, `18:00 〜 22:00`
  3. **実施曜日**: `[ 毎日 | 平日のみ | 週末のみ | 個別選択 ]`

| ピックアップ設定項目（UI） | 実際に設定される内部プロパティ（ImportedTableData） | 設定される値・挙動 |
| :--- | :--- | :--- |
| **枠名** | `table.name`, セルの `title`, `text` | タイムラインに固定表示されるブロック名 |
| **開始時刻 〜 終了時刻** | `axisConfig.startTime`, `axisConfig.endTime`, `axisConfig.periodMinutes`, セルの `startMinutes`/`endMinutes` | 絶対に動かない固定時間帯枠として分数を自動算出 |
| **実施曜日** | `columnMode: 'weekday'`, `numCols: 7`, `colHeaders` | 該当曜日のセルに時間帯付きブロックを生成 |
| *(自動補完・隠蔽項目)* | `placementMode: 'fixed'` | 他のタスクが割り込めない最優先枠として保護 |
| *(自動補完・隠蔽項目)* | `dailyRepeatCount: 'auto'`, `weeklyRepeatCount: 'auto'` | 固定枠のため自動 |

#### B. 時間割枠（学校・講義）
- **ピックアップ設定項目（ユーザー入力）**:
  1. **時間割名**: 例「2026年度 前期時間割」
  2. **時限数**: `[ 5限 | 6限 | 7限 ]`
  3. **1限の開始時刻**: 例 `09:00`
  4. **1コマの分数・休憩**: 例 `90分`（休憩 `10分`）
  5. **昼休み設定**: `[ 昼休みあり (2限後・50分) | なし ]`
  6. **付随タスク（課題）の自動生成**: `[ ON (90分・推奨) | OFF ]`

| ピックアップ設定項目（UI） | 実際に設定される内部プロパティ（ImportedTableData） | 設定される値・挙動 |
| :--- | :--- | :--- |
| **時間割名** | `table.name` | 時間割全体の管理名 |
| **時限数** | `numRows`, `rowHeaders` | 行数（`['1限', '2限', ...]`）を自動構築 |
| **1限開始時刻** | `axisConfig.startTime` | 時間割全体の基準開始時刻 |
| **1コマ分数・休憩** | `axisConfig.periodMinutes`, `axisConfig.intervalMinutes` | 時限ごとの時間計算に自動適用 |
| **昼休み設定** | `axisConfig.hasLunch`, `lunchAfterPeriod`, `lunchMinutes` | 指定時限の後に昼休み空白ブロックを自動挿入 |
| **付随タスクの生成** | `attachedTaskConfig: { enabled, titleTemplate, durationMinutes }` | 各授業ごとに課題タスク（復習等）を自動生成する設定 |
| *(自動補完・隠蔽項目)* | `columnMode: 'weekday'`, `numCols: 5`, `colHeaders: ['月曜'..'金曜']` | 平日5日間の標準時間割グリッドを自動構築 |
| *(自動補完・隠蔽項目)* | 各セルの `startMinutes`, `endMinutes` | 時限・休憩・昼休みから各コマの開始/終了分を全自動計算 |

---

## 5. UI/UXフロー設計

### 5.1. 各表データ設定項目の先頭への「✨ テンプレートから設定」配置
新規に表を作るタイミングだけでなく、**「今開いている表」や「既存の表」に対しても直感的にテンプレートを適用・変更できるようにするため、各表データの設定項目の先頭に『✨ テンプレートから設定』ボタンを配置**します。

```
【デスクトップ版 ツールバー（常時表示メインバー）】
[ ✨ テンプレートから設定 ] | [ 配置: 📌固定 / ⚡自動 ] [ 周期の頭: 月〜 ] [ 時間: 〜 ] [ 1コマ: 分 ] ...
  ↑ 各表データ設定項目の「一番先頭」に配置

【詳細設定ドロワー / モーダル】
┌───────────────────────────────────────────────┐
│ [ ✨ テンプレートから設定 ] (最上部に大きく配置) │
├───────────────────────────────────────────────┤
│ セクション 1: 表のマス目 ＆ 取り込み            │
│ セクション 2: 時間帯とコマ割り                  │
│ セクション 3: 昼休み設定                       │
│ セクション 4: 計画表への配置ルール             │
└───────────────────────────────────────────────┘
```

### 5.2. テンプレート設定モーダル（ステップ・ウィザード設計）

```mermaid
stateDiagram-v2
    [*] --> Step1_SelectType: 「✨ テンプレートから設定」クリック
    
    state Step1_SelectType {
        [*] --> CategoryCards
        CategoryCards: 🏃 日課（ルーティン / 単一・ローテーション）
        CategoryCards: 📅 週次タスク（目標・課題）
        CategoryCards: 📌 固定枠（生活リズム・時間割）
    }

    Step1_SelectType --> Step2_Configure: カテゴリを選択
    
    state Step2_Configure {
        [*] --> FormFields
        FormFields: ピックアップ設定項目を入力
        FormFields: リアルタイム・プレビュー表示
    }

    Step2_Configure --> Finish: 「この表に設定を適用」クリック
    Finish --> [*]: 開いている表の設定・セル構造が更新され、計画表へ即時同期反映
```

#### モーダルの画面レイアウト案
- **左側（入力パネル）**: ピックアップ項目（タイトル、時間、曜日、回数）のすっきりした入力フォーム。
- **右側（ライブプレビュー）**:
  - 設定内容に応じて、生成されるタイムライン上の配置イメージ（「月・水・金 20:00〜21:00 に配置されます」「週3回、空き枠に自動配分されます」等）を分かりやすい要約カードで即時表示。

---

## 6. 生成される表データの内部マッピング仕様

テンプレートから入力された値は、以下のルールで既存の `ImportedTableData` 型へ完全変換されます。

```typescript
// 変換マッピングのシグネチャ例
export interface DailyMenuItem {
  title: string;
  durationMinutes?: number; // 未指定時はデフォルト所要時間を適用
}

export interface DailyRoutineTemplateInput {
  name: string; // 表のタイトル（例:「朝の筋トレ」「英語学習」）
  mode: 'single' | 'weekday_rotation' | 'cycle_rotation';

  // 単一メニューの場合（毎日・特定曜日に同じタスク）
  singleTask?: {
    title: string;
    durationMinutes: number;
    isEveryday?: boolean; // true の場合は1行1列の最小表を生成
    targetDays?: number[]; // 曜日指定時（0:月〜6:日）
  };

  // 曜日別ローテーションの場合（月〜日でメニューを変える）
  weekdayRotation?: {
    days: Record<number, DailyMenuItem | null>; // 0:月〜6:日
    defaultDurationMinutes?: number;
  };

  // N日サイクルローテーションの場合（Day 1..N を巡回する）
  cycleRotation?: {
    cycleLength: number; // 周期日数（例: 3, 4）
    items: (DailyMenuItem | null)[]; // 各Dayのメニュー（Day 1 〜 Day N）
    cycleStartDay?: number; // 周期の開始曜日（0:月〜6:日、デフォルト0）
    defaultDurationMinutes?: number;
  };

  dailyRepeatCount?: number | 'auto';
  timeRange?: { startTime: string | null; endTime: string | null };
}

export interface WeeklyTaskTemplateInput {
  title: string;
  durationMinutes: number;
  weeklyTargetCount: number | 'auto';
  expiryWeeks: 1 | 2 | 'none';
  timeRange?: { startTime: string | null; endTime: string | null };
}

export interface FixedSlotTemplateInput {
  title: string;
  startTime: string;
  endTime: string;
  targetDays: number[]; // 0:月〜6:日
}
```

### 6.1. 日課（`DailyRoutineTemplateInput`）のマッピング仕様
- `id`: `table-daily-${Date.now()}`
- `name`: `input.name`
- `placementMode`: `'auto'`
- `dailyRepeatCount`: `input.dailyRepeatCount ?? 'auto'`
- `weeklyRepeatCount`: `'auto'`
- `weeklyTaskExpiryWeeks`: 1
- `numRows`: 1
- `axisConfig`:
  - `startTime`: `input.timeRange?.startTime ?? null`
  - `endTime`: `input.timeRange?.endTime ?? null`
  - `periodMinutes`: 主要な所要時間（未指定時は 30）
  - `intervalMinutes`: 0, `hasLunch`: false, `weeklyTaskExpiryWeeks`: 1
- **モード別の列とセルの生成**:
  1. **単一メニュー (`mode: 'single'`)**:
     - **毎日実施 (`isEveryday: true` または全曜日)**:
       - `columnMode: 'weekday'`, **`numCols: 1`**, `colHeaders: ['毎日']`
       - セル1つのみ生成（`title: singleTask.title`, `text: singleTask.title`）。
       - スケジューラー側で曜日制限（`targetDays`）なしとして毎日自動配置。
     - **曜日指定時 (`isEveryday: false`)**:
       - `columnMode: 'weekday'`, `numCols: 7`, `colHeaders: ['月曜'..'日曜']`
       - `targetDays` に含まれる列のみ `title: singleTask.title`, `text: singleTask.title` を設定。
  2. **曜日別ローテーション (`mode: 'weekday_rotation'`)**:
     - `columnMode: 'weekday'`, `numCols: 7`, `colHeaders: ['月曜'..'日曜']`
     - 月〜日の各曜日に `days[c]` で指定された日替わりタイトル・所要時間をセット（未指定日は `null`）。
  3. **N日サイクルローテーション (`mode: 'cycle_rotation'`)**:
     - `columnMode: 'cycle'`, `numCols: cycleLength`
     - `colHeaders`: `['Day 1', 'Day 2', ... 'Day N']`
     - `cycleStartDay`: `input.cycleRotation.cycleStartDay ?? 0`
     - 各Dayのセルに `items[c]` のタイトル・所要時間をセット。

### 6.2. 週次タスク（`WeeklyTaskTemplateInput`）のマッピング仕様
- `id`: `table-weekly-${Date.now()}`
- `placementMode`: `'auto'`
- `columnMode`: `'cycle'`
- `cycleStartDay`: 0
- `dailyRepeatCount`: 1
- `weeklyRepeatCount`: `input.weeklyTargetCount`
- `weeklyTaskExpiryWeeks`: `input.expiryWeeks`
- `numRows`: 1, `numCols`: 5 (または指定回数)
- `colHeaders`: `['Day 1', 'Day 2', 'Day 3', ...]`
- `axisConfig`:
  - `startTime`: `input.timeRange?.startTime ?? null`
  - `endTime`: `input.timeRange?.endTime ?? null`
  - `periodMinutes`: `input.durationMinutes`
  - `weeklyTaskExpiryWeeks`: `input.expiryWeeks`

### 6.3. 固定枠（`FixedSlotTemplateInput`）のマッピング仕様
- `id`: `table-fixed-${Date.now()}`
- `placementMode`: `'fixed'`
- `columnMode`: `'weekday'`
- `cycleStartDay`: 0
- `numRows`: 1, `numCols`: 7
- `colHeaders`: `['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜']`
- `axisConfig`:
  - `startTime`: `input.startTime`
  - `endTime`: `input.endTime`
  - `periodMinutes`: 終了時刻 - 開始時刻
  - `intervalMinutes`: 0
- `cells`: 対象曜日のセルに該当時間帯のコマを配置

---

### 6.4. 入力項目と内部プロパティの総合対比一覧（マッピング総括表）

ユーザーが直感的に入力する**ピックアップ項目**が、表データ（`ImportedTableData`）およびスケジューラーにどのように作用するかを総括した一覧です。

| 分類 | ピックアップ入力項目（UI） | 実際に設定される内部プロパティ（ImportedTableData） | 内部デフォルト値 / 自動補完 | スケジューラー配置への効果 |
| :--- | :--- | :--- | :--- | :--- |
| **全共通** | タスク名 / 枠名 | `name`, `cells[r][c].title`, `text`, `fullText` | — | 計画表・タスク一覧に表示されるタイトル |
| **全共通** | 1回の所要時間 | `axisConfig.periodMinutes`, `cells[r][c].startMinutes/endMinutes` | — | タイムライン上で占有するコマの長さ（分） |
| **全共通** | 時間帯の希望（区間） | `axisConfig.startTime`, `axisConfig.endTime` | 未指定時は `null`（終日配置） | 最早開始時刻 `earliestStartTime` / 最新終了時刻 `latestEndTime` による配置区間制限 |
| **日課** | 実施曜日 (月〜日) | `columnMode: 'weekday'`, `numCols: 7`, セル配置列 | 非対象曜日は `null` セル | 指定曜日の `targetDays` にのみタスクを配置 |
| **日課** | 1日の実施回数 | `dailyRepeatCount` (1, 2, 'auto' 等) | デフォルト `1` | 1日の中で反復消化する目標回数を指定 |
| **週次** | 週の目標日数・回数 | `weeklyRepeatCount`, `numCols: N` | デフォルト `1` (週1回) | 週の消化可能空き枠へ前倒し/バランス配置 |
| **週次** | 有効期限 | `weeklyTaskExpiryWeeks`, `axisConfig.weeklyTaskExpiryWeeks` | 推奨 `1` (当週中) | 期限超過タスクの繰り越し・失効判定 |
| **固定** | 開始・終了時刻 | `axisConfig.startTime`, `endTime`, `periodMinutes` | — | 決まった時刻に他タスクを遮断して固定枠配置 |
| **固定** | 付随タスク（課題） | `attachedTaskConfig: { enabled, titleTemplate, durationMinutes }` | デフォルト OFF (時間割時はON推奨) | コマ終了後や週内の空き時間に課題タスクを自動生成 |
| **自動補完** | 配置方式 | `placementMode` | 日課/週次: `'auto'`<br>固定枠: `'fixed'` | ユーザーが意識せずとも最適な配置モードを確定 |
| **自動補完** | 列管理方式 | `columnMode` | 日課/固定: `'weekday'`<br>週次: `'cycle'` | 曜日別管理と目標回数消化の切り替えを隠蔽 |
| **自動補完** | 周期の頭 | `cycleStartDay` | `0` (月曜日起算) | 週やサイクルの開始起点を統一 |
| **自動補完** | 計画表への反映 | `isApplied` | `true` | 作成と同時にタイムラインへ即時反映 |

---

---

## 7. 実装ロードマップ

```mermaid
timeline
    title Plan22 実装フェーズ
    Phase 1 : テンプレート型定義・データマッピング基盤の作成
            : `src/lib/templates/tableTemplates.ts` 実装
            : 単体テスト（入力値から ImportedTableData への正確な変換テスト）
    Phase 2 : テンプレート選択モーダル・UIコンポーネント開発
            : `TableTemplateWizardModal.tsx` 新設
            : 3大タスク種別のタブ / カード選択UI
            : リアルタイム・プレビュー表示コンポーネント
    Phase 3 : ImportedTablesManager との統合・導線接続
            : ツールバー「表を作成」ドロップダウンの刷新
            : 作成後の自動反映＆ハイライト表示
    Phase 4 : E2E・手動検証＆ドキュメント整備
            : 初回利用シナリオでの動作確認
            : ユーザーマニュアル・README の更新
```

---

## 8. まとめ・期待される効果

1. **オンボーディングの劇的な改善**:
   - 初めて利用するユーザーでも、「日課」「週次タスク」「固定枠」の目的を選ぶだけで、1分以内に完璧なスケジュールデータを作成・反映できるようになります。
2. **設定ミス・不整合の防止**:
   - 内部仕様に精通していなくても、テンプレート経由であれば適切な `placementMode` や `startTime` / `endTime` の組み合わせが保証され、Plan21で指摘されたような設定不整合が発生しなくなります。
3. **既存の高度な編集機能との共存**:
   - テンプレートから作った表は、後からいつでも従来のグリッドエディタで詳細に微調整（行の追加、時限ごとの時間変更、付随タスク付与など）が可能です。手軽さと高度な柔軟性を両立したシステムを実現します。
