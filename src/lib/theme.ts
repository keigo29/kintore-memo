import type { UserSettings } from '../data/types'

/*
  テーマ（ライト／ダーク／端末に合わせる）
  ・色は tokens.css で、<html data-theme="dark"> のときだけダークに入れ替える
  ・「端末に合わせる」は、端末の設定（prefers-color-scheme）を見て light か dark を入れる
    端末の設定が途中で変わっても、すぐ切り替わる
  ・開いた瞬間に白く光らないよう、選んだテーマを localStorage にも残し、
    index.html の小さなスクリプトで画面を出す前に入れる
*/

export type Theme = UserSettings['theme']

export const THEME_KEY = 'kintore-memo:theme'
const COLORS = { light: '#efeff0', dark: '#0b0b0c' }

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
let current: Theme = 'light'

function paint() {
  const resolved = current === 'system' ? (media?.matches ? 'dark' : 'light') : current
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[resolved])
}

media?.addEventListener('change', () => {
  if (current === 'system') paint()
})

export function applyTheme(theme: Theme): void {
  current = theme
  paint()
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 保存できない端末（プライベートモードなど）でも、表示は切り替わる
  }
}
