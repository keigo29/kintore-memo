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
  data/
    types.ts             データの型（種目・メニュー・記録・セット・自己ベスト・設定）
    db.ts                端末の中のデータベース（Dexie / IndexedDB）
    seedExercises.ts     最初から入っている種目
    muscleGroups.ts      筋群の一覧と色
    exercises.ts         種目の追加・編集・隠す・検索用の文字そろえ
    workout.ts           トレーニングの開始・前回の記録・セットの完了・終了
    stats.ts             日ごと・筋群ごとのセット数の集計
  lib/
    format.ts            重量・時間・日付の表示の形
    date.ts              日付の計算（その日・その週の始まり）
    useNow.ts            1秒ごとの時刻（経過時間）
  screens/
    HomeScreen.tsx       ホーム
    ExercisesScreen.tsx  種目（筋群で絞りこみ・検索・追加・編集・隠す）
    WorkoutScreen.tsx    トレーニング中（経過時間・種目の一覧・終える）
    ExerciseRecord.tsx   種目ごとのセットの記録
    PlaceholderScreens.tsx  履歴・分析（今は枠だけ）
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
