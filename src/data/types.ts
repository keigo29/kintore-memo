import type { MuscleGroup } from './muscleGroups'

/*
  データの型
  ・id は文字列（crypto.randomUUID()）
  ・日時はミリ秒の数値（Date.now()）
  ・「入力していない」は null、「0」は 0。この2つは必ず区別する
    例：重量 null ＝まだ入れていない／重量 0 ＝ 0kg と記録した
  ・合計（総挙上量・セット数など）は保存しない。毎回セットから計算する（ずれを防ぐ）
*/

/** 種目 */
export type Exercise = {
  id: string
  name: string
  muscleGroup: MuscleGroup
  /** 自分で追加した種目か（最初から入っている種目は false） */
  isCustom: boolean
  /** 自重の種目か（重量を入れない。総挙上量にも数えない） */
  isBodyweight: boolean
  /** 一覧から隠したか（過去の記録が消えないよう、削除ではなく隠す） */
  archived: boolean
  createdAt: number
}

/** トレーニングメニュー（並びは items の順番） */
export type WorkoutTemplate = {
  id: string
  name: string
  items: { exerciseId: string; targetSets: number | null }[]
  createdAt: number
  updatedAt: number
}

/** 1回のトレーニング */
export type WorkoutSession = {
  id: string
  startedAt: number
  /** 終えた時刻。トレーニング中は null */
  endedAt: number | null
  /** もとにしたメニュー。何も選ばずに始めたら null */
  templateId: string | null
  status: 'active' | 'done'
  /** 自分で感じたきつさ（1〜10）。入れていなければ null */
  effort: number | null
  /** 振り返りのメモ */
  note: string | null
}

/** そのトレーニングでやった種目 */
export type WorkoutExercise = {
  id: string
  sessionId: string
  exerciseId: string
  /** 並び順（0 から） */
  order: number
  note: string | null
}

/** あと何回できたか：0〜10、または「分からない」 */
export type Rir = number | 'unknown'

/** 1セットの記録 */
export type WorkoutSet = {
  id: string
  workoutExerciseId: string
  /** 検索しやすいように、どのトレーニングのセットかも持っておく */
  sessionId: string
  order: number
  /** 本番かウォームアップか（ウォームアップは合計に数えない） */
  kind: 'normal' | 'warmup'
  weightKg: number | null
  reps: number | null
  /** 補助してもらったか（自己ベストと推定1RMからは外す） */
  assisted: boolean
  /** あと何回できたか。入れていなければ null */
  rir: Rir | null
  /** 「完了」を押した時刻。まだなら null（完了したセットだけを合計に数える） */
  completedAt: number | null
  note: string | null
}

/** 自己ベストの種類：最高重量／推定1RM／その種目の1回の総挙上量 */
export type RecordType = 'maxWeight' | 'e1rm' | 'maxVolume'

/** 自己ベスト（更新の歴史を残すため、更新のたびに1件ふえる） */
export type PersonalRecord = {
  id: string
  exerciseId: string
  type: RecordType
  value: number
  sessionId: string
  setId: string | null
  achievedAt: number
}

/** 共有画像に出す項目のオン/オフ */
export type ShareDefaults = {
  muscleGroups: boolean
  exerciseCount: boolean
  totalSets: boolean
  totalVolume: boolean
  duration: boolean
  personalRecords: boolean
  growth: boolean
  effort: boolean
  message: boolean
  note: boolean
}

/** 設定（1件だけ。id は 'me'） */
export type UserSettings = {
  id: 'me'
  theme: 'light' | 'dark' | 'system'
  /** 休憩タイマーの最初の秒数 */
  restSeconds: number
  /** ±ボタンで重量を変える幅 */
  weightStepKg: number
  shareDefaults: ShareDefaults
  shareMessage: string
}
