import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import Catalog from './components/Catalog'
import PropertiesPanel from './components/PropertiesPanel'
import FloorPlanCanvas from './components/FloorPlanCanvas'
import View3D from './components/View3D'
import StatusBar from './components/StatusBar'
import { useDesignStore } from './store/useDesignStore'

export default function App() {
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const setTool = useDesignStore((s) => s.setTool)
  const deleteSelection = useDesignStore((s) => s.deleteSelection)
  const undo = useDesignStore((s) => s.undo)
  const redo = useDesignStore((s) => s.redo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // don't hijack typing in inputs
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }

      switch (e.key) {
        case 'v':
        case 'V':
          setTool('select')
          break
        case 'w':
        case 'W':
          setTool('wall')
          break
        case 'd':
        case 'D':
          setTool('door')
          break
        case 'n':
        case 'N':
          setTool('window')
          break
        case 'h':
        case 'H':
          setTool('pan')
          break
        case 'Delete':
        case 'Backspace':
          deleteSelection()
          break
        case 'r':
        case 'R': {
          const st = useDesignStore.getState()
          if (st.selection?.kind === 'item') {
            const it = st.items.find((x) => x.id === st.selection!.id)
            if (it) st.updateItem(it.id, { rotation: it.rotation + Math.PI / 12 })
          }
          break
        }
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool, deleteSelection, undo, redo])

  return (
    <div className="app">
      <Toolbar view={view} setView={setView} />
      <Catalog />
      {view === '2d' ? <FloorPlanCanvas /> : <View3D />}
      <PropertiesPanel />
      <StatusBar />
    </div>
  )
}
