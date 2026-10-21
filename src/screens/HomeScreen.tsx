import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, ClipboardList, History, Play, Plus, Settings, Trophy } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { EmptyState } from '../components/EmptyState'
import { HEATMAP_WEEKS } from '../components/TrainingHeatmap'
import { TrainingHeatmapList } from '../components/TrainingHeatmapList'
import { groupColor } from '../data/muscleGroups'
import { getDailySets } from '../data/stats'
import { listTemplates } from '../data/templates'
import { addDays, dayKey, startOfDay, startOfWeek } from '../lib/date'

type Props = {
  /** トレーニング中なら、その開始時刻（なければ null） */
  activeStartedAt: number | null
  onStart: () => void
  onOpenSettings: () => void
  /** メニューを直す（null なら新しく作る） */
  onEditTemplate: (templateId: string | null) => void
  /** メニューからはじめる */
  onStartTemplate: (templateId: string) => void
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

export function HomeScreen({ activeStartedAt, onStart, onOpenSettings, onEditTemplate, onStartTemplate }: Props) {
  const today = new Date()
  const week = thisWeek(today)

  // 草の表の期間（17週前の月曜〜今日）の、日ごとのセット数。今週の印にも使う
  const todayStart = startOfDay(today.getTime())
  const from = addDays(startOfWeek(todayStart), -7 * (HEATMAP_WEEKS - 1))
  const daily = useLiveQuery(() => getDailySets(from, addDays(todayStart, 1)), [from, todayStart])
  // 今週トレーニングした日
  const doneDays = new Set(week.map((d) => dayKey(d.getTime())).filter((k) => daily?.has(k)))
  const templates = useLiveQuery(() => listTemplates(), [])

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
          {activeStartedAt ? 'トレーニングの途中です。続きから記録できます' : 'メニューや前回と同じ種目からはじめられます'}
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

      {/* メニュー：押すと直す、▶ でそのメニューからはじめる */}
      <div>
        <div className="row-between">
          <h2 className="section-title">メニュー</h2>
          <button type="button" className="link-btn section-link" onClick={() => onEditTemplate(null)}>
            <Plus strokeWidth={2} aria-hidden />
            作る
          </button>
        </div>
        {templates && templates.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={ClipboardList}
              text="よくやる種目をメニューにすると、すぐにはじめられます"
              action={
                <button type="button" className="btn" onClick={() => onEditTemplate(null)}>
                  <Plus strokeWidth={2} aria-hidden />
                  メニューを作る
                </button>
              }
            />
          </div>
        ) : (
          <ul className="card list">
            {templates?.map(({ template, names, groups, sets }) => (
              <li key={template.id} className="list-row template-row">
                <button type="button" className="template-open" onClick={() => onEditTemplate(template.id)}>
                  <span className="template-row-top">
                    <span className="list-name">{template.name}</span>
                    <span className="template-dots">
                      {groups.map((g) => (
                        <span key={g} className="cal-dot" style={groupColor(g)} />
                      ))}
                    </span>
                  </span>
                  <span className="list-sub template-row-sub">
                    <span className="num">
                      {names.length}種目・{sets}セット
                    </span>
                    <span className="sep-dot">｜</span>{names.join('・')}
                  </span>
                </button>
                {activeStartedAt ? (
                  <ChevronRight className="chev" strokeWidth={2} aria-hidden />
                ) : (
                  <button
                    type="button"
                    className="rest-btn rest-btn-go template-go"
                    aria-label={`${template.name}ではじめる`}
                    onClick={() => onStartTemplate(template.id)}
                  >
                    <Play strokeWidth={2.4} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
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
