import { dayKey } from '../lib/date'
import { db } from './db'
import type { MuscleGroup } from './muscleGroups'

/*
  集計
  ・数えるのは「完了した本番セット」だけ（ウォームアップと、完了していないセットは数えない）
  ・日付はトレーニングを始めた日で数える（夜中をまたいでも同じ日にまとめる）
*/

/** 日ごと・筋群ごとのセット数：'2026-10-21' → { chest: 6, back: 4 } */
export type DailySets = Map<string, Partial<Record<MuscleGroup, number>>>

export async function getDailySets(fromMs: number, toMs: number): Promise<DailySets> {
  const result: DailySets = new Map()
  const sessions = await db.sessions.where('startedAt').between(fromMs, toMs, true, false).toArray()
  for (const session of sessions) {
    const key = dayKey(session.startedAt)
    const items = await db.workoutExercises.where('sessionId').equals(session.id).toArray()
    for (const we of items) {
      const exercise = await db.exercises.get(we.exerciseId)
      if (!exercise) continue
      const sets = await db.sets
        .where('workoutExerciseId')
        .equals(we.id)
        .filter((s) => s.completedAt !== null && s.kind === 'normal')
        .count()
      if (sets === 0) continue
      const day = result.get(key) ?? {}
      day[exercise.muscleGroup] = (day[exercise.muscleGroup] ?? 0) + sets
      result.set(key, day)
    }
  }
  return result
}

/** その日のセット数（group を渡すと、その筋群だけ） */
export function setsOnDay(daily: DailySets, key: string, group: MuscleGroup | null): number {
  const day = daily.get(key)
  if (!day) return 0
  if (group) return day[group] ?? 0
  return Object.values(day).reduce((a, b) => a + (b ?? 0), 0)
}
