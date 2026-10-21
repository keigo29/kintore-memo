import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { Dialog } from '../components/Dialog'
import { CalcHelp, ExerciseResults, GroupChips, RirBlock, StatGrid } from '../components/SessionReport'
import { finishWithReview, getSessionSummary } from '../data/summary'
import { discardSession } from '../data/workout'
import { restTimer } from '../lib/restTimer'
import { useNow } from '../lib/useNow'

/*
  振り返り（「終える」を押したあと）
  ・上：記録の数字（客観）…記録から計算したもの
  ・下：自分の感じ方（主観）…きつさ 1〜10 とメモ。どちらも入れなくてよい
  ・「保存して終える」で、未完了のセットを消して記録を確定する
*/
type Props = {
  sessionId: string
  onBack: () => void
  onSaved: (sessionId: string) => void
  onDiscarded: () => void
}

const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function ReviewScreen({ sessionId, onBack, onSaved, onDiscarded }: Props) {
  const now = useNow(5000)
  const summary = useLiveQuery(() => getSessionSummary(sessionId, Date.now()), [sessionId, now])
  const [effort, setEffort] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  if (!summary) return null

  const save = async () => {
    setSaving(true)
    await finishWithReview(sessionId, effort, note)
    restTimer.reset()
    onSaved(sessionId)
  }

  return (
    <section className="screen review">
      <header className="screen-head record-head">
        <button type="button" className="icon-btn" aria-label="トレーニングにもどる" onClick={onBack}>
          <ChevronLeft strokeWidth={2} />
        </button>
        <h1 className="screen-title review-title">振り返り</h1>
        <span style={{ width: 34 }} />
      </header>

      <div>
        <h2 className="section-title">記録の数字</h2>
        <div className="card report-card">
          <StatGrid summary={summary} />
          <GroupChips summary={summary} />
        </div>
      </div>

      <div>
        <h2 className="section-title">種目ごと</h2>
        <ExerciseResults summary={summary} />
      </div>

      <div>
        <h2 className="section-title">あと何回できた？</h2>
        <div className="card">
          <RirBlock summary={summary} />
        </div>
      </div>

      <div>
        <h2 className="section-title">自分の感じ方</h2>
        <div className="card review-feel">
          <div className="field">
            <span className="field-label">きつさ（1 楽 〜 10 限界）</span>
            <div className="effort-row" role="radiogroup" aria-label="きつさ">
              {EFFORTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={effort === n}
                  className="effort num"
                  // もう一度押すと「入れていない」に戻る
                  onClick={() => setEffort(effort === n ? null : n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-label">振り返りメモ</span>
            <textarea
              className="input textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="フォームの気づき、調子など"
              maxLength={300}
              rows={3}
            />
          </label>
          <p className="field-help">きつさとメモは自分で感じたことです。記録の数字とは分けて保存します。</p>
        </div>
      </div>

      <CalcHelp />

      <button type="button" className="link-btn link-danger review-discard" onClick={() => setDiscarding(true)}>
        記録せずに終える
      </button>

      <div className="action-bar">
        <button type="button" className="btn btn-primary btn-xl btn-block" onClick={save} disabled={saving}>
          <Check strokeWidth={2.6} aria-hidden />
          保存して終える
        </button>
      </div>

      {discarding && (
        <Dialog
          title="記録せずに終えますか？"
          onClose={() => setDiscarding(false)}
          footer={
            <>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setDiscarding(false)}>
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await discardSession(sessionId)
                  restTimer.reset()
                  onDiscarded()
                }}
              >
                記録せずに終える
              </button>
            </>
          }
        >
          <p className="field-help">今日のトレーニングの記録（{summary.totals.sets}セット）がすべて消えます。</p>
        </Dialog>
      )}
    </section>
  )
}
