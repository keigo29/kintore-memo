import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// フォントは同梱（外から読み込まない）
// 英数字：Roboto Mono／日本語：Zen Kaku Gothic New（デザインルールのノートの部分と同じ組み合わせ）
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/500.css'
import '@fontsource/roboto-mono/600.css'
import '@fontsource/zen-kaku-gothic-new/400.css'
import '@fontsource/zen-kaku-gothic-new/500.css'
import '@fontsource/zen-kaku-gothic-new/700.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/home.css'
import './styles/analysis.css'
import App from './App.tsx'
import { requestPersistentStorage } from './data/db'

// 保存したデータが勝手に消されにくくする（結果を待たずに画面を出す）
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
