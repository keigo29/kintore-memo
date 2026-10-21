import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Dumbbell, Plus } from 'lucide-react'
import { useState } from 'react'
import { Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { RestTimer } from '../components/RestTimer'
import { ExercisePickerDialog } from '../components/ExercisePickerDialog'
import { db } from '../data/db'
import { groupColor } from '../data/muscleGroups'
import { addExerciseToSession, discardSession, finishSession, getSessionExercises, getSets } from '../data/workout'
import { formatDuration, formatKg } from '../lib/format'
import { restTimer } from '../lib/restTimer'
import { useNow } from '../lib/useNow'
import { ExerciseRecord } from './ExerciseRecord'

/*
  トレーニング中の画面
  ・下のタブは出さない（記録中にまちがえて別の画面へ行かないように）
  ・種目を押すと、その種目の記録画面へ
*/
type Props = {
  sessionId: string
  onExit: (message: string) => void
}

export function WorkoutScreen({ sessionId, onExit }: Props) {
  const now = useNow()
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(sessionId)
    const items = await getSessionExercises(sessionId)
    const rows = await Promise.all(
      items.map(async (we) => {
        const exercise = await db.exercises.get(we.exerciseId)
        const sets = await getSets(we.id)
        return { we, exercise, done: sets.filter((s) => s.completedAt !== null) }
      }),
    )
    return { session, rows }
  }, [sessionId])

  if (!data?.session) return null
  const { session, rows } = data
  const doneSets = rows.reduce((n, r) => n + r.done.length, 0)

  // 記録画面を開いているとき
  if (openId) {
    const ids = rows.map((r) => r.we.id)
    return (
      <ExerciseRecord
        key={openId}
        workoutExerciseId={openId}
        order={ids}
        onOpen={setOpenId}
        onBack={() => setOpenId(null)}
      />
    )
  }

  return (
    <section className="screen workout">
      <header className="screen-head">
        <div className="workout-clock">
          <span className="workout-label">トレーニング中</span>
          <span className="workout-time num">{formatDuration(now - session.startedAt)}</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setFinishing(true)}>
          終える
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Dumbbell}
            text="種目を追加してはじめましょう"
            action={
              <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
                <Plus strokeWidth={2} aria-hidden />
                種目を追加
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="row-between">
            <h2 className="section-title">種目</h2>
            <span className="list-count num">完了 {doneSets}セット</span>
          </div>
          <ul className="card list">
            {rows.map(({ we, exercise, done }) => {
              const last = done[done.length - 1]
              return (
                <li key={we.id} style={exercise ? groupColor(exercise.muscleGroup) : undefined}>
                  <button type="button" className="list-row list-row-btn workout-row" onClick={() => setOpenId(we.id)}>
                    <span className="dot" aria-hidden />
                    <span className="workout-row-text">
                      <span className="list-name">{exercise?.name ?? '（消えた種目）'}</span>
                      <span className="list-sub num">
                        {done.length === 0
                          ? 'まだ記録していません'
                          : `${done.length}セット　最後 ${exercise?.isBodyweight ? '' : `${formatKg(last.weightKg)}kg × `}${last.reps ?? '—'}回`}
                      </span>
                    </span>
                    {done.length > 0 && <span className="tag tag-ok num">{done.length}</span>}
                    <ChevronRight className="chev" strokeWidth={2} aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" className="btn btn-block" onClick={() => setPicking(true)}>
            <Plus strokeWidth={2} aria-hidden />
            種目を追加
          </button>
        </>
      )}

      {/* 種目の一覧の画面でも、休憩タイマーを下に出す */}
      <div className="action-bar">
        <RestTimer />
      </div>

      {picking && (
        <ExercisePickerDialog
          addedIds={rows.map((r) => r.we.exerciseId)}
          onClose={() => setPicking(false)}
          onPick={async (exerciseId) => {
            const id = await addExerciseToSession(sessionId, exerciseId)
            setPicking(false)
            setOpenId(id)
          }}
        />
      )}

      {finishing && (
        <Dialog
          title="トレーニングを終えますか？"
          onClose={() => setFinishing(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await discardSession(sessionId)
                  restTimer.reset()
                  onExit('記録せずに終えました')
                }}
              >
                記録せずに終える
              </button>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setFinishing(false)}>
                続ける
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={doneSets === 0}
                onClick={async () => {
                  await finishSession(sessionId)
                  restTimer.reset()
                  onExit('おつかれさまでした。記録を保存しました')
                }}
              >
                終える
              </button>
            </>
          }
        >
          <p className="field-help">
            {doneSets === 0
              ? '完了したセットがまだありません。セットを完了するか、「記録せずに終える」を選んでください。'
              : `完了した ${doneSets} セットを記録します。完了していないセットは記録に残りません。`}
          </p>
        </Dialog>
      )}
    </section>
  )
}
