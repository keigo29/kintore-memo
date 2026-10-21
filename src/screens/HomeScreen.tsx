import { useLiveQuery } from 'dexie-react-hooks'
import { History, Play, Settings, Trophy } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { EmptyState } from '../components/EmptyState'
import { HEATMAP_WEEKS } from '../components/TrainingHeatmap'
import { TrainingHeatmapList } from '../components/TrainingHeatmapList'
import { getDailySets } from '../data/stats'
import { addDays, dayKey, startOfDay, startOfWeek } from '../lib/date'

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

  // 草の表の期間（17週前の月曜〜今日）の、日ごとのセット数。今週の印にも使う
  const todayStart = startOfDay(today.getTime())
  const from = addDays(startOfWeek(todayStart), -7 * (HEATMAP_WEEKS - 1))
  const daily = useLiveQuery(() => getDailySets(from, addDays(todayStart, 1)), [from, todayStart])
  // 今週トレーニングした日
  const doneDays = new Set(week.map((d) => dayKey(d.getTime())).filter((k) => daily?.has(k)))

  return (
    <section className="screen">
      <header className="screen-head">
        <div className="brand">
          <span className="logo">
            <BrandMark />
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
            const done = doneDays.has(dayKey(d.getTime()))
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
        <h2 className="section-title">鍛えた日の記録</h2>
        {daily && <TrainingHeatmapList daily={daily} today={todayStart} />}
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
