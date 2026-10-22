/*
  iPhone で、下に固定したバー（タブ・ボタンの帯）が上に取り残されるのを直す
  ・iPhone の Safari／ホーム画面のアプリには、次のあと、固定した部品の位置が
    計算し直されず、画面の途中に浮いたままになる不具合がある
      - キーボードを閉じたとき（検索・メモ・名前の入力のあと）
      - 共有シートや別のアプリから戻ってきたとき
      - 画面の向きを変えたとき
  ・1px だけ動かして戻すと、ブラウザが位置を計算し直して、正しい場所に戻る
  ・ふだん（不具合が起きていないとき）は、見た目は何も変わらない
*/

let queued = false

function nudge() {
  if (queued) return
  queued = true
  // キーボードが閉じ切るのを少し待つ
  setTimeout(() => {
    queued = false
    const y = window.scrollY
    window.scrollTo(window.scrollX, y + 1)
    window.scrollTo(window.scrollX, y)
  }, 120)
}

export function installViewportFix(): void {
  // 入力欄からフォーカスが外れた＝キーボードが閉じた
  document.addEventListener('focusout', (e) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) nudge()
  })
  // 見えている範囲の大きさが変わった（キーボードの開け閉め・向きの変更）
  window.visualViewport?.addEventListener('resize', nudge)
  // 共有シートや別のアプリから戻ってきた
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') nudge()
  })
  window.addEventListener('pageshow', nudge)
  window.addEventListener('orientationchange', nudge)
}
