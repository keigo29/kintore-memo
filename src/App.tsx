import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { StartDialog } from './components/StartDialog'
import { TabBar } from './components/TabBar'
import type { TabId } from './components/TabBar'
import { useToast } from './components/Toast'
import { db } from './data/db'
import { itemsFromSession, startFromTemplate } from './data/templates'
import type { TemplateItem } from './data/templates'
import { getActiveSession, startSession } from './data/workout'
import { formatDate } from './lib/format'
import { ExercisesScreen } from './screens/ExercisesScreen'
import { HomeScreen } from './screens/HomeScreen'
import { HistoryDetailScreen } from './screens/HistoryDetailScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { AnalysisScreen } from './screens/PlaceholderScreens'
import { ReviewScreen } from './screens/ReviewScreen'
import { ShareScreen } from './screens/ShareScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { TemplateEditScreen } from './screens/TemplateEditScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'

/*
  いま出している画面
  ・tabs：下のタブの4画面
  ・workout：トレーニング中 → review：振り返り → summary：トレーニング終了 → share：共有画像
  ・履歴の詳細は historyDetail で持つ（共有画像から戻ったときも、同じ詳細に戻る）
  ・template：メニューを作る・直す（閉じたら元のタブへ）
  トレーニング中〜終了の間は、下のタブを出さない
*/
type View =
  | { kind: 'tabs' }
  | { kind: 'workout' }
  | { kind: 'review' }
  | { kind: 'summary'; sessionId: string }
  | { kind: 'share'; sessionId: string; from: 'summary' | 'history' }
  | { kind: 'template'; id: string | null; initial?: { name: string; items: TemplateItem[] } }

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [view, setView] = useState<View>({ kind: 'tabs' })
  const [starting, setStarting] = useState(false)
  // 履歴で開いている詳細（共有画像から戻ったときも、同じ詳細に戻れるよう App で持つ）
  const [historyDetail, setHistoryDetail] = useState<string | null>(null)
  const toast = useToast()

  // トレーニング中のもの（なければ null）。中身が変わると自動で更新される
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, [])

  // アプリを開いたとき、トレーニングの途中だったら、その画面から続ける
  const resumed = useRef(false)
  useEffect(() => {
    if (active === undefined || resumed.current) return
    resumed.current = true
    if (active) setView({ kind: 'workout' })
  }, [active])

  const backHome = (message?: string) => {
    setView({ kind: 'tabs' })
    setTab('home')
    if (message) toast.show(message)
  }

  if (view.kind === 'template') {
    return (
      <div className="app app-workout">
        <TemplateEditScreen
          templateId={view.id}
          initial={view.initial}
          onClose={(message) => {
            setView({ kind: 'tabs' })
            if (message) toast.show(message)
          }}
        />
        {toast.node}
      </div>
    )
  }

  if (view.kind === 'share') {
    const { sessionId } = view
    return (
      <div className="app app-workout">
        <ShareScreen
          sessionId={sessionId}
          onBack={() => setView(view.from === 'summary' ? { kind: 'summary', sessionId } : { kind: 'tabs' })}
          onToast={toast.show}
        />
        {toast.node}
      </div>
    )
  }

  if (view.kind === 'summary') {
    return (
      <div className="app app-workout">
        <SummaryScreen
          sessionId={view.sessionId}
          onClose={() => backHome()}
          onShare={(sessionId) => setView({ kind: 'share', sessionId, from: 'summary' })}
        />
        {toast.node}
      </div>
    )
  }

  if ((view.kind === 'workout' || view.kind === 'review') && active) {
    return (
      <div className="app app-workout">
        {view.kind === 'workout' ? (
          <WorkoutScreen sessionId={active.id} onExit={backHome} onReview={() => setView({ kind: 'review' })} />
        ) : (
          <ReviewScreen
            sessionId={active.id}
            onBack={() => setView({ kind: 'workout' })}
            onSaved={(sessionId) => setView({ kind: 'summary', sessionId })}
            onDiscarded={() => backHome('記録せずに終えました')}
          />
        )}
        {toast.node}
      </div>
    )
  }

  // 過去のトレーニングと同じ種目ではじめる
  const startCopy = async (sessionId: string) => {
    if (active) {
      toast.show('トレーニングの途中です。先に終えてください')
      return
    }
    await startSession(sessionId)
    setHistoryDetail(null)
    setView({ kind: 'workout' })
  }

  // メニューからはじめる
  const startTemplate = async (templateId: string) => {
    if (active) {
      toast.show('トレーニングの途中です。先に終えてください')
      return
    }
    if (await startFromTemplate(templateId)) setView({ kind: 'workout' })
  }

  // 過去の記録から、メニューを作る（名前は日付から。保存前に変えられる）
  const makeTemplate = async (sessionId: string) => {
    const items = await itemsFromSession(sessionId)
    const s = await db.sessions.get(sessionId)
    setView({ kind: 'template', id: null, initial: { name: s ? `${formatDate(s.startedAt, false)} のメニュー` : '', items } })
  }

  // 履歴の詳細（下のタブは出さない）
  if (tab === 'history' && historyDetail) {
    return (
      <div className="app app-workout">
        <HistoryDetailScreen
          key={historyDetail}
          sessionId={historyDetail}
          onBack={() => setHistoryDetail(null)}
          onShare={(sessionId) => setView({ kind: 'share', sessionId, from: 'history' })}
          onStartCopy={startCopy}
          onMakeTemplate={makeTemplate}
          onToast={toast.show}
        />
        {toast.node}
      </div>
    )
  }

  return (
    <div className="app">
      {tab === 'home' && (
        <HomeScreen
          activeStartedAt={active?.startedAt ?? null}
          onStart={() => (active ? setView({ kind: 'workout' }) : setStarting(true))}
          onOpenSettings={() => toast.show('設定は段階12で作ります')}
          onEditTemplate={(id) => setView({ kind: 'template', id })}
          onStartTemplate={startTemplate}
        />
      )}
      {tab === 'history' && <HistoryScreen onOpen={setHistoryDetail} />}
      {tab === 'analysis' && <AnalysisScreen />}
      {tab === 'exercises' && <ExercisesScreen onToast={toast.show} />}

      <TabBar current={tab} onChange={setTab} />
      {starting && (
        <StartDialog
          onClose={() => setStarting(false)}
          onStarted={() => {
            setStarting(false)
            setView({ kind: 'workout' })
          }}
        />
      )}
      {toast.node}
    </div>
  )
}
