import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, Copy, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { CalcHelp, ExerciseResults, GroupChips, StatGrid } from '../components/SessionReport'
import { db } from '../data/db'
import { deleteSession, moveSession, updateFeel } from '../data/history'
import { groupColor } from '../data/muscleGroups'
import { getSessionSummary, rebuildAllRecords } from '../data/summary'
import type { Exercise, WorkoutExercise, WorkoutSet } from '../data/types'
import { addSet, deleteSet, getSets, removeExerciseFromSession, updateSet } from '../data/workout'
import { formatDate, formatKg } from '../lib/format'

/*
  過去のトレーニングの詳細
  ・見る：数字のまとめ、種目ごとのセット（重量 × 回数）、きつさとメモ
  ・できること：共有画像を作る／同じ種目ではじめる／編集／削除
  ・編集を終えたら、自己ベストを全部計算し直す（後の回の「更新」も変わるため）
*/
type Props = {
  sessionId: string
  onBack: () => void
  onShare: (sessionId: string) => void
  onStartCopy: (sessionId: string) => void
  onToast: (message: string) => void
}

type Block = { we: WorkoutExercise; exercise: Exercise | undefined; sets: WorkoutSet[] }

const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function HistoryDetailScreen({ sessionId, onBack, onShare, onStartCopy, onToast }: Props) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)

  const summary = useLiveQuery(() => getSessionSummary(sessionId), [sessionId])
  const blocks = useLiveQuery(async (): Promise<Block[]> => {
    const items = await db.workoutExercises.where('sessionId').equals(sessionId).sortBy('order')
    return Promise.all(items.map(async (we) => ({ we, exercise: await db.exercises.get(we.exerciseId), sets: await getSets(we.id) })))
  }, [sessionId])

  if (summary === null) {
    // 消したあと
    return null
  }
  if (!summary || !blocks) return null
  const { session } = summary

  const finishEdit = async () => {
    setBusy(true)
    await rebuildAllRecords()
    setBusy(false)
    setEditing(false)
    onToast('保存しました')
  }

  return (
    <section className="screen review">
      <header className="screen-head record-head">
        <button type="button" className="icon-btn" aria-label="履歴にもどる" onClick={onBack} disabled={editing}>
          <ChevronLeft strokeWidth={2} />
        </button>
        <h1 className="screen-title review-title num">{formatDate(session.startedAt)}</h1>
        <span style={{ width: 34 }} />
      </header>

      {editing ? (
        <EditView sessionId={sessionId} startedAt={session.startedAt} effort={session.effort} note={session.note} blocks={blocks} />
      ) : (
        <>
          <div className="card report-card">
            <StatGrid summary={summary} />
            <GroupChips summary={summary} />
          </div>

          {summary.exercises.length > 0 && (
            <div>
              <h2 className="section-title">種目ごと</h2>
              <ExerciseResults summary={summary} />
            </div>
          )}

          <div>
            <h2 className="section-title">セットの記録</h2>
            <div className="set-blocks">
              {blocks.map((b) => (
                <SetTable key={b.we.id} block={b} />
              ))}
            </div>
          </div>

          {(session.effort !== null || session.note) && (
            <div>
              <h2 className="section-title">自分の感じ方</h2>
              <div className="card feel-card">
                {session.effort !== null && (
                  <div className="row-between">
                    <span className="field-label">きつさ</span>
                    <span className="num feel-effort">
                      {session.effort}
                      <small> / 10</small>
                    </span>
                  </div>
                )}
                {session.note && <p className="feel-note">{session.note}</p>}
              </div>
            </div>
          )}

          <div className="detail-actions">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => onShare(sessionId)}>
              <ImageIcon strokeWidth={2} aria-hidden />
              共有画像を作る
            </button>
            <div className="action-pair detail-pair">
              <button type="button" className="btn btn-lg" onClick={() => onStartCopy(sessionId)}>
                <Copy strokeWidth={2} aria-hidden />
                同じ種目ではじめる
              </button>
              <button type="button" className="btn btn-lg" onClick={() => setEditing(true)}>
                <Pencil strokeWidth={2} aria-hidden />
                編集
              </button>
            </div>
            <button type="button" className="link-btn link-danger" onClick={() => setDeleting(true)}>
              この記録を削除
            </button>
          </div>

          <CalcHelp />
        </>
      )}

      {editing && (
        <div className="action-bar">
          <button type="button" className="btn btn-primary btn-xl btn-block" onClick={finishEdit} disabled={busy}>
            <Check strokeWidth={2.6} aria-hidden />
            {busy ? '計算し直しています…' : '編集を終える'}
          </button>
        </div>
      )}

      {deleting && (
        <Dialog
          title="この記録を削除しますか？"
          onClose={() => setDeleting(false)}
          footer={
            <>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setDeleting(false)}>
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await deleteSession(sessionId)
                  onToast('記録を削除しました')
                  onBack()
                }}
              >
                削除する
              </button>
            </>
          }
        >
          <p className="field-help">
            {formatDate(session.startedAt)} のトレーニング（{summary.totals.sets}セット）が消えます。元には戻せません。自己ベストは残りの記録で計算し直します。
          </p>
        </Dialog>
      )}
    </section>
  )
}

/** 種目ごとのセットの表（見るとき） */
function SetTable({ block }: { block: Block }) {
  const { exercise, sets } = block
  const bodyweight = exercise?.isBodyweight ?? false
  const done = sets.filter((s) => s.completedAt !== null)
  let n = 0
  return (
    <div className="card set-block" style={exercise ? groupColor(exercise.muscleGroup) : undefined}>
      <div className="set-block-head">
        <span className="dot" aria-hidden />
        <span className="list-name">{exercise?.name ?? '（消えた種目）'}</span>
        <span className="list-count num">{done.filter((s) => s.kind === 'normal').length}セット</span>
      </div>
      {done.length === 0 ? (
        <p className="field-help">完了したセットはありません</p>
      ) : (
        <ol className="set-table">
          {done.map((s) => (
            <li key={s.id} className="set-tr" data-warmup={s.kind === 'warmup' || undefined}>
              <span className="set-no num">{s.kind === 'warmup' ? 'W' : ++n}</span>
              <span className="set-main num">
                {bodyweight ? '' : `${formatKg(s.weightKg)} kg × `}
                {s.reps ?? '—'} 回
              </span>
              <span className="set-meta">
                {s.assisted && <span className="tag">補助</span>}
                {s.rir !== null && <span className="tag num">{s.rir === 'unknown' ? 'あと?' : `あと${s.rir}`}</span>}
              </span>
              {s.note && <span className="set-note">{s.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** 編集：日時・セット（重量・回数・追加・削除）・種目の削除・きつさ・メモ */
function EditView({
  sessionId,
  startedAt,
  effort,
  note,
  blocks,
}: {
  sessionId: string
  startedAt: number
  effort: number | null
  note: string | null
  blocks: Block[]
}) {
  const [noteText, setNoteText] = useState(note ?? '')
  const [removing, setRemoving] = useState<Block | null>(null)

  // datetime-local 用の「2026-10-21T19:00」
  const local = (ms: number) => {
    const d = new Date(ms)
    const p = (x: number) => String(x).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  return (
    <>
      <div className="card review-feel">
        <label className="field">
          <span className="field-label">はじめた日時</span>
          <input
            className="input"
            type="datetime-local"
            value={local(startedAt)}
            max={local(Date.now())}
            onChange={(e) => {
              const ms = new Date(e.target.value).getTime()
              if (!Number.isNaN(ms) && ms <= Date.now()) void moveSession(sessionId, ms)
            }}
          />
        </label>
      </div>

      {blocks.map((b) => {
        const bodyweight = b.exercise?.isBodyweight ?? false
        const done = b.sets.filter((s) => s.completedAt !== null)
        let n = 0
        return (
          <div key={b.we.id} className="card set-block" style={b.exercise ? groupColor(b.exercise.muscleGroup) : undefined}>
            <div className="set-block-head">
              <span className="dot" aria-hidden />
              <span className="list-name">{b.exercise?.name ?? '（消えた種目）'}</span>
              <button type="button" className="icon-btn" aria-label="この種目を外す" onClick={() => setRemoving(b)}>
                <Trash2 strokeWidth={2} />
              </button>
            </div>
            <ol className="set-table">
              {done.map((s) => (
                <li key={s.id} className="set-edit">
                  <span className="set-no num">{s.kind === 'warmup' ? 'W' : ++n}</span>
                  {!bodyweight && (
                    <NumberField
                      label="重量"
                      unit="kg"
                      decimal
                      value={s.weightKg}
                      onCommit={(v) => updateSet(s.id, { weightKg: v })}
                    />
                  )}
                  <NumberField label="回数" unit="回" value={s.reps} onCommit={(v) => updateSet(s.id, { reps: v })} />
                  <button type="button" className="icon-btn" aria-label="このセットを消す" onClick={() => deleteSet(s.id)}>
                    <Trash2 strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="set-add"
              onClick={async () => {
                const id = await addSet(b.we.id, sessionId)
                await updateSet(id, { completedAt: Date.now() })
              }}
            >
              <Plus strokeWidth={2} aria-hidden />
              セットを追加
            </button>
          </div>
        )
      })}

      <div className="card review-feel">
        <div className="field">
          <span className="field-label">きつさ（1 楽 〜 10 限界）</span>
          <div className="effort-row" role="radiogroup" aria-label="きつさ">
            {EFFORTS.map((x) => (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={effort === x}
                className="effort num"
                onClick={() => updateFeel(sessionId, { effort: effort === x ? null : x })}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label">振り返りメモ</span>
          <textarea
            className="input textarea"
            value={noteText}
            maxLength={300}
            rows={3}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={() => updateFeel(sessionId, { note: noteText.trim() ? noteText.trim() : null })}
          />
        </label>
      </div>

      {removing && (
        <Dialog
          title="この種目を外しますか？"
          onClose={() => setRemoving(null)}
          footer={
            <>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setRemoving(null)}>
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await removeExerciseFromSession(removing.we.id)
                  setRemoving(null)
                }}
              >
                外す
              </button>
            </>
          }
        >
          <p className="field-help">この回の「{removing.exercise?.name}」のセットがすべて消えます。</p>
        </Dialog>
      )}
    </>
  )
}

/** 数字の入力（入力中は画面の中で持ち、欄を離れたときに保存。空にすると「入れていない」） */
function NumberField({
  label,
  unit,
  value,
  decimal = false,
  onCommit,
}: {
  label: string
  unit: string
  value: number | null
  decimal?: boolean
  onCommit: (v: number | null) => void
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => setText(value === null ? '' : String(value)), [value])
  const commit = () => {
    const cleaned = text.normalize('NFKC').replace(/[^0-9.]/g, '')
    if (cleaned === '') return onCommit(null)
    const n = decimal ? parseFloat(cleaned) : parseInt(cleaned, 10)
    if (!Number.isNaN(n)) onCommit(Math.min(decimal ? 1000 : 999, Math.max(0, Math.round(n * 100) / 100)))
  }
  return (
    <label className="num-field">
      <input
        className="input num"
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={text}
        placeholder="—"
        aria-label={label}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <span className="stepper-unit">{unit}</span>
    </label>
  )
}
