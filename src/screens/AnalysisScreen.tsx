import { useLiveQuery } from 'dexie-react-hooks'
import { ChartLine, ChevronDown, Trophy } from 'lucide-react'
import { useState } from 'react'
import { GroupBars, LineChart, WeeklyBars } from '../components/Charts'
import type { LinePoint } from '../components/Charts'
import { Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { CalcHelp, formatNumber } from '../components/SessionReport'
import { PERIODS, getAnalysis, getExerciseRecords } from '../data/analysis'
import type { ExerciseLine, Period } from '../data/analysis'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import type { RecordType } from '../data/types'
import type { ExerciseStats } from '../lib/calc'
import { formatDate, formatKg } from '../lib/format'

/*
  分析
  1. 期間（1か月／3か月／1年／全期間）
  2. 期間のまとめ：日数・回数・セット・総挙上量
  3. 週ごとの回数（直近12週）
  4. 筋群ごとのセット数
  5. 種目の推移：種目と項目を選ぶ → 折れ線（点を押すとその日の値）
  6. その種目の自己ベスト：いまの最高と、更新してきた記録
  記録がないところは、作った数字を出さず「記録すると出ます」とだけ出す
*/

type Props = {
  /** 履歴の詳細を開く */
  onOpenSession: (sessionId: string) => void
}

type Metric = 'topWeight' | 'bestE1rm' | 'volume' | 'reps' | 'sets'

const METRICS: { id: Metric; label: string; unit: string; empty: string }[] = [
  { id: 'topWeight', label: '最高重量', unit: 'kg', empty: '重量を入れたセット（補助なし）がありません' },
  { id: 'bestE1rm', label: '推定1RM', unit: 'kg', empty: '推定1RMを出せるセットがありません（10回以下・補助なしで出ます）' },
  { id: 'volume', label: '総挙上量', unit: 'kg', empty: '重量を入れたセットがありません' },
  { id: 'reps', label: '合計回数', unit: '回', empty: '回数を入れたセットがありません' },
  { id: 'sets', label: 'セット数', unit: 'セット', empty: '' },
]

const RECORD_LABEL: Record<RecordType, string> = { maxWeight: '最高重量', e1rm: '推定1RM', maxVolume: '総挙上量' }

function metricValue(stats: ExerciseStats, m: Metric): number | null {
  if (m === 'volume') return stats.volume > 0 ? stats.volume : null
  if (m === 'reps') return stats.reps > 0 ? stats.reps : null
  return stats[m]
}

export function AnalysisScreen({ onOpenSession }: Props) {
  const [period, setPeriod] = useState<Period>('3m')
  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('topWeight')
  const [picking, setPicking] = useState(false)

  const data = useLiveQuery(() => getAnalysis(period), [period])
  const line: ExerciseLine | undefined = data?.lines.find((l) => l.exercise.id === exerciseId) ?? data?.lines[0]
  const records = useLiveQuery(async () => (line ? getExerciseRecords(line.exercise.id) : []), [line?.exercise.id])

  if (!data) return <section className="screen" />

  return (
    <section className="screen">
      <header className="screen-head">
        <h1 className="screen-title">分析</h1>
      </header>

      {!data.hasAny ? (
        <div className="card">
          <EmptyState icon={ChartLine} text="トレーニングを記録すると、重量や回数の伸びがここに出ます" />
        </div>
      ) : (
        <>
          {/* 1. 期間 */}
          <div className="seg" role="tablist" aria-label="期間">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" role="tab" className="seg-btn" aria-selected={p.id === period} onClick={() => setPeriod(p.id)}>
                {p.label}
              </button>
            ))}
          </div>

          {/* 2. まとめ */}
          <div className="stat-grid an-stats">
            {[
              { label: 'トレーニング日数', value: String(data.summary.days), unit: '日' },
              { label: 'トレーニング回数', value: String(data.summary.sessions), unit: '回' },
              { label: 'セット', value: formatNumber(data.summary.sets), unit: 'セット' },
              { label: '総挙上量', value: formatNumber(Math.round(data.summary.volume)), unit: 'kg' },
            ].map((t) => (
              <div key={t.label} className="stat">
                <span className="stat-label">{t.label}</span>
                <span className="stat-value num">
                  {t.value}
                  <small>{t.unit}</small>
                </span>
              </div>
            ))}
          </div>

          {/* 3. 週ごとの回数 */}
          <div>
            <h2 className="section-title">週ごとの回数</h2>
            <div className="card">
              <WeeklyBars weekly={data.weekly} />
            </div>
          </div>

          {/* 4. 筋群ごと */}
          <div>
            <h2 className="section-title">筋群ごとのセット数</h2>
            <div className="card">
              {data.groups.length === 0 ? (
                <p className="field-help an-none">この期間の記録はありません</p>
              ) : (
                <GroupBars groups={data.groups} />
              )}
            </div>
          </div>

          {/* 5. 種目の推移 */}
          <div>
            <h2 className="section-title">種目の推移</h2>
            {!line ? (
              <div className="card">
                <p className="field-help an-none">この期間の記録はありません</p>
              </div>
            ) : (
              <ExerciseTrend line={line} metric={metric} onMetric={setMetric} onPick={() => setPicking(true)} onOpenSession={onOpenSession} />
            )}
          </div>

          {/* 6. 自己ベスト */}
          {line && (
            <div>
              <h2 className="section-title">{line.exercise.name}の自己ベスト</h2>
              <RecordList records={records ?? []} onOpenSession={onOpenSession} />
            </div>
          )}

          <CalcHelp />
        </>
      )}

      {picking && data && (
        <Dialog
          title="種目を選ぶ"
          onClose={() => setPicking(false)}
          footer={
            <>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setPicking(false)}>
                閉じる
              </button>
            </>
          }
        >
          <p className="field-help">この期間にやった種目（やった回数の多い順）</p>
          <ul className="list an-pick">
            {data.lines.map((l) => (
              <li key={l.exercise.id}>
                <button
                  type="button"
                  className="list-row list-row-btn an-pick-row"
                  aria-current={l.exercise.id === line?.exercise.id || undefined}
                  style={groupColor(l.exercise.muscleGroup)}
                  onClick={() => {
                    setExerciseId(l.exercise.id)
                    setPicking(false)
                  }}
                >
                  <span className="dot" aria-hidden />
                  <span className="list-name">{l.exercise.name}</span>
                  <span className="list-count num">{l.points.length}回</span>
                </button>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </section>
  )
}

function ExerciseTrend({
  line,
  metric,
  onMetric,
  onPick,
  onOpenSession,
}: {
  line: ExerciseLine
  metric: Metric
  onMetric: (m: Metric) => void
  onPick: () => void
  onOpenSession: (id: string) => void
}) {
  const bw = line.exercise.isBodyweight
  const metrics = METRICS.filter((m) => (bw ? m.id === 'reps' || m.id === 'sets' : true))
  const m = metrics.find((x) => x.id === metric) ?? metrics[0]
  const points: LinePoint[] = line.points.flatMap((p) => {
    const v = metricValue(p.stats, m.id)
    return v === null ? [] : [{ at: p.at, value: v, id: p.sessionId }]
  })
  const first = points[0]
  const lastP = points[points.length - 1]
  const diff = points.length >= 2 ? Math.round((lastP.value - first.value) * 10) / 10 : null
  const group = MUSCLE_GROUPS.find((g) => g.id === line.exercise.muscleGroup)

  return (
    <div className="card an-trend" style={groupColor(line.exercise.muscleGroup)}>
      <button type="button" className="an-exercise" onClick={onPick}>
        <span className="dot" aria-hidden />
        <span className="an-exercise-name">{line.exercise.name}</span>
        <span className="an-exercise-sub">{group?.name}</span>
        <ChevronDown strokeWidth={2} aria-hidden />
      </button>
      <div className="an-metrics" role="tablist" aria-label="項目">
        {metrics.map((x) => (
          <button key={x.id} type="button" role="tab" className="an-metric" aria-selected={x.id === m.id} onClick={() => onMetric(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      {points.length === 0 ? (
        <p className="field-help an-none">{m.empty}</p>
      ) : (
        <>
          <LineChart key={`${line.exercise.id}-${m.id}`} points={points} unit={m.unit} color="var(--dot)" onOpen={onOpenSession} />
          <p className="an-change num">
            {diff === null ? (
              '2回以上記録すると、線になります'
            ) : (
              <>
                {formatDateShortYear(first.at)}から
                <strong data-up={diff > 0 || undefined}>
                  {diff > 0 ? '+' : diff < 0 ? '−' : '±'}
                  {formatNumber(Math.abs(diff))}
                  {m.unit}
                </strong>
                <span className="sep-dot">｜</span>
                {points.length}回分
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}

function formatDateShortYear(ms: number): string {
  return formatDate(ms, false)
}

function RecordList({ records, onOpenSession }: { records: { id: string; type: RecordType; value: number; achievedAt: number; sessionId: string }[]; onOpenSession: (id: string) => void }) {
  if (records.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={Trophy} text="前回までの記録を上回ると、ここに自己ベストが出ます" />
      </div>
    )
  }
  // いまの最高（種類ごと）
  const best = (['maxWeight', 'e1rm', 'maxVolume'] as RecordType[]).flatMap((t) => {
    const list = records.filter((r) => r.type === t)
    if (list.length === 0) return []
    const top = list.reduce((a, b) => (b.value > a.value ? b : a))
    return [{ type: t, value: top.value, at: top.achievedAt }]
  })
  return (
    <div className="card an-records">
      <div className="an-best">
        {best.map((b) => (
          <div key={b.type} className="stat">
            <span className="stat-label">{RECORD_LABEL[b.type]}</span>
            <span className="stat-value num">
              {b.type === 'maxVolume' ? formatNumber(b.value) : formatKg(b.value)}
              <small>kg</small>
            </span>
          </div>
        ))}
      </div>
      <ul className="list an-pr-list">
        {records.slice(0, 8).map((r) => (
          <li key={r.id}>
            <button type="button" className="list-row list-row-btn home-row" onClick={() => onOpenSession(r.sessionId)}>
              <span className="pr-badge" aria-hidden>
                <Trophy strokeWidth={2.2} />
              </span>
              <span className="home-row-text">
                <span className="list-name">{RECORD_LABEL[r.type]}</span>
                <span className="list-sub num">{formatDate(r.achievedAt)}</span>
              </span>
              <span className="an-pr-value num">
                {r.type === 'maxVolume' ? formatNumber(r.value) : formatKg(r.value)}
                <small>kg</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {records.length > 8 && <p className="field-help an-more">ほか {records.length - 8} 件</p>}
    </div>
  )
}
