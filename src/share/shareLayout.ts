import type { SessionSummary } from '../data/summary'
import type { ShareDefaults } from '../data/types'
import { MUSCLE_GROUPS } from '../data/muscleGroups'
import { formatDate, formatDuration, formatKg } from '../lib/format'

/*
  共有画像のレイアウト（アプリの画面とは別に、ここだけで管理する）
  ・1080 × 1920（9:16）。スマホで見やすく、ストーリーにもそのまま使える
  ・ダークが基本。数字は大きく、余白をたっぷり
  ・記録していない項目は出さない（きつさ未入力・自己ベストなし・伸びなし など）
  ・入りきらないときは、全体の大きさ（scale）を少しずつ下げて収める
*/

export const W = 1080
export const H = 1920
export const PAD = 96

export const C = {
  bg: '#0b0b0c',
  card: '#17181a',
  line: '#26282c',
  text: '#f3f4f5',
  sub: '#9ba3ae',
  ok: '#33d167',
  okSoft: 'rgba(0, 194, 48, .14)',
}

export const FONT_JP = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif'
export const FONT_MONO = '"Roboto Mono", "Zen Kaku Gothic New", monospace'

export const GROUP_COLORS: Record<string, string> = {
  chest: '#005cff',
  back: '#00b33c',
  shoulders: '#ff8a00',
  arms: '#8600ff',
  legs: '#00a8c6',
  core: '#f2b500',
  other: '#717680',
}

/** 画像に出すもの（記録がないものは入れない） */
export type ShareContent = {
  date: string
  groups: { name: string; color: string }[]
  stats: { label: string; value: string; unit: string }[]
  /** 伸び：前回より上がった種目と、自己ベスト */
  growth: { name: string; change: string | null; record: boolean }[]
  effort: number | null
  note: string | null
  message: string | null
}

/** どの項目が出せるか（記録があるか）。プレビュー画面で、出せない項目のスイッチを止めるのに使う */
export function availableItems(summary: SessionSummary): Record<keyof ShareDefaults, boolean> {
  const growthCount = summary.exercises.filter((e) => (e.change?.diff ?? 0) > 0 || e.records.length > 0).length
  return {
    muscleGroups: summary.groups.length > 0,
    exerciseCount: summary.totals.exercises > 0,
    totalSets: summary.totals.sets > 0,
    totalVolume: summary.totals.volume > 0,
    duration: summary.durationMs > 0,
    personalRecords: summary.recordCount > 0,
    growth: growthCount > 0,
    effort: summary.session.effort !== null,
    message: true,
    note: Boolean(summary.session.note),
  }
}

/** まとめと「出す項目」から、画像に描く中身を決める */
export function buildContent(summary: SessionSummary, show: ShareDefaults, message: string): ShareContent {
  const ok = availableItems(summary)
  const on = (k: keyof ShareDefaults) => show[k] && ok[k]
  const stats: ShareContent['stats'] = []
  if (on('totalVolume')) stats.push({ label: 'TOTAL VOLUME', value: summary.totals.volume.toLocaleString('ja-JP'), unit: 'kg' })
  if (on('totalSets')) stats.push({ label: 'TOTAL SETS', value: String(summary.totals.sets), unit: 'SETS' })
  if (on('exerciseCount')) stats.push({ label: 'EXERCISES', value: String(summary.totals.exercises), unit: '' })
  if (on('duration')) stats.push({ label: 'DURATION', value: formatDuration(summary.durationMs), unit: '' })
  if (on('personalRecords'))
    stats.push({ label: 'PERSONAL RECORDS', value: String(summary.recordCount), unit: summary.recordCount === 1 ? 'NEW RECORD' : 'NEW RECORDS' })

  const growth = on('growth')
    ? summary.exercises
        .filter((e) => (e.change?.diff ?? 0) > 0 || e.records.length > 0)
        .map((e) => ({
          name: e.name,
          change: e.change && e.change.diff > 0 ? `+${formatKg(e.change.diff)}${e.change.unit}` : null,
          record: e.records.length > 0,
        }))
    : []

  return {
    date: formatDate(summary.session.startedAt, false),
    groups: on('muscleGroups')
      ? summary.groups.map((g) => ({
          name: MUSCLE_GROUPS.find((m) => m.id === g)?.name ?? '',
          color: GROUP_COLORS[g] ?? GROUP_COLORS.other,
        }))
      : [],
    stats,
    growth,
    effort: on('effort') ? summary.session.effort : null,
    note: on('note') ? summary.session.note : null,
    message: on('message') && message.trim() ? message.trim() : null,
  }
}

/** 文字の大きさの基本（scale を掛けて使う） */
export const SIZE = {
  brand: 34,
  kicker: 30,
  date: 104,
  chip: 34,
  statLabel: 27,
  statValue: 92,
  statUnit: 34,
  growthTitle: 27,
  growthName: 36,
  growthValue: 38,
  note: 32,
  message: 50,
}

/** 選べるメッセージ（自由に書くこともできる） */
export const MESSAGE_PRESETS = [
  'ONE SESSION CLOSER TO YOUR GOAL.',
  '今日も積み上げた。',
  '昨日の自分を、1kg超える。',
  'NO PAIN, NO GAIN.',
]
