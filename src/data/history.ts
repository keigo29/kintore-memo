import { exerciseStats } from '../lib/calc'
import { db } from './db'
import type { MuscleGroup } from './muscleGroups'
import { rebuildAllRecords } from './summary'

/*
  履歴
  ・一覧に出すのは「終えた」トレーニングだけ（トレーニング中のものは出さない）
  ・回数は「トレーニングした回数」（同じ日に2回やれば2回）
*/

/** 一覧の1行ぶん */
export type SessionRow = {
  id: string
  startedAt: number
  durationMs: number
  groups: MuscleGroup[]
  names: string[]
  sets: number
  volume: number
  effort: number | null
}

export async function listSessions(): Promise<SessionRow[]> {
  const sessions = (await db.sessions.orderBy('startedAt').reverse().toArray()).filter((s) => s.status === 'done')
  const rows: SessionRow[] = []
  for (const s of sessions) {
    const items = await db.workoutExercises.where('sessionId').equals(s.id).sortBy('order')
    const groups: MuscleGroup[] = []
    const names: string[] = []
    let sets = 0
    let volume = 0
    for (const we of items) {
      const exercise = await db.exercises.get(we.exerciseId)
      const stats = exerciseStats(await db.sets.where('workoutExerciseId').equals(we.id).toArray(), exercise?.isBodyweight ?? false)
      if (stats.sets === 0) continue
      sets += stats.sets
      volume += stats.volume
      if (exercise) {
        if (!groups.includes(exercise.muscleGroup)) groups.push(exercise.muscleGroup)
        if (!names.includes(exercise.name)) names.push(exercise.name)
      }
    }
    rows.push({
      id: s.id,
      startedAt: s.startedAt,
      durationMs: (s.endedAt ?? s.startedAt) - s.startedAt,
      groups,
      names,
      sets,
      volume: Math.round(volume * 10) / 10,
      effort: s.effort,
    })
  }
  return rows
}

/** トレーニングを丸ごと消して、自己ベストを計算し直す */
export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.workoutExercises, db.sets, db.records], async () => {
    await db.sets.where('sessionId').equals(id).delete()
    await db.workoutExercises.where('sessionId').equals(id).delete()
    await db.records.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  })
  await rebuildAllRecords()
}

/** 日時を変える（掛かった時間はそのまま、終わりの時刻もいっしょにずらす） */
export async function moveSession(id: string, startedAt: number): Promise<void> {
  const s = await db.sessions.get(id)
  if (!s) return
  const diff = startedAt - s.startedAt
  await db.sessions.update(id, { startedAt, endedAt: s.endedAt === null ? null : s.endedAt + diff })
}

/** きつさ・メモを変える */
export async function updateFeel(id: string, patch: { effort?: number | null; note?: string | null }): Promise<void> {
  await db.sessions.update(id, patch)
}
