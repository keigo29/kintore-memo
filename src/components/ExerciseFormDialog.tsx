import { useState } from 'react'
import { addExercise, findSameName, setArchived, updateExercise } from '../data/exercises'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import type { MuscleGroup } from '../data/muscleGroups'
import type { Exercise } from '../data/types'
import { Dialog } from './Dialog'
import { Switch } from './Switch'

/*
  種目の追加・編集
  ・exercise がなければ「追加」、あれば「編集」
  ・名前が空、または同じ名前がすでにあるときは保存しない
*/
type Props = {
  exercise?: Exercise
  /** 追加のとき、最初に選んでおく筋群（絞り込み中の筋群など） */
  defaultGroup?: MuscleGroup
  onClose: () => void
  onDone: (message: string) => void
}

export function ExerciseFormDialog({ exercise, defaultGroup, onClose, onDone }: Props) {
  const isEdit = Boolean(exercise)
  const [name, setName] = useState(exercise?.name ?? '')
  const [group, setGroup] = useState<MuscleGroup>(exercise?.muscleGroup ?? defaultGroup ?? 'chest')
  const [bodyweight, setBodyweight] = useState(exercise?.isBodyweight ?? false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('名前を入れてください')
      return
    }
    const same = await findSameName(trimmed, exercise?.id)
    if (same) {
      setError(
        same.archived
          ? `「${same.name}」は隠した種目にあります。一覧の下から戻せます`
          : `「${same.name}」はもうあります`,
      )
      return
    }
    setSaving(true)
    const input = { name: trimmed, muscleGroup: group, isBodyweight: bodyweight }
    if (exercise) {
      await updateExercise(exercise.id, input)
      onDone('保存しました')
    } else {
      await addExercise(input)
      onDone(`「${trimmed}」を追加しました`)
    }
  }

  const hide = async () => {
    if (!exercise) return
    await setArchived(exercise.id, true)
    onDone(`「${exercise.name}」を隠しました`)
  }

  return (
    <Dialog
      title={isEdit ? '種目を編集' : '種目を追加'}
      onClose={onClose}
      footer={
        <>
          {isEdit && (
            <button type="button" className="btn btn-danger" onClick={hide}>
              隠す
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {isEdit ? '保存' : '追加'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">名前</span>
        <input
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          placeholder="例：ケーブルフライ"
          autoFocus={!isEdit}
          maxLength={40}
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) save()
          }}
        />
        {error && <span className="field-error">{error}</span>}
      </label>

      <div className="field">
        <span className="field-label">筋群</span>
        <div className="choice-grid" role="radiogroup" aria-label="筋群">
          {MUSCLE_GROUPS.map(({ id, name: groupName }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={group === id}
              className="choice"
              style={groupColor(id)}
              onClick={() => setGroup(id)}
            >
              <span className="dot" aria-hidden />
              {groupName}
            </button>
          ))}
        </div>
      </div>

      <div className="field field-row">
        <div>
          <span className="field-label">自重の種目</span>
          <span className="field-help">重量を入れない種目（腕立て伏せなど）</span>
        </div>
        <Switch checked={bodyweight} onChange={setBodyweight} label="自重の種目" />
      </div>

      {isEdit && (
        <p className="field-help">
          隠しても、この種目を使った過去の記録は消えません。一覧の下からいつでも戻せます。
        </p>
      )}
    </Dialog>
  )
}
