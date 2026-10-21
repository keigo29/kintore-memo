import { useId } from 'react'

// ロゴのダンベル（アプリアイコンと同じ、白に近い銀色のグラデーション）
export function BrandMark() {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".32" stopColor="#e4e7eb" />
          <stop offset=".5" stopColor="#fbfcfd" />
          <stop offset=".72" stopColor="#c6ccd4" />
          <stop offset="1" stopColor="#f1f3f5" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${id})`}>
        <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" />
        <path d="m2.5 21.5 1.4-1.4" />
        <path d="m20.1 3.9 1.4-1.4" />
        <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />
        <path d="m9.6 14.4 4.8-4.8" />
      </g>
    </svg>
  )
}
