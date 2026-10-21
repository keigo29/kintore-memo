// 表示用の文字の形を揃える

/** 重量：60 → "60"、62.5 → "62.5"、null → "—" */
export function formatKg(kg: number | null): string {
  if (kg === null) return '—'
  return String(Math.round(kg * 100) / 100)
}

/** 掛かった時間：65秒 → "1:05"、1時間2分3秒 → "1:02:03" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 日付：2026.10.21（水） */
export function formatDate(ms: number, withWeekday = true): string {
  const d = new Date(ms)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  return withWeekday ? `${date}（${WEEKDAYS[d.getDay()]}）` : date
}

/** 短い日付：10.21 */
export function formatShortDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
}
