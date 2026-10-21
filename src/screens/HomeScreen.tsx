import { Dumbbell, History, Play, Settings, Trophy } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'

type Props = {
  /** トレーニング中なら、その開始時刻（なければ null） */
  activeStartedAt: number | null
  onStart: () => void
  onOpenSettings: () => void
}

// 今週（月曜はじまり）の7日を返す
function thisWeek(today = new Date()): Date[] {
  const start = new Date(today)
  const day = (today.getDay() + 6) % 7 // 月=0 … 日=6
  start.setDate(today.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']

export function HomeScreen({ activeStartedAt, onStart, onOpenSettings }: Props) {
  const today = new Date()
  const week = thisWeek(today)
  // まだ記録の保存がないので、今週の回数は本当に 0 回
  const doneDays = new Set<string>()

  return (
    <section className="screen">
      <header className="screen-head">
        <div className="brand">
          <span className="logo">
            <Dumbbell strokeWidth={2} aria-hidden />
          </span>
          <span className="wordmark">筋トレメモ</span>
        </div>
        <button type="button" className="icon-btn" aria-label="設定" onClick={onOpenSettings}>
          <Settings strokeWidth={2} />
        </button>
      </header>

      {/* いちばん上に「はじめる」。開いてすぐ始められるように */}
      <div className="card start-card">
        <p className="start-date num">
          {today.getFullYear()}.{String(today.getMonth() + 1).padStart(2, '0')}.{String(today.getDate()).padStart(2, '0')}（{WEEKDAYS[(today.getDay() + 6) % 7]}）
        </p>
        <h1 className="start-title">今日のトレーニング</h1>
        <p className="start-sub">
          {activeStartedAt ? 'トレーニングの途中です。続きから記録できます' : '前回と同じ種目か、何も決めずにはじめられます'}
        </p>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onStart}>
          <Play strokeWidth={2} aria-hidden />
          {activeStartedAt ? '続ける' : 'はじめる'}
        </button>
      </div>

      <div className="card">
        <div className="row-between">
          <h2 className="section-title">今週</h2>
          <span className="week-count num">{doneDays.size}回</span>
        </div>
        <ol className="week">
          {week.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString()
            const done = doneDays.has(d.toDateString())
            return (
              <li key={i} className="week-day" data-today={isToday || undefined} data-done={done || undefined}>
                <span className="week-name">{WEEKDAYS[i]}</span>
                <span className="week-mark num">{d.getDate()}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <div>
        <h2 className="section-title">最近の自己ベスト</h2>
        <div className="card">
          <EmptyState icon={Trophy} text="記録すると、ここに自己ベストが出ます" />
        </div>
      </div>

      <div>
        <h2 className="section-title">直近の履歴</h2>
        <div className="card">
          <EmptyState icon={History} text="トレーニングはまだありません" />
        </div>
      </div>
    </section>
  )
}
