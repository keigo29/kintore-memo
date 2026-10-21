// 日付の計算（端末の時刻で数える）

/** その日の 0:00 */
export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** その週の月曜 0:00（月曜はじまり） */
export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms))
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** n 日あと（マイナスなら前）の 0:00。夏時間などでずれないよう、日付で足す */
export function addDays(ms: number, n: number): number {
  const d = new Date(startOfDay(ms))
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** 日付の目印：'2026-10-21' */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
