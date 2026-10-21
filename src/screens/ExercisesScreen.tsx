import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Dumbbell, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ExerciseFormDialog } from '../components/ExerciseFormDialog'
import { MuscleIcon } from '../components/MuscleIcon'
import { db } from '../data/db'
import { normalize, setArchived } from '../data/exercises'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import type { MuscleGroup } from '../data/muscleGroups'
import type { Exercise } from '../data/types'

type Props = {
  onToast: (message: string) => void
}

// ダイアログの状態：閉じている／追加／編集
type FormState = { mode: 'closed' } | { mode: 'add' } | { mode: 'edit'; exercise: Exercise }

export function ExercisesScreen({ onToast }: Props) {
  // 選んでいる筋群（もう一度押すと解除）
  const [group, setGroup] = useState<MuscleGroup | null>(null)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  const [showHidden, setShowHidden] = useState(false)

  // 全種目を読む。中身が変わると自動で画面も変わる（useLiveQuery）。読みこみ中は undefined
  const all = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])

  const groupName = (id: MuscleGroup) => MUSCLE_GROUPS.find((g) => g.id === id)?.name ?? ''

  // 絞りこみ：筋群 → 検索の文字（ひらがなでもカタカナの種目が見つかる）
  const key = normalize(query)
  const matches = (e: Exercise) =>
    (!group || e.muscleGroup === group) && (!key || normalize(e.name).includes(key))
  const byCreated = (a: Exercise, b: Exercise) => a.createdAt - b.createdAt
  const visible = all?.filter((e) => !e.archived && matches(e)).sort(byCreated)
  const hidden = all?.filter((e) => e.archived).sort(byCreated) ?? []

  const title = query ? `「${query}」の検索結果` : group ? groupName(group) : 'すべての種目'

  return (
    <section className="screen">
      <header className="screen-head">
        <h1 className="screen-title">種目</h1>
        <button type="button" className="icon-btn" aria-label="種目を追加" onClick={() => setForm({ mode: 'add' })}>
          <Plus strokeWidth={2} />
        </button>
      </header>

      <div className="mg-grid" role="group" aria-label="筋群で絞りこむ">
        {MUSCLE_GROUPS.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            className="mg-item"
            style={groupColor(id)}
            aria-pressed={group === id}
            onClick={() => setGroup(group === id ? null : id)}
          >
            <span className="mg-box">
              <MuscleIcon group={id} className="mg-svg" />
            </span>
            <span className="mg-name">{name}</span>
          </button>
        ))}
      </div>

      <label className="search">
        <Search strokeWidth={2} aria-hidden />
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="種目をさがす"
          aria-label="種目をさがす"
        />
      </label>

      <div>
        <div className="row-between">
          <h2 className="section-title">{title}</h2>
          {visible && <span className="list-count num">{visible.length}種目</span>}
        </div>

        {visible === undefined ? null : visible.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Dumbbell}
              text={query ? '見つかりませんでした' : 'この筋群の種目はまだありません'}
              action={
                <button type="button" className="btn btn-primary" onClick={() => setForm({ mode: 'add' })}>
                  <Plus strokeWidth={2} aria-hidden />
                  種目を追加
                </button>
              }
            />
          </div>
        ) : (
          <ul className="card list">
            {visible.map((e) => (
              <li key={e.id} style={groupColor(e.muscleGroup)}>
                <button type="button" className="list-row list-row-btn" onClick={() => setForm({ mode: 'edit', exercise: e })}>
                  <span className="dot" aria-hidden />
                  <span className="list-name">{e.name}</span>
                  {e.isBodyweight && <span className="tag">自重</span>}
                  {!group && <span className="list-sub">{groupName(e.muscleGroup)}</span>}
                  <ChevronRight className="chev" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 隠した種目：あるときだけ出す */}
      {hidden.length > 0 && (
        <div>
          <button type="button" className="link-btn" onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? '隠した種目を閉じる' : `隠した種目を見る（${hidden.length}）`}
          </button>
          {showHidden && (
            <ul className="card list">
              {hidden.map((e) => (
                <li key={e.id} className="list-row" style={groupColor(e.muscleGroup)}>
                  <span className="dot" aria-hidden />
                  <span className="list-name">{e.name}</span>
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      await setArchived(e.id, false)
                      onToast(`「${e.name}」を一覧に戻しました`)
                    }}
                  >
                    戻す
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {form.mode !== 'closed' && (
        <ExerciseFormDialog
          exercise={form.mode === 'edit' ? form.exercise : undefined}
          defaultGroup={group ?? undefined}
          onClose={() => setForm({ mode: 'closed' })}
          onDone={(message) => {
            setForm({ mode: 'closed' })
            onToast(message)
          }}
        />
      )}
    </section>
  )
}
