import { CalendarDays, ChartLine } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'

// 履歴と分析は、まだ枠だけ。中身はそれぞれの段階で作る

export function HistoryScreen() {
  return (
    <section className="screen">
      <header className="screen-head">
        <h1 className="screen-title">履歴</h1>
      </header>
      <div className="card">
        <EmptyState icon={CalendarDays} text="トレーニングを終えると、ここに日付ごとに並びます" />
      </div>
    </section>
  )
}

export function AnalysisScreen() {
  return (
    <section className="screen">
      <header className="screen-head">
        <h1 className="screen-title">分析</h1>
      </header>
      <div className="card">
        <EmptyState icon={ChartLine} text="記録がたまると、重量や回数の伸びが見られます" />
      </div>
    </section>
  )
}
