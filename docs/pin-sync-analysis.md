# ピン留め同期「正しく動く理由」の分析

リロードでピンが消えるバグの根本原因と、現在の実装がどう競合を避けているかを整理した分析メモ。

---

## 1. 初期値とガード

### 現在の App.tsx の実装

- **`pinnedTraining` の初期値**  
  `useState<PinnableId[]>(() => loadPinnedTrainingTasks())`  
  → **localStorage**（`TRAINING_PIN_KEY` = `'kira-training-pins'`）から読み込んだ配列。  
  未保存の場合は `[]`、過去にピン留めしていればその配列。

- **サーバー取得前に PUT を防ぐガード**  
  現在のリポジトリでは **ピン留めをサーバーに送る処理が存在しない**。  
  - `getCurrentProgressSnapshot()`（`traineeProgressStorage.ts`）が返す `TraineeProgressSnapshot` に `pins` フィールドはない。  
  - 定期保存の `save()` は `postProgress(name, getCurrentProgressSnapshot())` のみで、スナップショットにピンは含まれない。  
  そのため「サーバーからデータを取る前に updateAndSave(PUT) が走る」という経路は **現状のコードにはない**。

つまり、**現在のコードでは「初期値＋ガード」で守っているのではなく、「ピンをサーバーに送っていない」ことで、誤った PUT による上書きが発生しない状態になっている**。

---

## 2. useEffect の発火条件（ピン留め周り）

### ピン留めを「監視」している useEffect

- ピン留めリストを監視して **サーバーに保存する** ような `useEffect` は **存在しない**。  
  ピンの更新は `handleTogglePin` 内で完結している。

### 関連する処理

| 箇所 | 依存配列 | ブロック条件 | 役割 |
|------|----------|--------------|------|
| `handleTogglePin` | （コールバック） | なし | ローカル state 更新 ＋ **localStorage にだけ** `TRAINING_PIN_KEY` で保存。サーバーへは送らない。 |
| 定期保存の `useEffect` (433–458行付近) | `[isAdminView]` | `if (isAdminView \|\| typeof window === 'undefined') return` | `getCurrentProgressSnapshot()` → `postProgress()`。スナップショットに `pins` は含まれない。 |
| サーバー取得の `useEffect` (574–591行付近) | `[isAdminView]` | `if (isAdminView \|\| !isProgressApiAvailable() \|\| typeof window === 'undefined') return` および `name` の存在チェック | `fetchMyProgress(name)` で `serverSnapshot` を更新。**`serverSnapshot` を `pinnedTraining` に反映する処理はない**（現状は `serverSnapshot` は遅延タスク・進捗％表示用）。 |

### ストレージ／フォーカス同期

- `updateFromStorage`（347–357行付近）  
  `setPinnedTraining(loadPinnedTrainingTasks())` で **localStorage から再読込**。  
- `storage` / `focus` / `visibilitychange` で `updateFromStorage` を呼ぶ `useEffect`（403–416行付近）  
  → タブ切替やリロード後に localStorage の内容でピン留めが再描画される。

まとめると、**ピン留めを「監視」してサーバーに送る useEffect はなく、ピンは常に localStorage のみで永続化されている**。

---

## 3. バグ再発の懸念と「レースコンディション」の回避

### 以前起きていたバグ（サーバー同期ありの実装を想定）

- ピン留めを **サーバーにも保存する** 実装（`TraineeProgressSnapshot` に `pins` を含め、`PUT /progress` で送る）だった場合に起きていた事象：
  1. マウント直後、`pinnedTraining` の初期値が `[]`。
  2. 何らかのタイミング（例: 定期保存や「ピン留めを監視する useEffect」）で `updateAndSave(username, { pins: [] })` 相当が実行される。
  3. サーバーからの GET が返る前に、空配列が PUT され、サーバー上のピン留めが上書きされる。
  4. その後 GET で取得したデータが空になり、リロードでピンが消えたように見える。

つまり「**初期値の空配列が、サーバー取得より先に PUT されてしまう**」レースコンディション。

### 現在のコードで競合が起きない理由

- **ピンをサーバーに送っていない**  
  - `getCurrentProgressSnapshot()` に `pins` が無い。  
  - `postProgress` に渡すスナップショットにもピンが含まれない。  
- そのため「空のピン配列でサーバーを上書きする」経路が **そもそも存在しない**。  
- ピンは **localStorage のみ** で保持され、初期表示も `loadPinnedTrainingTasks()`、再描画も `updateFromStorage` で localStorage から読むだけなので、リロード後もピンが消えない。

### 将来「ピンをサーバー同期する」実装に戻す場合の対策（再発防止）

同じバグを防ぐには、次のようなガードが必要になる。

1. **初期値を「未取得」とみなす**  
   `pinnedTraining` の初期値を `null` にし、「まだサーバーから取得していない」と区別する。
2. **PUT の前に「サーバー取得済み」を確認する**  
   - 例: `isDataReady` のような ref を用意し、初回の GET で `serverSnapshot` を `pinnedTraining` に反映した後にだけ `true` にする。  
   - `updateAndSave`（またはそれに相当する保存処理）の前に `if (pinnedTraining === null || !isDataReady.current) return` を入れ、**サーバーからデータを取得し反映するまで PUT を一切呼ばない**。
3. **保存処理を一箇所にまとめる**  
   例: `guardedUpdateAndSave` のようなラッパーで、上記ガードを通した場合だけ `updateAndSave` を実行する。  
   ピン・検索履歴・進捗など、サーバーと同期するすべての更新をここ経由にすると、誤った上書きを防ぎやすい。
4. **PUT 直後の一定時間は GET 結果で上書きしない**  
   `lastPutAtRef` と `PUT_DEBOUNCE_MS` のように、直近で PUT した直後は定期 GET の結果で `pinnedTraining` を上書きしないようにする。

これらにより「初期値の空配列が先に PUT される」レースを回避できる。

---

## 4. 比較対象ファイルの役割

### web/src/App.tsx

- `pinnedTraining`: 初期値は `loadPinnedTrainingTasks()`（localStorage）。
- ピンの更新: `handleTogglePin` で state と localStorage のみ更新。サーバー送信なし。
- `serverSnapshot`: `fetchMyProgress` で 5 秒ごとに取得。`delayedIds` / `wbsPercent` の表示用。`pinnedTraining` との同期は行っていない。
- 定期保存: `getCurrentProgressSnapshot()` → `postProgress()`。スナップショットに `pins` は含まれない。

### web/src/progressApi.ts

- `postProgress(traineeId, snapshot)`: `TraineeProgressSnapshot` をそのまま `PUT /progress` で送る。  
  型定義上 `TraineeProgressSnapshot` に `pins` が無いため、現状はピンは送られない。
- `fetchMyProgress(traineeId)`: GET で全受講生進捗を取得し、該当 `traineeId` のものを返す。  
  バックエンドが `pins` を返していても、フロントの型と App の使い方では `pinnedTraining` には未使用。

### web/src/traineeProgressStorage.ts

- `TraineeProgressSnapshot`: `introConfirmed`, `introAt`, `wbsPercent`, `chapterProgress`, `currentDay`, `delayedIds`, `updatedAt` のみ。**`pins` なし**。
- `getCurrentProgressSnapshot()`: 上記フィールドだけを集めたオブジェクトを返す。ピンは含まない。

---

## まとめ

| 観点 | 現在の実装 |
|------|------------|
| 初期値 | `pinnedTraining` = localStorage から読んだ配列（`loadPinnedTrainingTasks()`）。 |
| サーバー取得前に PUT を防ぐガード | ピンをサーバーに送る処理が無いため、該当するガードは存在しない（不要）。 |
| ピン留めを監視する useEffect | なし。ピンは `handleTogglePin` と localStorage のみで管理。 |
| レースの回避 | ピンを PUT していないため、「空配列でサーバーを上書きする」経路が無く、競合が発生しない。 |

「リロードしてもピンが消えない」のは、**ピンをサーバーと同期しておらず、localStorage のみで永続化している**ため。  
ピンを再度サーバー同期する場合は、上記「再発防止」のガード（null 初期値・isDataReady・guardedUpdateAndSave・PUT 直後の上書き抑制）を入れると安全。
