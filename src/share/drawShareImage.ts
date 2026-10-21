import { C, FONT_JP, FONT_MONO, H, PAD, SIZE, W } from './shareLayout'
import type { ShareContent } from './shareLayout'

/*
  共有画像を Canvas に描いて、PNG にする
  ・描く前に、使う文字のフォントを読みこみ終わるまで待つ（待たないと別の字形で描かれる）
  ・入りきらないときは scale を 1 → 0.62 まで少しずつ下げて、全部が収まる大きさを探す
  ・1行に入りきらない文字は、小さくして、それでも入らなければ「…」で切る
*/

const DUMBBELL = [
  'M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z',
  'm2.5 21.5 1.4-1.4',
  'm20.1 3.9 1.4-1.4',
  'M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z',
  'm9.6 14.4 4.8-4.8',
]
const TROPHY = [
  'M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2',
  'M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2',
  'M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3',
  'M4 22h16',
  'M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z',
  'M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3',
]

const font = (weight: number, size: number, family: string) => `${weight} ${Math.round(size)}px ${family}`

/** 使う文字のフォントを読みこむ（日本語フォントは使う文字の分だけ読みこまれるので、文字を渡す） */
async function loadFonts(content: ShareContent) {
  const jpText = [
    '筋トレメモ',
    ...content.groups.map((g) => g.name),
    ...content.growth.map((g) => g.name),
    content.note ?? '',
    content.message ?? '',
    'きつさ',
  ].join('')
  const monoText = '0123456789.,:+-/ ABCDEFGHIJKLMNOPQRSTUVWXYZkg' + content.date
  try {
    await Promise.all([
      document.fonts.load(font(700, 40, FONT_JP), jpText),
      document.fonts.load(font(500, 40, FONT_JP), jpText),
      document.fonts.load(font(600, 40, FONT_MONO), monoText),
      document.fonts.load(font(500, 40, FONT_MONO), monoText),
      document.fonts.load(font(700, 40, FONT_MONO), content.message ?? 'A'),
    ])
  } catch {
    // 読みこめなくても、端末の文字で描く
  }
}

/** 字間をあけて描く（Canvas の letterSpacing は端末によって使えないため、1文字ずつ置く） */
function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  return [...text].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, 0) - spacing
}
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

/** 1行に収める：大きさを minRatio まで下げ、それでも入らなければ末尾を「…」に */
function fitLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: number, size: number, family: string, minRatio = 0.7) {
  let s = size
  ctx.font = font(weight, s, family)
  while (ctx.measureText(text).width > maxWidth && s > size * minRatio) {
    s -= 2
    ctx.font = font(weight, s, family)
  }
  if (ctx.measureText(text).width <= maxWidth) return { text, size: s }
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return { text: t + '…', size: s }
}

// 行の頭に来てはいけない文字（句読点・閉じかっこ・小さい文字など）
const NO_LINE_START = '、。，．,.）」』】〕!?！？ー…ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ”’'

/** 折り返し：maxLines を超えたら最後の行を「…」に。句読点や小さい文字では行を始めない */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of [...text.replace(/\s+/g, ' ')]) {
    if (ctx.measureText(line + ch).width <= maxWidth || !line) {
      line += ch
    } else if (!NO_LINE_START.includes(ch)) {
      lines.push(line)
      line = ch === ' ' ? '' : ch
    } else if (line.length > 1) {
      // 行の頭に来てはいけない文字は、前の1文字といっしょに次の行へ送る（右端をはみ出さない）
      lines.push(line.slice(0, -1))
      line = line.slice(-1) + ch
    } else line += ch
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1)
    kept[maxLines - 1] = last + '…'
    return kept
  }
  return lines
}

function drawIcon(ctx: CanvasRenderingContext2D, paths: string[], x: number, y: number, size: number, stroke: string | CanvasGradient, width = 2) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke
  for (const d of paths) ctx.stroke(new Path2D(d))
  ctx.restore()
}

/** 全体を描く。dry が true なら描かずに高さだけ測る。extra はロゴの下に足す余白（項目が少ないとき） */
function layout(ctx: CanvasRenderingContext2D, c: ShareContent, s: number, dry: boolean, extra = 0): number {
  const inner = W - PAD * 2
  let y = 120

  // ---- ロゴ（アプリアイコンと同じ、黒地に銀のダンベル）と名前 ----
  const logo = 76
  if (!dry) {
    const g = ctx.createLinearGradient(0, 0, logo, logo)
    g.addColorStop(0, '#3a3b3f')
    g.addColorStop(1, '#151517')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(PAD, y, logo, logo, 18)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.18)'
    ctx.lineWidth = 2
    ctx.stroke()
    const silver = ctx.createLinearGradient(PAD, y, PAD + logo, y + logo)
    silver.addColorStop(0, '#ffffff')
    silver.addColorStop(0.5, '#e4e7eb')
    silver.addColorStop(1, '#c6ccd4')
    drawIcon(ctx, DUMBBELL, PAD + 16, y + 16, logo - 32, silver, 2.2)
    ctx.fillStyle = C.text
    ctx.font = font(700, SIZE.brand, FONT_JP)
    ctx.textBaseline = 'middle'
    ctx.fillText('筋トレメモ', PAD + logo + 24, y + logo / 2 + 2)
  }
  y += logo + 120 * s + extra

  // ---- WORKOUT COMPLETE と日付 ----
  ctx.textBaseline = 'alphabetic'
  ctx.font = font(500, SIZE.kicker * s, FONT_MONO)
  if (!dry) {
    ctx.fillStyle = C.sub
    drawSpaced(ctx, 'WORKOUT COMPLETE', PAD, y, 10 * s)
  }
  y += 24 * s + SIZE.date * s
  if (!dry) {
    ctx.fillStyle = C.text
    ctx.font = font(600, SIZE.date * s, FONT_MONO)
    drawSpaced(ctx, c.date, PAD - 4, y, -2 * s)
  }
  y += 52 * s

  // ---- 鍛えた筋群（色の点つきの札） ----
  if (c.groups.length) {
    ctx.font = font(700, SIZE.chip * s, FONT_JP)
    const h = 66 * s
    let x = PAD
    for (const g of c.groups) {
      const w = ctx.measureText(g.name).width + 76 * s
      if (x + w > PAD + inner) {
        x = PAD
        y += h + 14 * s
      }
      if (!dry) {
        ctx.fillStyle = C.card
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, 6)
        ctx.fill()
        ctx.fillStyle = g.color
        ctx.beginPath()
        ctx.arc(x + 30 * s, y + h / 2, 10 * s, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = C.text
        ctx.textBaseline = 'middle'
        ctx.fillText(g.name, x + 52 * s, y + h / 2 + 2)
        ctx.textBaseline = 'alphabetic'
      }
      x += w + 14 * s
    }
    y += h + 64 * s
  } else y += 24 * s

  // ---- 大きな数字（左に小さなラベル、その下に大きな値） ----
  for (const st of c.stats) {
    if (!dry) {
      ctx.fillStyle = C.line
      ctx.fillRect(PAD, y, inner, 2)
    }
    y += 52 * s
    if (!dry) {
      ctx.fillStyle = C.sub
      ctx.font = font(500, SIZE.statLabel * s, FONT_MONO)
      drawSpaced(ctx, st.label, PAD, y, 6 * s)
    }
    y += 22 * s + SIZE.statValue * s * 0.82
    if (!dry) {
      ctx.font = font(600, SIZE.statValue * s, FONT_MONO)
      ctx.fillStyle = C.text
      const unitGap = st.unit ? 20 * s : 0
      ctx.font = font(600, SIZE.statUnit * s, FONT_MONO)
      const unitW = st.unit ? spacedWidth(ctx, st.unit, 3 * s) : 0
      const fitted = fitLine(ctx, st.value, inner - unitW - unitGap, 600, SIZE.statValue * s, FONT_MONO)
      ctx.font = font(600, fitted.size, FONT_MONO)
      ctx.fillText(fitted.text, PAD - 4, y)
      const vw = ctx.measureText(fitted.text).width
      if (st.unit) {
        ctx.fillStyle = C.sub
        ctx.font = font(600, SIZE.statUnit * s, FONT_MONO)
        drawSpaced(ctx, st.unit, PAD + vw + unitGap, y, 3 * s)
      }
    }
    y += 40 * s
  }

  // ---- きつさ（主観なので、数字の下に分けて出す） ----
  if (c.effort !== null) {
    if (!dry) {
      ctx.fillStyle = C.line
      ctx.fillRect(PAD, y, inner, 2)
    }
    y += 52 * s
    if (!dry) {
      ctx.fillStyle = C.sub
      ctx.font = font(500, SIZE.statLabel * s, FONT_MONO)
      drawSpaced(ctx, 'EFFORT', PAD, y, 6 * s)
      const lw = spacedWidth(ctx, 'EFFORT', 6 * s)
      ctx.font = font(500, SIZE.statLabel * s, FONT_JP)
      ctx.fillText('（きつさ・自分の感じ方）', PAD + lw + 10 * s, y)
    }
    y += 22 * s + SIZE.statValue * s * 0.82
    if (!dry) {
      ctx.fillStyle = C.text
      ctx.font = font(600, SIZE.statValue * s, FONT_MONO)
      ctx.fillText(String(c.effort), PAD - 4, y)
      const vw = ctx.measureText(String(c.effort)).width
      ctx.fillStyle = C.sub
      ctx.font = font(600, SIZE.statUnit * s, FONT_MONO)
      ctx.fillText('/ 10', PAD + vw + 20 * s, y)
    }
    y += 40 * s
  }

  // ---- 伸び（前回より上がった種目・自己ベスト）：緑で強調するカード ----
  if (c.growth.length) {
    y += 28 * s
    const rows = c.growth.slice(0, 4)
    const rowH = 64 * s
    const top = 92 * s
    const h = top + rows.length * rowH + 30 * s + (c.growth.length > rows.length ? 44 * s : 0)
    if (!dry) {
      ctx.fillStyle = C.okSoft
      ctx.beginPath()
      ctx.roundRect(PAD, y, inner, h, 8)
      ctx.fill()
      ctx.fillStyle = C.ok
      ctx.fillRect(PAD, y, 8, h)
      drawIcon(ctx, TROPHY, PAD + 40 * s, y + 30 * s, 38 * s, C.ok, 2.2)
      ctx.fillStyle = C.ok
      ctx.font = font(600, SIZE.growthTitle * s, FONT_MONO)
      drawSpaced(ctx, 'GROWTH', PAD + 92 * s, y + 60 * s, 6 * s)
      rows.forEach((r, i) => {
        const ry = y + top + i * rowH + rowH * 0.62
        const right = [r.change, r.record ? 'PR' : null].filter(Boolean).join('  ')
        ctx.font = font(600, SIZE.growthValue * s, FONT_MONO)
        const rw = ctx.measureText(right).width
        ctx.fillStyle = C.ok
        ctx.fillText(right, PAD + inner - 40 * s - rw, ry)
        const name = fitLine(ctx, r.name, inner - 120 * s - rw, 700, SIZE.growthName * s, FONT_JP, 0.8)
        ctx.fillStyle = C.text
        ctx.font = font(700, name.size, FONT_JP)
        ctx.fillText(name.text, PAD + 40 * s, ry)
      })
      if (c.growth.length > rows.length) {
        ctx.fillStyle = C.sub
        ctx.font = font(500, 28 * s, FONT_JP)
        ctx.fillText(`ほか ${c.growth.length - rows.length} 種目`, PAD + 40 * s, y + h - 30 * s)
      }
    }
    y += h
  }

  // ---- メモ（自分で選んだときだけ） ----
  if (c.note) {
    y += 56 * s
    ctx.font = font(500, SIZE.note * s, FONT_JP)
    const lines = wrap(ctx, `“${c.note}”`, inner, 3)
    lines.forEach((l, i) => {
      if (!dry) {
        ctx.fillStyle = C.sub
        ctx.fillText(l, PAD, y + i * SIZE.note * s * 1.55 + SIZE.note * s)
      }
    })
    y += lines.length * SIZE.note * s * 1.55
  }

  // ---- メッセージ（下の方に大きく） ----
  if (c.message) {
    y += 90 * s
    const isLatin = /^[\x20-\x7e]+$/.test(c.message)
    ctx.font = font(700, SIZE.message * s, isLatin ? FONT_MONO : FONT_JP)
    const lines = wrap(ctx, c.message, inner, 3)
    lines.forEach((l, i) => {
      if (!dry) {
        ctx.fillStyle = C.text
        ctx.fillText(l, PAD, y + i * SIZE.message * s * 1.35 + SIZE.message * s)
      }
    })
    y += lines.length * SIZE.message * s * 1.35
  }

  return y
}

/** 共有画像を描いて PNG にする */
export async function drawShareImage(content: ShareContent): Promise<Blob> {
  await loadFonts(content)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 入りきる大きさを探す（下に 110px の余白を残す）
  let s = 1
  while (s > 0.62 && layout(ctx, content, s, true) > H - 110) s -= 0.04
  // 項目が少なくて下が空くときは、余りの 4 割をロゴの下に入れて、中身を真ん中寄りにする
  const extra = Math.max(0, H - 160 - layout(ctx, content, s, true)) * 0.4

  // 背景：黒に、左上からうっすら光
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.1, 0, 0, W * 0.1, 0, W * 1.1)
  glow.addColorStop(0, 'rgba(255,255,255,.10)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  layout(ctx, content, s, false, extra)

  // 下の小さな名前
  ctx.fillStyle = '#5b6068'
  ctx.font = font(500, 24, FONT_MONO)
  ctx.textBaseline = 'alphabetic'
  drawSpaced(ctx, 'KINTORE MEMO', PAD, H - 64, 6)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を作れませんでした'))), 'image/png'),
  )
}
