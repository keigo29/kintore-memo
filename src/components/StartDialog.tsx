import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Copy, Play } from 'lucide-react'
import { db } from '../data/db'
import { listTemplates, startFromTemplate } from '../data/templates'
import { getLastDoneSession, getSessionExercises, startSession } from '../data/workout'
import { formatDate } from '../lib/format'
import { Dialog } from './Dialog'

/*
  始め方を選ぶ
  ・何も決めずにはじめる
  ・前回と同じ種目ではじめる（前回がなければ押せない）
  ・メニューからはじめる（作ったメニューを並べる）
*/
type Props = {
  onClose: () => void
  onStarted: (sessionId: string) => void
}

export function StartDialog({ onClose, onStarted }: Props) {
  // 前回のトレーニングと、その種目の名前
  const last = useLiveQuery(async () => {
    const session = await getLastDoneSession()
    if (!session) return null
    const items = await getSessionExercises(session.id)
    const names = await Promise.all(items.map(async (i) => (await db.exercises.get(i.exerciseId))?.name ?? ''))
    return { session, names }
  }, [])

  const templates = useLiveQuery(() => listTemplates(), [])

  const start = async (copyFrom?: string) => {
    const id = await startSession(copyFrom)
    onStarted(id)
  }

  const namesText = (names: string[]) =>
    names.length <= 3 ? names.join('・') : `${names.slice(0, 3).join('・')} ほか${names.length - 3}種目`

  return (
    <Dialog
      title="トレーニングをはじめる"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            キャンセル
          </button>
        </>
      }
    >
      <button type="button" className="option" onClick={() => start()}>
        <span className="option-icon">
          <Play strokeWidth={2} aria-hidden />
        </span>
        <span className="option-text">
          <span className="option-title">何も決めずにはじめる</span>
          <span className="option-sub">種目はあとから足せます</span>
        </span>
      </button>

      <button type="button" className="option" disabled={!last} onClick={() => last && start(last.session.id)}>
        <span className="option-icon">
          <Copy strokeWidth={2} aria-hidden />
        </span>
        <span className="option-text">
          <span className="option-title">前回と同じ種目ではじめる</span>
          <span className="option-sub">
            {last ? (
              <>
                <span className="num">{formatDate(last.session.startedAt)}</span>　{namesText(last.names)}
              </>
            ) : (
              'まだ前回の記録がありません'
            )}
          </span>
        </span>
      </button>
      {templates && templates.length > 0 && (
        <>
          <span className="field-label start-menu-label">メニューからはじめる</span>
          {templates.map(({ template, names, sets }) => (
            <button
              key={template.id}
              type="button"
              className="option"
              onClick={async () => {
                const id = await startFromTemplate(template.id)
                if (id) onStarted(id)
              }}
            >
              <span className="option-icon">
                <ClipboardList strokeWidth={2} aria-hidden />
              </span>
              <span className="option-text">
                <span className="option-title">{template.name}</span>
                <span className="option-sub">
                  <span className="num">
                    {names.length}種目・{sets}セット
                  </span>
                  <span className="sep-dot">｜</span>{namesText(names)}
                </span>
              </span>
            </button>
          ))}
        </>
      )}
    </Dialog>
  )
}
