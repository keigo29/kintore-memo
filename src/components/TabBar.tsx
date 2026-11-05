import { ChartLine, Dumbbell, History, House, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// 下のタブで切り替える5つの画面
export type TabId = 'home' | 'history' | 'skills' | 'analysis' | 'exercises'

const TABS: { id: TabId; name: string; icon: LucideIcon }[] = [
  { id: 'home', name: 'ホーム', icon: House },
  { id: 'history', name: '履歴', icon: History },
  { id: 'skills', name: 'スキル', icon: Zap },
  { id: 'analysis', name: '分析', icon: ChartLine },
  { id: 'exercises', name: '種目', icon: Dumbbell },
]

type Props = {
  current: TabId
  onChange: (id: TabId) => void
  /** 小さな点を付けるタブ（まだ見ていないスキルの解放があるときなど） */
  dots?: TabId[]
}

export function TabBar({ current, onChange, dots = [] }: Props) {
  return (
    <nav className="tabbar" aria-label="メインのタブ">
      <div className="tabbar-inner">
        {TABS.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="tab"
            aria-current={current === id ? 'page' : undefined}
            onClick={() => onChange(id)}
          >
            <span className="tab-icon">
              <Icon strokeWidth={2} aria-hidden />
              {dots.includes(id) && <span className="tab-dot" aria-label="新しいお知らせ" />}
            </span>
            <span className="tab-name">{name}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
