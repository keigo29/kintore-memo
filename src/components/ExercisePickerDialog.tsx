import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { db } from '../data/db'
import { normalize } from '../data/exercises'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import type { MuscleGroup } from '../data/muscleGroups'
import { Dialog } from './Dialog'

/*
  トレーニング中に種目を選ぶ
  ・筋群で絞りこみ＋検索（種目の画面と同じ探し方）
  ・すでに入れた種目には「追加ずみ」の札（同じ種目を2回入れてもよい）
*/
type Props = {
  addedIds: string[]
  onPick: (exerciseId: string) => void
  onClose: () => void
}

export function ExercisePickerDialog({ addedIds, onPick, onClose }: Props) {
  const [group, setGroup] = useState<MuscleGroup | null>(null)
  const [query, setQuery] = useState('')
  const all = useLiveQuery(() => db.exercises.toArray(), [])

  const key = normalize(query)
  const list = (all ?? [])
    .filter((e) => !e.archived && (!group || e.muscleGroup === group) && (!key || normalize(e.name).includes(key)))
    .sort((a, b) => a.createdAt - b.createdAt)

  return (
    <Dialog
      title="種目を選ぶ"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            閉じる
          </button>
        </>
      }
    >
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

      <div className="choice-grid" role="group" aria-label="筋群で絞りこむ">
        {MUSCLE_GROUPS.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={group === id}
            className="choice"
            style={groupColor(id)}
            onClick={() => setGroup(group === id ? null : id)}
          >
            <span className="dot" aria-hidden />
            {name}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="field-help">見つかりませんでした。種目のタブから追加できます</p>
      ) : (
        <ul className="list picker-list">
          {list.map((e) => (
            <li key={e.id} style={groupColor(e.muscleGroup)}>
              <button type="button" className="list-row list-row-btn" onClick={() => onPick(e.id)}>
                <span className="dot" aria-hidden />
                <span className="list-name">{e.name}</span>
                {addedIds.includes(e.id) && <span className="tag tag-ok">追加ずみ</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
