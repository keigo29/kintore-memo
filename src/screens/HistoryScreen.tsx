import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { formatNumber } from '../components/SessionReport'
import { listSessions } from '../data/history'
import type { SessionRow } from '../data/history'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import { addDays, dayKey, startOfDay, startOfWeek } from '../lib/date'
import { formatDate, formatDuration } from '../lib/format'

/*
  履歴
  ・上：今週・今月・これまでの回数
  ・真ん中：月のカレンダー。やった日に印と筋群の色の点。日を押すと、その日だけを一覧に出す
  ・下：日付ごとの一覧（新しい順）。押すと詳細へ
*/
type Props = {
  onOpen: (sessionId: string) => void
}

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const PAGE = 30

export function HistoryScreen({ onOpen }: Props) {
  const rows = useLiveQuery(() => listSessions(), [])
  const today = startOfDay(Date.now())
  const [month, setMonth] = useState(() => {
    const d = new Date(today)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)

  if (!rows) return null

  // 回数：今週・今月・先月・これまで
  const weekStart = startOfWeek(today)
  const monthStart = new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1).getTime()
  const lastMonthStart = new Date(new Date(today).getFullYear(), new Date(today).getMonth() - 1, 1).getTime()
  const thisWeek = rows.filter((r) => r.startedAt >= weekStart).length
  const thisMonth = rows.filter((r) => r.startedAt >= monthStart).length
  const lastMonth = rows.filter((r) => r.startedAt >= lastMonthStart && r.startedAt < monthStart).length

  // 日ごとにまとめる（カレンダー用）
  const byDay = new Map<string, SessionRow[]>()
  for (const r of rows) {
    const k = dayKey(r.startedAt)
    byDay.set(k, [...(byDay.get(k) ?? []), r])
  }

  // カレンダーのマス：その月の1日を含む週の月曜から、6週ぶん
  const first = new Date(month.y, month.m, 1).getTime()
  const gridStart = startOfWeek(first)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const lastWeekNeeded = cells.findLastIndex((ms) => new Date(ms).getMonth() === month.m)
  const visibleCells = cells.slice(0, Math.ceil((lastWeekNeeded + 1) / 7) * 7)
  const monthCount = rows.filter((r) => {
    const d = new Date(r.startedAt)
    return d.getFullYear() === month.y && d.getMonth() === month.m
  }).length

  const moveMonth = (n: number) => {
    const d = new Date(month.y, month.m + n, 1)
    setMonth({ y: d.getFullYear(), m: d.getMonth() })
    setPickedDay(null)
  }
  const isFutureMonth = new Date(month.y, month.m + 1, 1).getTime() > today

  // 一覧：日を選んでいればその日だけ
  const listed = pickedDay ? (byDay.get(pickedDay) ?? []) : rows.slice(0, limit)

  // 月ごとの見出しをはさむ
  let lastHead = ''

  return (
    <section className="screen">
      <header className="screen-head">
        <h1 className="screen-title">履歴</h1>
      </header>

      <div className="history-counts">
        <div className="hc">
          <span className="stat-label">今週</span>
          <span className="stat-value num">
            {thisWeek}
            <small>回</small>
          </span>
        </div>
        <div className="hc">
          <span className="stat-label">今月</span>
          <span className="stat-value num">
            {thisMonth}
            <small>回</small>
          </span>
          <span className="hc-sub num">先月 {lastMonth}回</span>
        </div>
        <div className="hc">
          <span className="stat-label">これまで</span>
          <span className="stat-value num">
            {rows.length}
            <small>回</small>
          </span>
        </div>
      </div>

      <div className="card cal">
        <div className="cal-head">
          <button type="button" className="icon-btn" aria-label="前の月" onClick={() => moveMonth(-1)}>
            <ChevronLeft strokeWidth={2} />
          </button>
          <span className="cal-title">
            <span className="num">
              {month.y}年{month.m + 1}月
            </span>
            <span className="cal-count num">{monthCount}回</span>
          </span>
          <button type="button" className="icon-btn" aria-label="次の月" disabled={isFutureMonth} onClick={() => moveMonth(1)}>
            <ChevronRight strokeWidth={2} />
          </button>
        </div>
        <div className="cal-grid" role="grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal-wd">
              {w}
            </span>
          ))}
          {visibleCells.map((ms) => {
            const k = dayKey(ms)
            const day = byDay.get(k)
            const inMonth = new Date(ms).getMonth() === month.m
            const groups = [...new Set(day?.flatMap((r) => r.groups) ?? [])]
            return (
              <button
                key={k}
                type="button"
                className="cal-day"
                data-out={!inMonth || undefined}
                data-done={day ? true : undefined}
                data-today={ms === today || undefined}
                aria-pressed={pickedDay === k}
                disabled={!day}
                aria-label={`${formatDate(ms)} ${day ? `${day.length}回` : '記録なし'}`}
                onClick={() => setPickedDay(pickedDay === k ? null : k)}
              >
                <span className="cal-num num">{new Date(ms).getDate()}</span>
                {groups.length > 0 && (
                  <span className="cal-dots">
                    {groups.slice(0, 4).map((g) => (
                      <span key={g} className="cal-dot" style={groupColor(g)} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {pickedDay && (
        <button type="button" className="hm-chip history-filter" aria-checked="true" onClick={() => setPickedDay(null)}>
          <span className="num">{formatDate(new Date(pickedDay.replace(/-/g, '/')).getTime())}</span> の記録
          <X strokeWidth={2} aria-label="絞り込みをやめる" />
        </button>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={CalendarDays} text="トレーニングを終えると、ここに日付ごとに並びます" />
        </div>
      ) : (
        <div className="history-list">
          {listed.map((r) => {
            const d = new Date(r.startedAt)
            const head = `${d.getFullYear()}年${d.getMonth() + 1}月`
            const showHead = !pickedDay && head !== lastHead
            lastHead = head
            return (
              <div key={r.id}>
                {showHead && <h2 className="section-title history-month num">{head}</h2>}
                <button type="button" className="card history-row" onClick={() => onOpen(r.id)}>
                  <span className="history-top">
                    <span className="history-date num">{formatDate(r.startedAt)}</span>
                    <span className="history-groups">
                      {r.groups.map((g) => (
                        <span key={g} className="tag report-group" style={groupColor(g)}>
                          <span className="dot" aria-hidden />
                          {MUSCLE_GROUPS.find((m) => m.id === g)?.name}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="history-names">{r.names.join('・')}</span>
                  <span className="history-stats num">
                    <span>{r.sets}セット</span>
                    {r.volume > 0 && <span>{formatNumber(r.volume)}kg</span>}
                    <span>{formatDuration(r.durationMs)}</span>
                    {r.effort !== null && <span>きつさ {r.effort}</span>}
                  </span>
                  <ChevronRight className="chev history-chev" strokeWidth={2} aria-hidden />
                </button>
              </div>
            )
          })}
          {!pickedDay && rows.length > limit && (
            <button type="button" className="btn btn-block" onClick={() => setLimit(limit + PAGE)}>
              もっと見る（あと {rows.length - limit} 回）
            </button>
          )}
        </div>
      )}
    </section>
  )
}
