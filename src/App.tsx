import { useEffect, useRef, useState } from 'react'
import Toolbar from './components/Toolbar'
import Catalog from './components/Catalog'
import PropertiesPanel from './components/PropertiesPanel'
import FloorPlanCanvas from './components/FloorPlanCanvas'
import View3D from './components/View3D'
import StatusBar from './components/StatusBar'
import CabinetEditor from './components/CabinetEditor'
import AuthGate from './components/AuthGate'
import BottomToolDock from './components/BottomToolDock'
import { useDesignStore } from './store/useDesignStore'
import { useAuthStore } from './store/useAuthStore'
import type { Tool } from './types'

export default function App() {
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [touchUI, setTouchUI] = useState(false)

  // touch UI + responsive auto-collapse of sidebars in portrait / narrow layouts
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)')
    const narrow = window.matchMedia('(max-width: 980px), (orientation: portrait)')
    const applyCoarse = () => setTouchUI(coarse.matches)
    const applyNarrow = () => {
      const collapse = narrow.matches
      setLeftCollapsed(collapse)
      setRightCollapsed(collapse)
    }
    applyCoarse()
    applyNarrow()
    coarse.addEventListener('change', applyCoarse)
    narrow.addEventListener('change', applyNarrow)
    return () => {
      coarse.removeEventListener('change', applyCoarse)
      narrow.removeEventListener('change', applyNarrow)
    }
  }, [])
  const setTool = useDesignStore((s) => s.setTool)
  const deleteSelection = useDesignStore((s) => s.deleteSelection)
  const undo = useDesignStore((s) => s.undo)
  const redo = useDesignStore((s) => s.redo)

  const authStatus = useAuthStore((s) => s.status)
  const initAuth = useAuthStore((s) => s.init)
  useEffect(() => {
    initAuth()
  }, [initAuth])

  // hold-Space-to-pan bookkeeping (2D only)
  const spaceActive = useRef(false)
  const prevTool = useRef<Tool>('select')

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')
    }

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return

      // Hold Space -> temporary pan, restoring the previous tool on release (2D only)
      if (e.code === 'Space' && view === '2d') {
        e.preventDefault()
        if (!spaceActive.current) {
          spaceActive.current = true
          prevTool.current = useDesignStore.getState().tool
          // set tool without clearing the current selection
          useDesignStore.setState({ tool: 'pan' })
        }
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

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection()
        return
      }

      // tool shortcuts only apply in 2D (W/A/S/D drive the camera in 3D)
      if (view !== '2d') return

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
        case 'k':
        case 'K':
          setTool('sketch')
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

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spaceActive.current) {
        spaceActive.current = false
        useDesignStore.setState({ tool: prevTool.current })
      }
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [setTool, deleteSelection, undo, redo, view])

  if (authStatus === 'loading') {
    return <div className="auth-screen"><div className="auth-splash">Loading…</div></div>
  }
  if (authStatus === 'signedOut') {
    return <AuthGate />
  }

  const leftW = leftCollapsed ? 0 : 240
  const rightW = rightCollapsed ? 0 : 260

  return (
    <div className="app" style={{ gridTemplateColumns: `${leftW}px 1fr ${rightW}px` }}>
      <Toolbar view={view} />
      {!leftCollapsed && <Catalog />}
      {view === '2d' ? <FloorPlanCanvas /> : <View3D />}
      {!rightCollapsed && <PropertiesPanel />}
      <StatusBar />
      <CabinetEditor />

      {touchUI && view === '2d' && <BottomToolDock />}

      {/* floating 2D/3D view switch — always reachable regardless of toolbar width */}
      <div className="floating-view">
        <button className={`tool-btn ${view === '2d' ? 'active' : ''}`} onClick={() => setView('2d')} style={{ minWidth: 44 }}>
          2D
        </button>
        <button className={`tool-btn ${view === '3d' ? 'active' : ''}`} onClick={() => setView('3d')} style={{ minWidth: 44 }}>
          3D
        </button>
      </div>

      {/* sidebar collapse / expand handles */}
      <button
        className="col-toggle"
        style={{ left: leftCollapsed ? 4 : leftW - 14 }}
        title={leftCollapsed ? 'Show catalog' : 'Hide catalog'}
        onClick={() => setLeftCollapsed((v) => !v)}
      >
        {leftCollapsed ? '›' : '‹'}
      </button>
      <button
        className="col-toggle"
        style={{ right: rightCollapsed ? 4 : rightW - 14 }}
        title={rightCollapsed ? 'Show properties' : 'Hide properties'}
        onClick={() => setRightCollapsed((v) => !v)}
      >
        {rightCollapsed ? '‹' : '›'}
      </button>
    </div>
  )
}
