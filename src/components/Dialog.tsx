import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/*
  ダイアログ（スマホでは画面の下から出る）
  ・後ろはうす暗く、ぼかし 4px
  ・下のボタン：左に「削除・隠す」など（danger）、右に「キャンセル」と決定（primary）
  ・背景を押す／Esc キーで閉じる
*/
type Props = {
  title: string
  onClose: () => void
  children: ReactNode
  /** 下に並べるボタン */
  footer: ReactNode
}

export function Dialog({ title, onClose, children, footer }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // 開いている間は、後ろの画面がスクロールしないようにする
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialog-title">{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-footer">{footer}</div>
      </div>
    </div>
  )
}
