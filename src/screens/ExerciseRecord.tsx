import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, ChevronRight, History, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { NumberStepper } from '../components/NumberStepper'
import { Switch } from '../components/Switch'
import { DEFAULT_SETTINGS, db } from '../data/db'
import { groupColor } from '../data/muscleGroups'
import type { Rir, WorkoutSet } from '../data/types'
import {
  addSet,
  completeSet,
  deleteSet,
  getPrevious,
  getSets,
  removeExerciseFromSession,
  uncompleteSet,
  updateSet,
} from '../data/workout'
import { formatKg, formatShortDate } from '../lib/format'

/*
  1つの種目の記録画面
  ・上：前回の記録（これを見ながら入れる）
  ・まんなか：セットの一覧。押すとそのセットを直せる
  ・下：いま入力中のセット（大きな±）と「セット完了」
  ・入力はすぐ保存（メモだけは、手を止めたときと欄を離れたときに保存）
  ・「セット完了」のあとは、次のセットを勝手に作らない。
    ボタンが「種目を終える」と「次のセット」に変わり、自分で選ぶ
*/
type Props = {
  workoutExerciseId: string
  /** トレーニング中の種目の並び（前後の種目へ移るため） */
  order: string[]
  onOpen: (workoutExerciseId: string) => void
  onBack: () => void
}

const RIR_CHOICES: Rir[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'unknown']

export function ExerciseRecord({ workoutExerciseId, order, onOpen, onBack }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)

  const data = useLiveQuery(async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) return null
    const [exercise, sets, previous, settings] = await Promise.all([
      db.exercises.get(we.exerciseId),
      getSets(we.id),
      getPrevious(we.exerciseId, we.sessionId),
      db.settings.get('me'),
    ])
    return { we, exercise, sets, previous, step: (settings ?? DEFAULT_SETTINGS).weightStepKg }
  }, [workoutExerciseId])

  if (!data || !data.exercise) return null
  const { we, exercise, sets, previous, step } = data
  const bodyweight = exercise.isBodyweight

  // いま入力中のセット：選んだもの → まだ完了していない最初のセット → 最後のセット
  const active: WorkoutSet | undefined =
    sets.find((s) => s.id === activeId) ?? sets.find((s) => s.completedAt === null) ?? sets[sets.length - 1]

  // セットの番号：ウォームアップは「W」、本番は 1, 2, 3…
  let n = 0
  const labels = new Map(sets.map((s) => [s.id, s.kind === 'warmup' ? 'W' : String(++n)]))

  // 前回の、同じ番号の本番セット（なければ最後のセット）
  const prevFor = (set: WorkoutSet) => {
    if (!previous) return undefined
    const normals = previous.sets.filter((s) => s.kind === 'normal')
    const idx = sets.filter((s) => s.kind === 'normal' && s.order < set.order).length
    return set.kind === 'warmup'
      ? previous.sets.find((s) => s.kind === 'warmup')
      : (normals[idx] ?? normals[normals.length - 1] ?? previous.sets[previous.sets.length - 1])
  }
  const prevSet = active ? prevFor(active) : undefined

  const pos = order.indexOf(workoutExerciseId)
  const prevId = pos > 0 ? order[pos - 1] : null
  const nextId = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : null

  const flash = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage((m) => (m === text ? null : m)), 2000)
  }

  const onComplete = async () => {
    if (!active) return
    if (active.reps === null || (!bodyweight && active.weightKg === null)) {
      flash(bodyweight ? '回数を入れてください' : '重量と回数を入れてください')
      return
    }
    const label = labels.get(active.id)
    await completeSet(active.id)
    navigator.vibrate?.(15)
    // 完了したセットを選んだままにする（次のセットはまだ作らない）
    setActiveId(active.id)
    flash(label === 'W' ? 'ウォームアップを記録しました' : `${label}セット目を記録しました`)
  }

  // 次のセット：まだ完了していないセットがあればそこへ、なければ同じ重量・回数で1つ足す
  const onNextSet = async () => {
    const open = sets.find((s) => s.completedAt === null)
    setActiveId(open ? open.id : await addSet(we.id, we.sessionId))
    setShowNote(false)
    setMessage(null)
  }

  // 種目を終える：次の種目があればそこへ、なければ種目の一覧へ
  const onFinishExercise = () => {
    if (nextId) onOpen(nextId)
    else onBack()
  }

  return (
    <section className="screen record">
      <header className="screen-head record-head">
        <button type="button" className="icon-btn" aria-label="種目の一覧へもどる" onClick={onBack}>
          <ChevronLeft strokeWidth={2} />
        </button>
        <div className="record-title" style={groupColor(exercise.muscleGroup)}>
          <span className="dot" aria-hidden />
          <h1 className="screen-title">{exercise.name}</h1>
        </div>
        <button type="button" className="icon-btn" aria-label="この種目を外す" onClick={() => setRemoving(true)}>
          <Trash2 strokeWidth={2} />
        </button>
      </header>

      {order.length > 1 && (
        <nav className="record-nav" aria-label="前後の種目">
          <button type="button" className="btn" disabled={!prevId} onClick={() => prevId && onOpen(prevId)}>
            <ChevronLeft strokeWidth={2} aria-hidden />
            前の種目
          </button>
          <span className="num record-pos">
            {pos + 1} / {order.length}
          </span>
          <button type="button" className="btn" disabled={!nextId} onClick={() => nextId && onOpen(nextId)}>
            次の種目
            <ChevronRight strokeWidth={2} aria-hidden />
          </button>
        </nav>
      )}

      {/* 前回の記録 */}
      <div className="card prev-card">
        <div className="row-between">
          <span className="prev-title">
            <History strokeWidth={2} aria-hidden />
            前回
          </span>
          {previous && <span className="list-count num">{formatShortDate(previous.startedAt)}</span>}
        </div>
        {previous ? (
          <ul className="prev-chips">
            {previous.sets.map((s) => (
              <li key={s.id} className="prev-chip num">
                {s.kind === 'warmup' && <span className="prev-w">W</span>}
                {bodyweight ? `${s.reps ?? '—'}回` : `${formatKg(s.weightKg)}×${s.reps ?? '—'}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-help">前回の記録はありません。今日がはじめての記録です</p>
        )}
      </div>

      {/* セットの一覧 */}
      <ol className="card set-list">
        {sets.map((s) => {
          const done = s.completedAt !== null
          return (
            <li key={s.id}>
              <button
                type="button"
                className="set-row"
                aria-current={s.id === active?.id ? 'true' : undefined}
                onClick={() => {
                  setActiveId(s.id)
                  setShowNote(Boolean(s.note))
                }}
              >
                <span className="set-no num">{labels.get(s.id)}</span>
                <span className="set-main num">
                  {bodyweight ? '' : `${formatKg(s.weightKg)} kg × `}
                  {s.reps ?? '—'} 回
                </span>
                <span className="set-meta">
                  {s.assisted && <span className="tag">補助</span>}
                  {s.rir !== null && <span className="tag num">{s.rir === 'unknown' ? 'あと?' : `あと${s.rir}`}</span>}
                </span>
                <span className={done ? 'set-check is-done' : 'set-check'} aria-label={done ? '完了' : 'まだ'}>
                  {done && <Check strokeWidth={3} aria-hidden />}
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <button type="button" className="set-add" onClick={async () => setActiveId(await addSet(we.id, we.sessionId))}>
            <Plus strokeWidth={2} aria-hidden />
            セットを追加
          </button>
        </li>
      </ol>

      {/* いま入力中のセット */}
      {active && (
        <div className="card editor">
          <div className="row-between">
            <span className="editor-title num">
              {labels.get(active.id) === 'W' ? 'ウォームアップ' : `${labels.get(active.id)}セット目`}
              {active.completedAt !== null && <span className="tag tag-ok">完了</span>}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!prevSet}
              onClick={() =>
                prevSet && updateSet(active.id, { weightKg: prevSet.weightKg, reps: prevSet.reps })
              }
            >
              前回と同じ
            </button>
          </div>

          {!bodyweight && (
            <NumberStepper
              label="重量"
              value={active.weightKg}
              onChange={(v) => updateSet(active.id, { weightKg: v })}
              step={step}
              unit="kg"
              decimal
              max={1000}
            />
          )}
          <NumberStepper
            label="回数"
            value={active.reps}
            onChange={(v) => updateSet(active.id, { reps: v })}
            step={1}
            unit="回"
            max={999}
          />

          <div className="field">
            <span className="field-label">あと何回できた？</span>
            <div className="rir-row" role="radiogroup" aria-label="あと何回できた">
              {RIR_CHOICES.map((r) => (
                <button
                  key={String(r)}
                  type="button"
                  role="radio"
                  aria-checked={active.rir === r}
                  className={r === 'unknown' ? 'rir rir-wide' : 'rir num'}
                  // もう一度押すと「入れていない」に戻る
                  onClick={() => updateSet(active.id, { rir: active.rir === r ? null : r })}
                >
                  {r === 'unknown' ? '分からない' : r}
                </button>
              ))}
            </div>
          </div>

          <div className="editor-toggles">
            <label className="toggle-line">
              <span>補助あり</span>
              <Switch checked={active.assisted} onChange={(v) => updateSet(active.id, { assisted: v })} label="補助あり" />
            </label>
            <label className="toggle-line">
              <span>ウォームアップ</span>
              <Switch
                checked={active.kind === 'warmup'}
                onChange={(v) => updateSet(active.id, { kind: v ? 'warmup' : 'normal' })}
                label="ウォームアップ"
              />
            </label>
          </div>

          {showNote || active.note ? (
            // key をセットごとに変えて、セットを切りかえたら入力欄も作り直す
            <NoteInput key={active.id} value={active.note} onSave={(note) => updateSet(active.id, { note })} />
          ) : (
            <button type="button" className="link-btn" onClick={() => setShowNote(true)}>
              メモを足す
            </button>
          )}

          {active.completedAt !== null && (
            <button type="button" className="link-btn" onClick={() => uncompleteSet(active.id)}>
              完了を取り消す
            </button>
          )}

          {sets.length > 1 && (
            <button
              type="button"
              className="link-btn link-danger"
              onClick={async () => {
                await deleteSet(active.id)
                setActiveId(null)
              }}
            >
              このセットを消す
            </button>
          )}
        </div>
      )}

      {/* 下に固定：セット完了 */}
      <div className="action-bar">
        {message && (
          <div className="action-message" role="status">
            {message}
          </div>
        )}
        {active && active.completedAt === null ? (
          <button type="button" className="btn btn-primary btn-xl btn-block" onClick={onComplete}>
            <Check strokeWidth={2.6} aria-hidden />
            {labels.get(active.id) === 'W' ? 'ウォームアップ完了' : `${labels.get(active.id)}セット目を完了`}
          </button>
        ) : (
          // 完了したあと：止めるか続けるかを選ぶ
          <div className="action-pair">
            <button type="button" className="btn btn-xl" onClick={onFinishExercise}>
              {nextId ? '次の種目へ' : '種目を終える'}
            </button>
            <button type="button" className="btn btn-primary btn-xl" onClick={onNextSet}>
              <Plus strokeWidth={2.6} aria-hidden />
              次のセット
            </button>
          </div>
        )}
      </div>

      {removing && (
        <Dialog
          title="この種目を外しますか？"
          onClose={() => setRemoving(false)}
          footer={
            <>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setRemoving(false)}>
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await removeExerciseFromSession(we.id)
                  onBack()
                }}
              >
                外す
              </button>
            </>
          }
        >
          <p className="field-help">
            「{exercise.name}」と、今日記録したこの種目のセットが消えます。種目の一覧からは消えません。
          </p>
        </Dialog>
      )}
    </section>
  )
}

/*
  メモの入力欄
  ・入力中は画面の中だけで持つ（1文字ごとに保存して読み直すと、日本語の変換が壊れるため）
  ・手を止めて 0.6 秒たったとき、入力欄を離れたとき、画面を閉じるときに保存する
  ・日本語の変換中は保存しない
*/
function NoteInput({ value, onSave }: { value: string | null; onSave: (note: string | null) => void }) {
  const [text, setText] = useState(value ?? '')
  const composing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ text, saved: value ?? '', onSave })
  latest.current.text = text
  latest.current.onSave = onSave

  const save = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const { text: t, saved, onSave: fn } = latest.current
    if (t === saved) return
    latest.current.saved = t
    fn(t.trim() === '' ? null : t)
  }

  const saveLater = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, 600)
  }

  // 画面を閉じるとき（別のセット・種目へ移るとき）も、入れた分を保存する
  useEffect(() => () => save(), [])

  return (
    <input
      className="input"
      value={text}
      placeholder="このセットのメモ"
      maxLength={100}
      enterKeyHint="done"
      onChange={(e) => {
        setText(e.target.value)
        if (!composing.current) saveLater()
      }}
      onCompositionStart={() => {
        composing.current = true
      }}
      onCompositionEnd={() => {
        composing.current = false
        saveLater()
      }}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur()
      }}
    />
  )
}
