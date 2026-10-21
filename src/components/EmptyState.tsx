import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// 空のとき：何をすればいいかを1行で＋必要ならボタン
type Props = {
  icon: LucideIcon
  text: string
  action?: ReactNode
  // アイコンの色（なければ白黒のまま）
  tint?: string
}

export function EmptyState({ icon: Icon, text, action, tint }: Props) {
  return (
    <div className="empty">
      <span className="empty-icon" style={tint ? ({ '--tint': tint } as React.CSSProperties) : undefined}>
        <Icon strokeWidth={2} aria-hidden />
      </span>
      <p className="empty-text">{text}</p>
      {action}
    </div>
  )
}
