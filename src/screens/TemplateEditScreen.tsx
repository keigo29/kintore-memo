import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Check, ChevronLeft, Copy, Dumbbell, Minus, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { ExercisePickerDialog } from '../components/ExercisePickerDialog'
import { db } from '../data/db'
import { groupColor } from '../data/muscleGroups'
import { deleteTemplate, duplicateTemplate, saveTemplate } from '../data/templates'
import type { TemplateItem } from '../data/templates'

/*
  メニューを作る・直す
  ・名前、種目（続けて選べる）、それぞれのセット数（1〜10）、並び（↑↓）
  ・保存するまで、データベースは変えない（キャンセルで元のまま）
*/
type Props = {
  /** 直すメニュー。新しく作るときは null */
  templateId: string | null
  /** 新しく作るときの最初の中身（過去の記録からメニューにするときなど） */
  initial?: { name: string; items: TemplateItem[] }
  onClose: (message?: string) => void
}

const DEFAULT_SETS = 3

export function TemplateEditScreen({ templateId, initial, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [items, setItems] = useState<TemplateItem[]>(initial?.items ?? [])
  const [loaded, setLoaded] = useState(templateId === null)
  const [picking, setPicking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 直すときは、保存されている中身から始める
  useEffect(() => {
    if (!templateId) return
    void db.templates.get(templateId).then((t) => {
      if (t) {
        setName(t.name)
        setItems(t.items.map((i) => ({ ...i })))
      }
      setLoaded(true)
    })
  }, [templateId])

  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), [])
  if (!loaded || !exercises) return null

  const move = (i: number, dir: -1 | 1) => {
    const next = [...items]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    setItems(next)
  }
  const setSets = (i: number, n: number) => {
    setItems(items.map((it, k) => (k === i ? { ...it, targetSets: Math.min(10, Math.max(1, n)) } : it)))
  }

  const save = async () => {
    if (!name.trim()) return setError('メニューの名前を入れてください')
    if (items.length === 0) return setError('種目を1つ以上入れてください')
    await saveTemplate({ id: templateId ?? undefined, name, items })
    onClose(templateId ? 'メニューを保存しました' : `「${name.trim()}」を作りました`)
  }

  return (
    <section className="screen review">
      <header className="screen-head record-head">
        <button type="button" className="icon-btn" aria-label="保存せずに戻る" onClick={() => onClose()}>
          <ChevronLeft strokeWidth={2} />
        </button>
        <h1 className="screen-title review-title">{templateId ? 'メニューを編集' : 'メニューを作る'}</h1>
        <span style={{ width: 34 }} />
      </header>

      <label className="field">
        <span className="field-label">メニューの名前</span>
        <input
          className="input template-name"
          value={name}
          maxLength={30}
          placeholder="例：胸の日、プッシュ、脚トレ"
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
        />
      </label>

      <div>
        <div className="row-between">
          <h2 className="section-title">種目</h2>
          <span className="list-count num">
            {items.length}種目・{items.reduce((n, i) => n + (i.targetSets ?? 1), 0)}セット
          </span>
        </div>
        {items.length === 0 ? (
          <div className="card">
            <EmptyState icon={Dumbbell} text="種目を足して、メニューを作りましょう" />
          </div>
        ) : (
          <ol className="card list template-items">
            {items.map((it, i) => {
              const e = exercises.get(it.exerciseId)
              return (
                <li key={`${it.exerciseId}-${i}`} className="template-item" style={e ? groupColor(e.muscleGroup) : undefined}>
                  <span className="template-order">
                    <button type="button" className="icon-btn" aria-label="上へ" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="下へ"
                      disabled={i === items.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown strokeWidth={2} />
                    </button>
                  </span>
                  <span className="template-name-col">
                    <span className="list-name">
                      <span className="dot" aria-hidden /> {e?.name ?? '（消えた種目）'}
                    </span>
                    {e?.archived && <span className="list-sub">隠した種目（始めるときは飛ばします）</span>}
                  </span>
                  <span className="template-sets">
                    <button type="button" className="rest-btn" aria-label="セットを減らす" onClick={() => setSets(i, (it.targetSets ?? 1) - 1)}>
                      <Minus strokeWidth={2.4} />
                    </button>
                    <span className="num template-sets-n">
                      {it.targetSets ?? 1}
                      <small>セット</small>
                    </span>
                    <button type="button" className="rest-btn" aria-label="セットを増やす" onClick={() => setSets(i, (it.targetSets ?? 1) + 1)}>
                      <Plus strokeWidth={2.4} />
                    </button>
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="この種目を外す"
                    onClick={() => setItems(items.filter((_, k) => k !== i))}
                  >
                    <X strokeWidth={2} />
                  </button>
                </li>
              )
            })}
          </ol>
        )}
        <button type="button" className="btn btn-block template-add" onClick={() => setPicking(true)}>
          <Plus strokeWidth={2} aria-hidden />
          種目を追加
        </button>
      </div>

      {templateId && (
        <div className="detail-actions">
          <button
            type="button"
            className="btn btn-lg btn-block"
            onClick={async () => {
              await duplicateTemplate(templateId)
              onClose('メニューを複製しました')
            }}
          >
            <Copy strokeWidth={2} aria-hidden />
            このメニューを複製
          </button>
          <button type="button" className="link-btn link-danger" onClick={() => setDeleting(true)}>
            このメニューを削除
          </button>
        </div>
      )}

      <div className="action-bar">
        {error && (
          <div className="action-message field-error" role="alert">
            {error}
          </div>
        )}
        <button type="button" className="btn btn-primary btn-xl btn-block" onClick={save}>
          <Check strokeWidth={2.6} aria-hidden />
          保存
        </button>
      </div>

      {picking && (
        <ExercisePickerDialog
          addedIds={items.map((i) => i.exerciseId)}
          onClose={() => setPicking(false)}
          // 続けて何個でも選べるように、選んでも閉じない
          onPick={(exerciseId) => {
            setItems((prev) => [...prev, { exerciseId, targetSets: DEFAULT_SETS }])
            setError(null)
          }}
        />
      )}

      {deleting && templateId && (
        <Dialog
          title="このメニューを削除しますか？"
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
                onClick={async () => {
                  await deleteTemplate(templateId)
                  onClose('メニューを削除しました')
                }}
              >
                削除する
              </button>
            </>
          }
        >
          <p className="field-help">メニューだけが消えます。このメニューでやったトレーニングの記録は残ります。</p>
        </Dialog>
      )}
    </section>
  )
}
