import { useLiveQuery } from 'dexie-react-hooks'
import { House, Image as ImageIcon, Trophy } from 'lucide-react'
import { CalcHelp, ExerciseResults, GroupChips, StatGrid } from '../components/SessionReport'
import { getSessionSummary } from '../data/summary'
import { formatDate } from '../lib/format'

/*
  トレーニング終了（保存したあと）
  ・その日の成果をまとめて見せる
  ・ここから共有画像を作る（次の段階でつなぐ）
*/
type Props = {
  sessionId: string
  onClose: () => void
  onShare: (sessionId: string) => void
}

export function SummaryScreen({ sessionId, onClose, onShare }: Props) {
  const summary = useLiveQuery(() => getSessionSummary(sessionId), [sessionId])
  if (!summary) return null
  const { session } = summary
  const prs = summary.exercises.filter((e) => e.records.length > 0)

  return (
    <section className="screen review">
      <header className="summary-head">
        <span className="summary-date num">{formatDate(session.startedAt)}</span>
        <h1 className="summary-title">お疲れさまでした</h1>
        <GroupChips summary={summary} />
      </header>

      <div className="card report-card">
        <StatGrid summary={summary} />
      </div>

      {prs.length > 0 && (
        <div className="card pr-card">
          <span className="pr-title">
            <Trophy strokeWidth={2.2} aria-hidden />
            自己ベスト更新
          </span>
          <ul className="pr-list">
            {prs.map((e) => (
              <li key={e.exerciseId}>
                <span>{e.name}</span>
                <span className="num">
                  {e.records
                    .map((r) =>
                      r === 'maxWeight'
                        ? `最高 ${e.stats.topWeight}kg`
                        : r === 'e1rm'
                          ? `推定1RM ${e.stats.bestE1rm}kg`
                          : `総挙上量 ${e.stats.volume.toLocaleString('ja-JP')}kg`,
                    )
                    .join('・')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="section-title">トレーニング内容</h2>
        <ExerciseResults summary={summary} />
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

      <CalcHelp />

      <div className="action-bar">
        <div className="action-pair">
          <button type="button" className="btn btn-xl" onClick={onClose}>
            <House strokeWidth={2} aria-hidden />
            ホームへ
          </button>
          <button type="button" className="btn btn-primary btn-xl" onClick={() => onShare(sessionId)}>
            <ImageIcon strokeWidth={2} aria-hidden />
            共有画像を作る
          </button>
        </div>
      </div>
    </section>
  )
}
