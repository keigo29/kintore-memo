import { MUSCLE_GROUPS } from './muscleGroups'
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
  バックアップファイル（JSON）の形
  {
    "app": "kintore-memo",     ← このアプリのファイルか見分ける
    "format": 1,               ← ファイルの形の版。形を変えたら上げる
    "exportedAt": 1761000000000,
    "data": { "exercises": [...], "templates": [...], "sessions": [...],
              "workoutExercises": [...], "sets": [...], "records": [...], "settings": [...] }
  }
  ・読み込むときは、中身を1つずつ確かめてから入れる（壊れたファイルで全部消えるのを防ぐ）
  ・このファイルはデータベースを使わない（テストしやすいように）
*/

export const BACKUP_APP = 'kintore-memo'
export const BACKUP_FORMAT = 1

export type BackupData = {
  exercises: Exercise[]
  templates: WorkoutTemplate[]
  sessions: WorkoutSession[]
  workoutExercises: WorkoutExercise[]
  sets: WorkoutSet[]
  records: PersonalRecord[]
  settings: UserSettings[]
}

export type BackupFile = { app: typeof BACKUP_APP; format: number; exportedAt: number; data: BackupData }

export type ParseResult = { ok: true; file: BackupFile } | { ok: false; error: string }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (o: Obj, k: string) => typeof o[k] === 'string' && (o[k] as string).length > 0
const num = (o: Obj, k: string) => typeof o[k] === 'number' && Number.isFinite(o[k])
const numOrNull = (o: Obj, k: string) => o[k] === null || num(o, k)

const GROUPS = new Set<string>(MUSCLE_GROUPS.map((g) => g.id))

/** 表ごとの「最低限揃っていてほしい項目」 */
const CHECKS: Record<keyof BackupData, { label: string; ok: (o: Obj) => boolean }> = {
  exercises: { label: '種目', ok: (o) => str(o, 'name') && GROUPS.has(o.muscleGroup as string) },
  templates: { label: 'メニュー', ok: (o) => typeof o.name === 'string' && Array.isArray(o.items) },
  sessions: { label: 'トレーニング', ok: (o) => num(o, 'startedAt') && (o.status === 'done' || o.status === 'active') },
  workoutExercises: { label: 'トレーニングの種目', ok: (o) => str(o, 'sessionId') && str(o, 'exerciseId') && num(o, 'order') },
  sets: {
    label: 'セット',
    ok: (o) => str(o, 'workoutExerciseId') && str(o, 'sessionId') && numOrNull(o, 'weightKg') && numOrNull(o, 'reps'),
  },
  records: { label: '自己ベスト', ok: (o) => str(o, 'exerciseId') && str(o, 'sessionId') && num(o, 'value') },
  settings: { label: '設定', ok: (o) => o.id === 'me' },
}

export const TABLES = Object.keys(CHECKS) as (keyof BackupData)[]

export function makeBackup(data: BackupData, now = Date.now()): BackupFile {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now, data }
}

/** ファイル名：kintore-memo-backup-2026-10-21.json */
export function backupFileName(now = Date.now()): string {
  const d = new Date(now)
  const p = (n: number) => String(n).padStart(2, '0')
  return `kintore-memo-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}

/** 読み込んだ文字を確かめる。だめなら、どこがだめかを日本語で返す */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON として読めませんでした。書き出したファイルをそのまま選んでください' }
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, error: '筋トレメモのバックアップファイルではありません' }
  if (!num(raw, 'format') || (raw.format as number) > BACKUP_FORMAT) {
    return { ok: false, error: 'このファイルは新しい版のアプリで作られています。アプリを最新にしてから読み込んでください' }
  }
  if (!isObj(raw.data)) return { ok: false, error: 'ファイルの中身がありません' }

  const data = {} as Record<keyof BackupData, unknown[]>
  for (const table of TABLES) {
    const list = raw.data[table] ?? []
    if (!Array.isArray(list)) return { ok: false, error: `「${CHECKS[table].label}」の形が違います` }
    const ids = new Set<string>()
    for (const [i, item] of list.entries()) {
      if (!isObj(item) || !str(item, 'id') || !CHECKS[table].ok(item)) {
        return { ok: false, error: `「${CHECKS[table].label}」の ${i + 1} 件目が読めません` }
      }
      if (ids.has(item.id as string)) return { ok: false, error: `「${CHECKS[table].label}」に同じ id が2つあります` }
      ids.add(item.id as string)
    }
    data[table] = list
  }

  // つながりの確認：セットや種目が、ない回・ない種目を指していないか
  const sessionIds = new Set((data.sessions as Obj[]).map((s) => s.id))
  const exerciseIds = new Set((data.exercises as Obj[]).map((e) => e.id))
  const weIds = new Set((data.workoutExercises as Obj[]).map((w) => w.id))
  if ((data.workoutExercises as Obj[]).some((w) => !sessionIds.has(w.sessionId) || !exerciseIds.has(w.exerciseId))) {
    return { ok: false, error: '「トレーニングの種目」に、ないトレーニングか種目を指すものがあります' }
  }
  if ((data.sets as Obj[]).some((s) => !weIds.has(s.workoutExerciseId) || !sessionIds.has(s.sessionId))) {
    return { ok: false, error: '「セット」に、ないトレーニングを指すものがあります' }
  }
  if ((data.sessions as Obj[]).filter((s) => s.status === 'active').length > 1) {
    return { ok: false, error: 'トレーニング中のものが2つ以上あります' }
  }

  return { ok: true, file: { app: BACKUP_APP, format: raw.format as number, exportedAt: num(raw, 'exportedAt') ? (raw.exportedAt as number) : 0, data: data as unknown as BackupData } }
}
