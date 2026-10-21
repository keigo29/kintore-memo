import { startOfDay } from '../lib/date'
import { db } from './db'
import { listSessions } from './history'
import type { SessionRow } from './history'
import type { MuscleGroup } from './muscleGroups'
import type { RecordType } from './types'

/*
  ホームに出すもの
  ・直近の履歴（3回）
  ・筋群ごとの前回（何日前にやったか）
  ・今月と先月（回数・総挙上量・自己ベスト更新数）
  ・最近の自己ベスト（同じ回・同じ種目の更新は1行にまとめる）
*/

export type MonthStats = { count: number; volume: number; records: number }

export type RecentRecord = {
  sessionId: string
  exerciseId: string
  exerciseName: string
  achievedAt: number
  items: { type: RecordType; value: number }[]
}

export type HomeData = {
  total: number
  recent: SessionRow[]
  /** 筋群ごとの、一番最近やった日の 0:00（やっていなければ入らない） */
  lastByGroup: Map<MuscleGroup, number>
  thisMonth: MonthStats
  lastMonth: MonthStats
  records: RecentRecord[]
}

export async function getHomeData(now = Date.now()): Promise<HomeData> {
  const rows = await listSessions()

  const lastByGroup = new Map<MuscleGroup, number>()
  for (const r of rows) {
    for (const g of r.groups) if (!lastByGroup.has(g)) lastByGroup.set(g, startOfDay(r.startedAt))
  }

  const d = new Date(now)
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const lastMonthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()
  const allRecords = await db.records.toArray()
  const month = (from: number, to: number): MonthStats => {
    const inMonth = rows.filter((r) => r.startedAt >= from && r.startedAt < to)
    return {
      count: inMonth.length,
      volume: Math.round(inMonth.reduce((v, r) => v + r.volume, 0) * 10) / 10,
      records: allRecords.filter((x) => x.achievedAt >= from && x.achievedAt < to).length,
    }
  }

  // 自己ベスト：新しい順。同じ回・同じ種目は1行に
  const sorted = allRecords.sort((a, b) => b.achievedAt - a.achievedAt)
  const grouped: RecentRecord[] = []
  for (const r of sorted) {
    const same = grouped.find((g) => g.sessionId === r.sessionId && g.exerciseId === r.exerciseId)
    if (same) {
      same.items.push({ type: r.type, value: r.value })
      continue
    }
    if (grouped.length >= 4) continue
    grouped.push({ sessionId: r.sessionId, exerciseId: r.exerciseId, exerciseName: '', achievedAt: r.achievedAt, items: [{ type: r.type, value: r.value }] })
  }
  // 種目の名前を入れる
  for (const g of grouped) {
    g.exerciseName = (await db.exercises.get(g.exerciseId))?.name ?? '（消えた種目）'
    const order: RecordType[] = ['maxWeight', 'e1rm', 'maxVolume']
    g.items.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
  }

  return {
    total: rows.length,
    recent: rows.slice(0, 3),
    lastByGroup,
    thisMonth: month(monthStart, Infinity),
    lastMonth: month(lastMonthStart, monthStart),
    records: grouped,
  }
}
