import { compareWithPrevious, exerciseStats, mergeStats, rirSummary } from '../lib/calc'
import type { Change, ExerciseStats } from '../lib/calc'
import { db } from './db'
import type { MuscleGroup } from './muscleGroups'
import type { PersonalRecord, RecordType, WorkoutSession, WorkoutSet } from './types'
import { finishSession } from './workout'

/*
  1回のトレーニングのまとめ（振り返り画面・終了画面・あとで履歴でも使う）
  ・同じ種目を2回入れていたら、1つにまとめる
  ・前回：この回より前に終えたトレーニングのうち、同じ種目をやったいちばん新しい回
  ・自己ベスト：この回より前の「すべての」記録と比べて上回ったもの
      - はじめてやった種目は、比べる相手がないので「更新」には数えない
*/

export type ExerciseResult = {
  exerciseId: string
  name: string
  group: MuscleGroup
  bodyweight: boolean
  stats: ExerciseStats
  prev: ExerciseStats | null
  prevDate: number | null
  change: Change | null
  /** この回で更新した自己ベストの種類 */
  records: RecordType[]
  /** はじめてやった種目か */
  isFirst: boolean
}

export type SessionSummary = {
  session: WorkoutSession
  durationMs: number
  exercises: ExerciseResult[]
  totals: { exercises: number; sets: number; reps: number; volume: number }
  groups: MuscleGroup[]
  rir: ReturnType<typeof rirSummary>
  /** 自己ベストを更新した数（種類ごとに数える） */
  recordCount: number
}

/** ある種目の、この回より前に終えたトレーニングごとの数字（新しい順） */
async function historyOf(exerciseId: string, bodyweight: boolean, before: number, exceptSessionId: string) {
  const items = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray()
  const bySession = new Map<string, { startedAt: number; stats: ExerciseStats }>()
  for (const we of items) {
    if (we.sessionId === exceptSessionId) continue
    const session = await db.sessions.get(we.sessionId)
    if (!session || session.status !== 'done' || session.startedAt >= before) continue
    const sets = await db.sets.where('workoutExerciseId').equals(we.id).toArray()
    const stats = exerciseStats(sets, bodyweight)
    if (stats.sets === 0) continue
    const prev = bySession.get(session.id)
    bySession.set(session.id, { startedAt: session.startedAt, stats: prev ? mergeStats(prev.stats, stats) : stats })
  }
  return [...bySession.values()].sort((a, b) => b.startedAt - a.startedAt)
}

export async function getSessionSummary(sessionId: string, now = Date.now()): Promise<SessionSummary | null> {
  const session = await db.sessions.get(sessionId)
  if (!session) return null
  const items = await db.workoutExercises.where('sessionId').equals(sessionId).sortBy('order')

  // 種目ごとにセットを集める（同じ種目は1つに）
  const order: string[] = []
  const setsBy = new Map<string, WorkoutSet[]>()
  for (const we of items) {
    if (!setsBy.has(we.exerciseId)) {
      order.push(we.exerciseId)
      setsBy.set(we.exerciseId, [])
    }
    setsBy.get(we.exerciseId)!.push(...(await db.sets.where('workoutExerciseId').equals(we.id).toArray()))
  }

  const exercises: ExerciseResult[] = []
  const allSets: WorkoutSet[] = []
  for (const exerciseId of order) {
    const exercise = await db.exercises.get(exerciseId)
    if (!exercise) continue
    const sets = setsBy.get(exerciseId)!
    const stats = exerciseStats(sets, exercise.isBodyweight)
    if (stats.sets === 0) continue
    allSets.push(...sets)

    const history = await historyOf(exerciseId, exercise.isBodyweight, session.startedAt, sessionId)
    const prev = history[0] ?? null
    const best = history.reduce(
      (acc, h) => ({
        topWeight: Math.max(acc.topWeight, h.stats.topWeight ?? -Infinity),
        bestE1rm: Math.max(acc.bestE1rm, h.stats.bestE1rm ?? -Infinity),
        volume: Math.max(acc.volume, h.stats.volume || -Infinity),
      }),
      { topWeight: -Infinity, bestE1rm: -Infinity, volume: -Infinity },
    )
    const records: RecordType[] = []
    if (history.length > 0 && !exercise.isBodyweight) {
      if (stats.topWeight !== null && stats.topWeight > best.topWeight) records.push('maxWeight')
      if (stats.bestE1rm !== null && stats.bestE1rm > best.bestE1rm) records.push('e1rm')
      if (stats.volume > 0 && stats.volume > best.volume) records.push('maxVolume')
    }

    exercises.push({
      exerciseId,
      name: exercise.name,
      group: exercise.muscleGroup,
      bodyweight: exercise.isBodyweight,
      stats,
      prev: prev?.stats ?? null,
      prevDate: prev?.startedAt ?? null,
      change: compareWithPrevious(stats, prev?.stats ?? null, exercise.isBodyweight),
      records,
      isFirst: history.length === 0,
    })
  }

  const totals = exercises.reduce(
    (t, e) => ({
      exercises: t.exercises + 1,
      sets: t.sets + e.stats.sets,
      reps: t.reps + e.stats.reps,
      volume: Math.round((t.volume + e.stats.volume) * 10) / 10,
    }),
    { exercises: 0, sets: 0, reps: 0, volume: 0 },
  )
  const groups = [...new Set(exercises.map((e) => e.group))]

  return {
    session,
    durationMs: (session.endedAt ?? now) - session.startedAt,
    exercises,
    totals,
    groups,
    rir: rirSummary(allSets),
    recordCount: exercises.reduce((n, e) => n + e.records.length, 0),
  }
}

/** 自己ベストを保存する（何度呼んでも同じ結果になるよう、この回の分を消してから入れ直す） */
async function saveRecords(summary: SessionSummary) {
  const sessionId = summary.session.id
  const rows: PersonalRecord[] = []
  for (const e of summary.exercises) {
    for (const type of e.records) {
      const value = type === 'maxWeight' ? e.stats.topWeight : type === 'e1rm' ? e.stats.bestE1rm : e.stats.volume
      if (value === null) continue
      rows.push({
        id: crypto.randomUUID(),
        exerciseId: e.exerciseId,
        type,
        value,
        sessionId,
        setId: null,
        achievedAt: summary.session.startedAt,
      })
    }
  }
  await db.transaction('rw', db.records, async () => {
    await db.records.where('sessionId').equals(sessionId).delete()
    if (rows.length) await db.records.bulkAdd(rows)
  })
}

/** 振り返りを保存して終える：未完了のセットを消す → きつさ・メモを保存 → 自己ベストを保存 */
export async function finishWithReview(sessionId: string, effort: number | null, note: string | null): Promise<void> {
  await finishSession(sessionId)
  await db.sessions.update(sessionId, { effort, note: note?.trim() ? note.trim() : null })
  const summary = await getSessionSummary(sessionId)
  if (summary) await saveRecords(summary)
}
