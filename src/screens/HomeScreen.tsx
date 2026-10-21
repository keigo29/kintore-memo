import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, ClipboardList, Play, Plus, Settings, Trophy } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { EmptyState } from '../components/EmptyState'
import { MuscleIcon } from '../components/MuscleIcon'
import { formatNumber } from '../components/SessionReport'
import { HEATMAP_WEEKS } from '../components/TrainingHeatmap'
import { TrainingHeatmapList } from '../components/TrainingHeatmapList'
import { getHomeData } from '../data/home'
import type { MonthStats } from '../data/home'
import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import { getDailySets } from '../data/stats'
import { listTemplates } from '../data/templates'
import { addDays, dayKey, startOfDay, startOfWeek } from '../lib/date'
import { formatDate, formatKg, formatShortDate } from '../lib/format'

/*
  ホーム（使う順に並べる）
  1. はじめる
  2. 今週と今月（先月と比べた伸び）
  3. 筋群ごとの前回（何日前か）
  4. メニュー
  5. 最近の自己ベスト
  6. 直近の履歴
  7. 鍛えた日の記録
  記録が1回もない間は、2・3・5・6・7 の代わりに「最初の1回」のカードを1枚だけ出す
*/
type Props = {
  /** トレーニング中なら、その開始時刻（なければ null） */
  activeStartedAt: number | null
  onStart: () => void
  onOpenSettings: () => void
  /** メニューを直す（null なら新しく作る） */
  onEditTemplate: (templateId: string | null) => void
  /** メニューからはじめる */
  onStartTemplate: (templateId: string) => void
  /** 履歴を開く（sessionId があればその詳細） */
  onOpenHistory: (sessionId?: string) => void
}

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const RECORD_LABEL = { maxWeight: '最高', e1rm: '推定1RM', maxVolume: '総挙上量' } as const

export function HomeScreen({ activeStartedAt, onStart, onOpenSettings, onEditTemplate, onStartTemplate, onOpenHistory }: Props) {
  const today = startOfDay(Date.now())
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), i))

  // 草の表の期間（17週前の月曜〜今日）の、日ごとのセット数。今週の印にも使う
  const from = addDays(startOfWeek(today), -7 * (HEATMAP_WEEKS - 1))
  const daily = useLiveQuery(() => getDailySets(from, addDays(today, 1)), [from, today])
  const home = useLiveQuery(() => getHomeData(), [])
  const templates = useLiveQuery(() => listTemplates(), [])

  const doneDays = new Set(week.map((d) => dayKey(d)).filter((k) => daily?.has(k)))
  const first = home !== undefined && home.total === 0

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

      {/* 1. はじめる */}
      <div className="card start-card">
        <p className="start-date num">{formatDate(today)}</p>
        <h1 className="start-title">今日のトレーニング</h1>
        <p className="start-sub">
          {activeStartedAt ? 'トレーニングの途中です。続きから記録できます' : 'メニューや前回と同じ種目からはじめられます'}
        </p>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={onStart}>
          <Play strokeWidth={2} aria-hidden />
          {activeStartedAt ? '続ける' : 'はじめる'}
        </button>
      </div>

      {first && (
        // 記録が1回もないとき：空のカードを並べず、これだけ
        <div className="card first-card">
          <h2 className="first-title">最初の1回を記録しよう</h2>
          <ol className="first-steps">
            <li>
              <span className="first-no num">1</span>「はじめる」を押して、種目を選ぶ
            </li>
            <li>
              <span className="first-no num">2</span>重量と回数を入れて「セット完了」
            </li>
            <li>
              <span className="first-no num">3</span>終えたら、振り返りと共有画像
            </li>
          </ol>
          <p className="field-help">記録がたまると、ここに今週の日数・今月の伸び・自己ベスト・鍛えた日の記録が出ます。</p>
        </div>
      )}

      {home && !first && (
        <>
          {/* 2. 今週と今月 */}
          <div className="card">
            <div className="row-between">
              <h2 className="section-title">今週</h2>
              <span className="week-count num">{doneDays.size}日</span>
            </div>
            <ol className="week">
              {week.map((d, i) => (
                <li key={d} className="week-day" data-today={d === today || undefined} data-done={doneDays.has(dayKey(d)) || undefined}>
                  <span className="week-name">{WEEKDAYS[i]}</span>
                  <span className="week-mark num">{new Date(d).getDate()}</span>
                </li>
              ))}
            </ol>
            <MonthCompare now={home.thisMonth} prev={home.lastMonth} />
          </div>

          {/* 3. 筋群ごとの前回 */}
          <div>
            <h2 className="section-title">筋群ごとの前回</h2>
            <div className="card since-grid">
              {MUSCLE_GROUPS.filter((g) => g.id !== 'other' || home.lastByGroup.has('other')).map((g) => {
                const last = home.lastByGroup.get(g.id)
                const days = last === undefined ? null : Math.round((today - last) / 86400000)
                return (
                  <div key={g.id} className="since" style={groupColor(g.id)} data-none={days === null || undefined}>
                    <MuscleIcon group={g.id} className="since-svg" />
                    <span className="since-name">{g.name}</span>
                    <span className="since-days num">{days === null ? 'まだ' : days === 0 ? '今日' : `${days}日前`}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* 4. メニュー：押すと直す、▶ でそのメニューからはじめる */}
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

      {home && !first && (
        <>
          {/* 5. 最近の自己ベスト */}
          <div>
            <h2 className="section-title">最近の自己ベスト</h2>
            {home.records.length === 0 ? (
              <div className="card">
                <EmptyState icon={Trophy} text="前回より伸びると、ここに自己ベストが出ます" />
              </div>
            ) : (
              <ul className="card list">
                {home.records.map((r) => (
                  <li key={`${r.sessionId}-${r.exerciseId}`}>
                    <button type="button" className="list-row list-row-btn home-row" onClick={() => onOpenHistory(r.sessionId)}>
                      <span className="pr-badge" aria-hidden>
                        <Trophy strokeWidth={2.2} />
                      </span>
                      <span className="home-row-text">
                        <span className="list-name">{r.exerciseName}</span>
                        <span className="list-sub num">
                          {r.items
                            .map((i) => `${RECORD_LABEL[i.type]} ${i.type === 'maxVolume' ? formatNumber(i.value) : formatKg(i.value)}kg`)
                            .join('・')}
                        </span>
                      </span>
                      <span className="list-count num">{formatShortDate(r.achievedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 6. 直近の履歴 */}
          <div>
            <div className="row-between">
              <h2 className="section-title">直近の履歴</h2>
              <button type="button" className="link-btn section-link" onClick={() => onOpenHistory()}>
                すべて見る
                <ChevronRight strokeWidth={2} aria-hidden />
              </button>
            </div>
            <ul className="card list">
              {home.recent.map((r) => (
                <li key={r.id}>
                  <button type="button" className="list-row list-row-btn home-row" onClick={() => onOpenHistory(r.id)}>
                    <span className="home-row-text">
                      <span className="home-row-top">
                        <span className="list-name num">{formatDate(r.startedAt)}</span>
                        <span className="template-dots">
                          {r.groups.map((g) => (
                            <span key={g} className="cal-dot" style={groupColor(g)} />
                          ))}
                        </span>
                      </span>
                      <span className="list-sub home-names">{r.names.join('・')}</span>
                    </span>
                    <span className="home-stats num">
                      <span>{r.sets}セット</span>
                      {r.volume > 0 && <span>{formatNumber(r.volume)}kg</span>}
                    </span>
                    <ChevronRight className="chev" strokeWidth={2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 7. 鍛えた日の記録 */}
          <div>
            <h2 className="section-title">鍛えた日の記録</h2>
            {daily && <TrainingHeatmapList daily={daily} today={today} />}
          </div>
        </>
      )}
    </section>
  )
}

/** 今月と先月の比較：回数・総挙上量・自己ベスト */
function MonthCompare({ now, prev }: { now: MonthStats; prev: MonthStats }) {
  const items = [
    { label: '回数', value: `${now.count}`, unit: '回', diff: now.count - prev.count, unitDiff: '回' },
    { label: '総挙上量', value: formatNumber(Math.round(now.volume)), unit: 'kg', diff: now.volume - prev.volume, unitDiff: 'kg' },
    { label: '自己ベスト', value: `${now.records}`, unit: '件', diff: now.records - prev.records, unitDiff: '件' },
  ]
  return (
    <div className="month-compare">
      <p className="mc-head">
        今月<span>下の数字は先月との差</span>
      </p>
      {items.map((i) => {
        const d = Math.round(i.diff * 10) / 10
        return (
          <div key={i.label} className="mc">
            <span className="mc-label">{i.label}</span>
            <span className="mc-value num">
              {i.value}
              <small>{i.unit}</small>
            </span>
            <span className="mc-diff num" data-up={d > 0 || undefined}>
              {d > 0 ? '+' : d < 0 ? '−' : '±'}
              {formatNumber(Math.round(Math.abs(d)))}
              {i.unitDiff}
            </span>
          </div>
        )
      })}
    </div>
  )
}
