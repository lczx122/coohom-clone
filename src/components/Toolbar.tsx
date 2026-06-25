import { useRef } from 'react'
import { useDesignStore } from '../store/useDesignStore'
import { company } from '../config/company'
import type { Tool } from '../types'

const TOOLS: { tool: Tool; label: string; icon: string; hint: string }[] = [
  { tool: 'select', label: 'Select', icon: '⇖', hint: 'Select / move (V)' },
  { tool: 'wall', label: 'Wall', icon: '╱', hint: 'Draw walls (W)' },
  { tool: 'door', label: 'Door', icon: '⌶', hint: 'Add door (D)' },
  { tool: 'window', label: 'Window', icon: '□', hint: 'Add window (N)' },
  { tool: 'pan', label: 'Pan', icon: '✋', hint: 'Pan view (H)' },
]

export default function Toolbar({
  view,
  setView,
}: {
  view: '2d' | '3d'
  setView: (v: '2d' | '3d') => void
}) {
  const tool = useDesignStore((s) => s.tool)
  const setTool = useDesignStore((s) => s.setTool)
  const undo = useDesignStore((s) => s.undo)
  const redo = useDesignStore((s) => s.redo)
  const canUndo = useDesignStore((s) => s.past.length > 0)
  const canRedo = useDesignStore((s) => s.future.length > 0)
  const newPlan = useDesignStore((s) => s.newPlan)
  const exportSnapshot = useDesignStore((s) => s.exportSnapshot)
  const loadSnapshot = useDesignStore((s) => s.loadSnapshot)
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const data = JSON.stringify(exportSnapshot(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'floorplan.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        loadSnapshot(JSON.parse(String(reader.result)))
      } catch {
        alert('Could not parse that file as a floor plan.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="topbar">
      <div className="brand">
        <span className="name" style={{ color: company.brandColor }}>
          {company.name}
        </span>
        <span className="tag">{company.tagline}</span>
      </div>

      <div className="tool-group">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            className={`tool-btn ${tool === t.tool ? 'active' : ''}`}
            title={t.hint}
            onClick={() => setTool(t.tool)}
            disabled={view === '3d'}
          >
            <span className="ico">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        Undo
      </button>
      <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        Redo
      </button>

      <div className="spacer" />

      <button className="icon-btn" onClick={() => fileRef.current?.click()}>
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={doImport}
      />
      <button className="icon-btn" onClick={doExport}>
        Export
      </button>
      <button
        className="icon-btn"
        onClick={() => {
          if (confirm('Start a new, empty plan?')) newPlan()
        }}
      >
        New
      </button>

      <div className="view-toggle" style={{ position: 'static' }}>
        <button
          className={`tool-btn ${view === '2d' ? 'active' : ''}`}
          onClick={() => setView('2d')}
          style={{ minWidth: 40 }}
        >
          2D
        </button>
        <button
          className={`tool-btn ${view === '3d' ? 'active' : ''}`}
          onClick={() => setView('3d')}
          style={{ minWidth: 40 }}
        >
          3D
        </button>
      </div>
    </div>
  )
}
