import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { StartDialog } from './components/StartDialog'
import { TabBar } from './components/TabBar'
import type { TabId } from './components/TabBar'
import { useToast } from './components/Toast'
import { getActiveSession } from './data/workout'
import { ExercisesScreen } from './screens/ExercisesScreen'
import { HomeScreen } from './screens/HomeScreen'
import { AnalysisScreen, HistoryScreen } from './screens/PlaceholderScreens'
import { WorkoutScreen } from './screens/WorkoutScreen'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [inWorkout, setInWorkout] = useState(false)
  const [starting, setStarting] = useState(false)
  const toast = useToast()

  // トレーニング中のもの（なければ null）。中身が変わると自動で更新される
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, [])

  // アプリを開いたとき、トレーニングの途中だったら、その画面から続ける
  const resumed = useRef(false)
  useEffect(() => {
    if (active === undefined || resumed.current) return
    resumed.current = true
    if (active) setInWorkout(true)
  }, [active])

  if (inWorkout && active) {
    return (
      <div className="app app-workout">
        <WorkoutScreen
          sessionId={active.id}
          onExit={(message) => {
            setInWorkout(false)
            setTab('home')
            toast.show(message)
          }}
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
          onStart={() => (active ? setInWorkout(true) : setStarting(true))}
          onOpenSettings={() => toast.show('設定は段階12で作ります')}
        />
      )}
      {tab === 'history' && <HistoryScreen />}
      {tab === 'analysis' && <AnalysisScreen />}
      {tab === 'exercises' && <ExercisesScreen onToast={toast.show} />}

      <TabBar current={tab} onChange={setTab} />
      {starting && (
        <StartDialog
          onClose={() => setStarting(false)}
          onStarted={() => {
            setStarting(false)
            setInWorkout(true)
          }}
        />
      )}
      {toast.node}
    </div>
  )
}
