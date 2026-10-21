import { db } from './db'
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from './types'

/*
  トレーニングのデータ操作
  ・入力するたびにすぐ保存する（アプリを閉じても、続きから再開できる）
  ・トレーニング中のものは status: 'active'。1つだけ
*/

/** トレーニング中のもの（なければ undefined） */
export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  return db.sessions.where('status').equals('active').first()
}

/** いちばん最近に終えたトレーニング */
export async function getLastDoneSession(): Promise<WorkoutSession | undefined> {
  const list = await db.sessions.orderBy('startedAt').reverse().toArray()
  return list.find((s) => s.status === 'done')
}

/** 新しいトレーニングを始めるときの中身：種目と、用意するセット数 */
export type StartItem = { exerciseId: string; sets: number }

/**
 * 新しいトレーニングを始める
 * ・copyFrom：その回と同じ種目を、同じセット数で用意する（前回と同じ・履歴から複製）
 * ・items / templateId：メニューからはじめるとき
 */
export async function startSession(copyFrom?: string, items?: StartItem[], templateId: string | null = null): Promise<string> {
  const id = crypto.randomUUID()
  await db.transaction('rw', db.sessions, db.workoutExercises, db.sets, async () => {
    await db.sessions.add({
      id,
      startedAt: Date.now(),
      endedAt: null,
      templateId,
      status: 'active',
      effort: null,
      note: null,
    })
    let list = items ?? []
    if (copyFrom) {
      const src = await db.workoutExercises.where('sessionId').equals(copyFrom).sortBy('order')
      list = []
      for (const we of src) {
        const n = await db.sets
          .where('workoutExerciseId')
          .equals(we.id)
          .filter((s) => s.completedAt !== null && s.kind === 'normal')
          .count()
        list.push({ exerciseId: we.exerciseId, sets: Math.max(1, n) })
      }
    }
    for (const item of list) await addExerciseToSession(id, item.exerciseId, item.sets)
  })
  return id
}

/** そのトレーニングの種目（並び順） */
export async function getSessionExercises(sessionId: string): Promise<WorkoutExercise[]> {
  return db.workoutExercises.where('sessionId').equals(sessionId).sortBy('order')
}

/** そのトレーニングの種目のセット（並び順） */
export async function getSets(workoutExerciseId: string): Promise<WorkoutSet[]> {
  return db.sets.where('workoutExerciseId').equals(workoutExerciseId).sortBy('order')
}

/** 前回の記録：この種目をやった、いちばん新しい「終えた」トレーニングの完了セット */
export type PreviousRecord = { startedAt: number; sets: WorkoutSet[] }

export async function getPrevious(exerciseId: string, exceptSessionId: string): Promise<PreviousRecord | null> {
  const items = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray()
  let best: { we: WorkoutExercise; session: WorkoutSession } | null = null
  for (const we of items) {
    if (we.sessionId === exceptSessionId) continue
    const session = await db.sessions.get(we.sessionId)
    if (!session || session.status !== 'done') continue
    if (!best || session.startedAt > best.session.startedAt) best = { we, session }
  }
  if (!best) return null
  const sets = (await getSets(best.we.id)).filter((s) => s.completedAt !== null)
  return sets.length ? { startedAt: best.session.startedAt, sets } : null
}

/**
 * 種目を加える。setCount の数だけセットを用意する（完了はしていない状態）
 * 値は前回の同じ番号の本番セットから入れる（なければ前回の最後のセット）
 */
export async function addExerciseToSession(sessionId: string, exerciseId: string, setCount = 1): Promise<string> {
  const id = crypto.randomUUID()
  const count = await db.workoutExercises.where('sessionId').equals(sessionId).count()
  await db.workoutExercises.add({ id, sessionId, exerciseId, order: count, note: null })
  const prev = await getPrevious(exerciseId, sessionId)
  const normals = prev?.sets.filter((s) => s.kind === 'normal') ?? []
  for (let i = 0; i < Math.max(1, setCount); i++) {
    const from = normals[i] ?? normals[normals.length - 1] ?? prev?.sets[0]
    await db.sets.add(newSet(id, sessionId, i, from))
  }
  return id
}

/** 種目を外す（その種目のセットも消す） */
export async function removeExerciseFromSession(workoutExerciseId: string): Promise<void> {
  await db.transaction('rw', db.workoutExercises, db.sets, async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) return
    await db.sets.where('workoutExerciseId').equals(workoutExerciseId).delete()
    await db.workoutExercises.delete(workoutExerciseId)
    // 後ろの種目の並び順をつめる
    const rest = await getSessionExercises(we.sessionId)
    await Promise.all(rest.map((r, i) => db.workoutExercises.update(r.id, { order: i })))
  })
}

function newSet(workoutExerciseId: string, sessionId: string, order: number, from?: WorkoutSet): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    workoutExerciseId,
    sessionId,
    order,
    kind: from?.kind ?? 'normal',
    weightKg: from?.weightKg ?? null,
    reps: from?.reps ?? null,
    assisted: false,
    rir: null,
    completedAt: null,
    note: null,
  }
}

export async function updateSet(id: string, patch: Partial<WorkoutSet>): Promise<void> {
  await db.sets.update(id, patch)
}

/**
 * セットを完了にする（次のセットは勝手に作らない。続けるかどうかは画面で選ぶ）
 */
export async function completeSet(id: string): Promise<void> {
  await db.sets.update(id, { completedAt: Date.now() })
}

/** 完了を取り消す（まちがえて押したとき用） */
export async function uncompleteSet(id: string): Promise<void> {
  await db.sets.update(id, { completedAt: null })
}

/** セットを1つ足す（最後のセットと同じ値で） */
export async function addSet(workoutExerciseId: string, sessionId: string): Promise<string> {
  const sets = await getSets(workoutExerciseId)
  const next = newSet(workoutExerciseId, sessionId, sets.length, sets[sets.length - 1])
  await db.sets.add(next)
  return next.id
}

/** セットを消して、番号をつめる */
export async function deleteSet(id: string): Promise<void> {
  await db.transaction('rw', db.sets, async () => {
    const set = await db.sets.get(id)
    if (!set) return
    await db.sets.delete(id)
    const rest = await getSets(set.workoutExerciseId)
    await Promise.all(rest.map((r, i) => db.sets.update(r.id, { order: i })))
  })
}

/** 終える：完了していないセットは記録に残さない */
export async function finishSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.workoutExercises, db.sets, async () => {
    await db.sets.where('sessionId').equals(id).filter((s) => s.completedAt === null).delete()
    // セットが1つも残らなかった種目は外す
    const items = await getSessionExercises(id)
    for (const we of items) {
      const n = await db.sets.where('workoutExerciseId').equals(we.id).count()
      if (n === 0) await db.workoutExercises.delete(we.id)
    }
    await db.sessions.update(id, { status: 'done', endedAt: Date.now() })
  })
}

/** 記録せずに終える：このトレーニングを丸ごと消す */
export async function discardSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.workoutExercises, db.sets, async () => {
    await db.sets.where('sessionId').equals(id).delete()
    await db.workoutExercises.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  })
}

/** 完了したセットがいくつあるか */
export async function countCompletedSets(sessionId: string): Promise<number> {
  return db.sets
    .where('sessionId')
    .equals(sessionId)
    .filter((s) => s.completedAt !== null)
    .count()
}
