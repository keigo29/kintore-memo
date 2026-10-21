import { MUSCLE_GROUPS, groupColor } from '../data/muscleGroups'
import type { MuscleGroup } from '../data/muscleGroups'
import type { DailySets } from '../data/stats'
import { MuscleIcon } from './MuscleIcon'
import { HEATMAP_WEEKS, HeatmapLegend, TrainingHeatmap, summarize } from './TrainingHeatmap'

/*
  鍛えた日の記録をまとめて並べる（ホーム用）
  ・いちばん上に「すべて」、その下に筋群ごとの表を縦に並べる（切りかえなしで一覧できる）
  ・それぞれの見出しに、直近17週でやった日数と合計セット数
*/
type Props = {
  daily: DailySets
  today: number
}

export function TrainingHeatmapList({ daily, today }: Props) {
  const rows: { id: MuscleGroup | null; name: string }[] = [
    { id: null, name: 'すべて' },
    ...MUSCLE_GROUPS.map((g) => ({ id: g.id, name: g.name })),
  ]

  return (
    <div className="card hm-list">
      <div className="row-between hm-list-head">
        <span className="list-count">直近{HEATMAP_WEEKS}週</span>
        <HeatmapLegend />
      </div>
      {rows.map(({ id, name }) => {
        const { days, sets } = summarize(daily, today, id)
        return (
          <section key={id ?? 'all'} className="hm-row" style={id ? groupColor(id) : undefined}>
            <header className="hm-row-head">
              {id ? (
                <span className="hm-icon">
                  <MuscleIcon group={id} className="hm-icon-svg" />
                </span>
              ) : null}
              <h3 className="hm-row-name">{name}</h3>
              <span className="hm-row-stat num">
                {days === 0 ? (
                  <span className="hm-none">記録なし</span>
                ) : (
                  <>
                    {days}日<span className="hm-sep">／</span>
                    {sets}セット
                  </>
                )}
              </span>
            </header>
            <TrainingHeatmap daily={daily} today={today} group={id} />
          </section>
        )
      })}
    </div>
  )
}
