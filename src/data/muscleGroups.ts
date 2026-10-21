// 筋群（カテゴリ）。色は tokens.css の --mg-◯◯-grad を使う
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'other'

export const MUSCLE_GROUPS: { id: MuscleGroup; name: string }[] = [
  { id: 'chest', name: '胸' },
  { id: 'back', name: '背中' },
  { id: 'shoulders', name: '肩' },
  { id: 'arms', name: '腕' },
  // 下半身：脚とお尻をまとめる
  { id: 'legs', name: '下半身' },
  { id: 'core', name: '体幹' },
  { id: 'other', name: 'その他' },
]

// style に渡すと、点や札がその筋群の色になる
export function groupColor(id: MuscleGroup) {
  return { '--dot': `var(--mg-${id})`, '--dot-grad': `var(--mg-${id}-grad)` } as React.CSSProperties
}
