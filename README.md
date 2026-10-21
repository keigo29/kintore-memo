# 筋トレメモ

筋トレの記録・振り返り・成果画像の共有ができる PWA。
デザインは「Workstation デザインルール」に合わせています（ライトが基本）。

## 動かし方

```bash
npm install
npm run dev        # http://localhost:5173 で開く
```

スマホで見るときは、同じ Wi-Fi で `npm run dev` の表示にある `Network:` の URL を開きます。

```bash
npm run build      # 型チェック＋本番用に書き出し（dist/）
npm run preview    # 書き出したものを確認
npm test           # 計算とバックアップファイルのテスト
```

## GitHub Pages で公開する

1. GitHub で新しいリポジトリを作る（例：`kintore-memo`）
2. このフォルダを push する
   ```bash
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/ユーザー名/kintore-memo.git
   git push -u origin main
   ```
3. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
4. **Actions** タブで「Deploy to GitHub Pages」が緑になれば公開完了
   → `https://ユーザー名.github.io/kintore-memo/`

以後は main に push するたびに自動で公開されます（`.github/workflows/deploy.yml`）。
公開の住所はリポジトリ名から自動で決まるので、別の名前にしても設定の書きかえは不要です。

スマホでは公開した URL を開き、iPhone は Safari の共有ボタン→「ホーム画面に追加」、
Android は Chrome のメニュー→「アプリをインストール」でアプリとして使えます。

## フォルダの中身

```
src/
  main.tsx               入り口。フォントと CSS を読み込む
  App.tsx                タブの切り替え
  components/
    TabBar.tsx           下のタブ（ホーム・履歴・分析・種目）
    EmptyState.tsx       空のときの表示
    Toast.tsx            画面の下に出る短いお知らせ
    MuscleIcon.tsx       筋群アイコン（オリジナル）
    Dialog.tsx           ダイアログ（スマホでは下から出る）
    Switch.tsx           オン/オフのスイッチ
    ExerciseFormDialog.tsx  種目の追加・編集
    StartDialog.tsx      はじめ方（何も決めずに／前回と同じ種目で）
    ExercisePickerDialog.tsx  トレーニング中に種目を選ぶ
    NumberStepper.tsx    大きな±で数字を入れる
    TrainingHeatmap.tsx  鍛えた日の記録（GitHub の草のような表）を1つ描く
    TrainingHeatmapList.tsx  「すべて」と筋群ごとの表を縦に並べる（ホーム）
    BrandMark.tsx        ロゴの銀色のダンベル
    RestTimer.tsx        休憩タイマーの帯
    SessionReport.tsx    1回分のまとめの表示（数字のタイル・種目ごと・あと何回・計算のしかた）
    Charts.tsx           分析のグラフ（折れ線・週ごとの棒・筋群ごとの横棒。SVG で描く）
  data/
    types.ts             データの型（種目・メニュー・記録・セット・自己ベスト・設定）
    db.ts                端末の中のデータベース（Dexie / IndexedDB）
    seedExercises.ts     最初から入っている種目
    muscleGroups.ts      筋群の一覧と色
    exercises.ts         種目の追加・編集・隠す・検索用の文字そろえ
    workout.ts           トレーニングの開始・前回の記録・セットの完了・終了
    stats.ts             日ごと・筋群ごとのセット数の集計
    summary.ts           1回分のまとめ・前回比・自己ベストの判定と保存・計算し直し
    history.ts           履歴の一覧・削除・日時の変更
    templates.ts         トレーニングメニュー（保存・複製・過去の記録から作る・メニューからはじめる）
    home.ts              ホームの数字（今月と先月・筋群ごとの前回・最近の自己ベスト・直近の履歴）
    settings.ts          設定の読み書き（古いデータに足りない項目は最初の値で補う）
    backupFormat.ts      バックアップファイル（JSON）の形と、読み込む前の確認
    backupFormat.test.ts backupFormat.ts のテスト（npm test）
    backup.ts            書き出し・読み込み（置きかえ）・すべて削除
    analysis.ts          分析の数字（期間まとめ・週ごとの回数・筋群別セット・種目の推移・自己ベスト）
  lib/
    format.ts            重量・時間・日付の表示の形
    theme.ts             テーマ（ライト／ダーク／端末に合わせる）の切りかえ
    date.ts              日付の計算（その日・その週の始まり）
    useNow.ts            1秒ごとの時刻（経過時間）
    restTimer.ts         休憩タイマーのしくみ（終わる時刻で数える・端末に保存・音とバイブ）
    calc.ts              計算のきまり（総挙上量・推定1RM・前回比・あと何回）
    calc.test.ts         calc.ts のテスト（npm test）
  screens/
    HomeScreen.tsx       ホーム
    ExercisesScreen.tsx  種目（筋群で絞りこみ・検索・追加・編集・隠す）
    WorkoutScreen.tsx    トレーニング中（経過時間・種目の一覧・終える）
    ExerciseRecord.tsx   種目ごとのセットの記録
    ReviewScreen.tsx     振り返り（記録の数字と、自分の感じ方を分けて）
    SummaryScreen.tsx    トレーニング終了（その日の成果）
    ShareScreen.tsx      共有画像のプレビュー・項目の選択・保存と共有
  share/
    shareLayout.ts       共有画像のレイアウト（アプリの画面とは別に管理）・出す中身の決め方
    drawShareImage.ts    Canvas に描いて PNG にする（フォント待ち・はみ出し防止・折り返し）
    shareActions.ts      共有シート（navigator.share）と保存
    HistoryScreen.tsx    履歴（回数・月のカレンダー・日付ごとの一覧）
    HistoryDetailScreen.tsx  過去の記録の詳細・編集・複製・削除・メニューにする
    TemplateEditScreen.tsx   メニューを作る・直す（種目・セット数・並べかえ）
    AnalysisScreen.tsx   分析（期間まとめ・週ごとの回数・筋群別・種目の推移・自己ベスト）
    SettingsScreen.tsx   設定（テーマ・重量の刻み・休憩・バックアップ・データ・このアプリについて）
  styles/
    tokens.css           デザインのトークン（色・角丸・影）。色はここだけに書く
    base.css             全体の土台
    components.css       ボタン・カード・タブなどの部品
    home.css             ホームだけの見た目
public/                  アプリのアイコン
```

## 使っているもの（すべて同梱、外部 CDN なし）

- アイコン：Lucide（lucide-react）
- フォント：英数字は Roboto Mono、日本語は Zen Kaku Gothic New（@fontsource）。日本語は使った文字の分だけ読みこみ・保存
- PWA：vite-plugin-pwa
- データの保存：Dexie（IndexedDB）。サーバーは使わず、すべて端末の中

## データの中身を見る

Chrome の開発者ツール → Application → IndexedDB → kintore-memo で、保存された中身を確認できます。

## データのバックアップ

記録は端末の中（IndexedDB）だけにあります。設定 →「バックアップ」の「書き出す」で、すべてのデータを JSON ファイルに保存できます。
機種変更のときは、新しい端末で「読み込む」を選ぶと、いまのデータがファイルの中身に置きかわります（足し合わせはしません）。
