import Dexie, { type EntityTable } from 'dexie'
import { SEED_EXERCISES } from './seedExercises'
import type {
  Exercise,
  PersonalRecord,
  UserSettings,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from './types'

/*
  端末の中のデータベース（IndexedDB）。サーバーは使わない
  ・Dexie は IndexedDB を使いやすくするライブラリ
  ・stores() の文字列は「最初が主キー、そのあとが検索に使う索引」
    [a+b] は2つ組み合わせた索引
  ・true/false の項目は IndexedDB で索引にできないので、索引に入れない
*/
export const db = new Dexie('kintore-memo') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  templates: EntityTable<WorkoutTemplate, 'id'>
  sessions: EntityTable<WorkoutSession, 'id'>
  workoutExercises: EntityTable<WorkoutExercise, 'id'>
  sets: EntityTable<WorkoutSet, 'id'>
  records: EntityTable<PersonalRecord, 'id'>
  settings: EntityTable<UserSettings, 'id'>
}

db.version(1).stores({
  exercises: 'id, muscleGroup, name',
  templates: 'id, updatedAt',
  sessions: 'id, startedAt, status',
  workoutExercises: 'id, sessionId, exerciseId, [sessionId+order]',
  sets: 'id, workoutExerciseId, sessionId, completedAt',
  records: 'id, exerciseId, [exerciseId+type], achievedAt',
  settings: 'id',
})

// 2版：自己ベストを「どの回で出したか」で探せるように索引を足す（今のデータはそのまま）
db.version(2).stores({
  records: 'id, exerciseId, [exerciseId+type], achievedAt, sessionId',
})

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'me',
  theme: 'light',
  restSeconds: 90,
  weightStepKg: 2.5,
  restAuto: true,
  lastExportAt: null,
  shareDefaults: {
    muscleGroups: true,
    exerciseCount: true,
    totalSets: true,
    totalVolume: true,
    duration: true,
    personalRecords: true,
    growth: true,
    effort: true,
    message: true,
    // メモは個人的なことが書かれやすいので、最初は出さない
    note: false,
  },
  shareMessage: '',
}

// データベースを初めて作ったときだけ動く：初期の種目と設定を入れる
// （2回目以降は動かないので、種目が二重に入ることはない）
db.on('populate', (tx) => {
  const now = Date.now()
  tx.table('exercises').bulkAdd(
    SEED_EXERCISES.map(
      (e, i): Exercise => ({
        id: crypto.randomUUID(),
        name: e.name,
        muscleGroup: e.group,
        isCustom: false,
        isBodyweight: e.bw ?? false,
        archived: false,
        // 並びを入れた順に揃えるため、1ミリ秒ずつずらす
        createdAt: now + i,
      }),
    ),
  )
  tx.table('settings').add(DEFAULT_SETTINGS)
})

/*
  保存したデータが勝手に消されにくくする
  ・ブラウザは容量が足りないとき、サイトのデータを消すことがある
  ・persist() を頼むと「消さないで」の扱いになる（ブラウザが断ることもある）
  ・iPhone はホーム画面に追加すると守られやすい
*/
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
