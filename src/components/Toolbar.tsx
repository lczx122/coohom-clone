import { useRef } from 'react'
import { useDesignStore } from '../store/useDesignStore'
import { useAuthStore } from '../store/useAuthStore'
import { company } from '../config/company'
import { sampleList } from '../data/samples'
import type { Tool } from '../types'
import type { Unit } from '../lib/units'

const TOOLS: { tool: Tool; label: string; icon: string; hint: string }[] = [
  { tool: 'select', label: 'Select', icon: '⇖', hint: 'Select / move (V)' },
  { tool: 'wall', label: 'Wall', icon: '╱', hint: 'Draw walls (W)' },
  { tool: 'door', label: 'Door', icon: '⌶', hint: 'Add door (D)' },
  { tool: 'window', label: 'Window', icon: '□', hint: 'Add window (N)' },
  { tool: 'sketch', label: 'Sketch', icon: '✎', hint: 'Sketch → cabinets (K)' },
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
  const exportSnapshot = useDesignStore((s) => s.exportSnapshot)
  const loadSnapshot = useDesignStore((s) => s.loadSnapshot)
  const unit = useDesignStore((s) => s.unit)
  const setUnit = useDesignStore((s) => s.setUnit)

  const projects = useDesignStore((s) => s.projects)
  const currentProjectId = useDesignStore((s) => s.currentProjectId)
  const currentProjectName = useDesignStore((s) => s.currentProjectName)
  const newProject = useDesignStore((s) => s.newProject)
  const switchProject = useDesignStore((s) => s.switchProject)
  const renameProject = useDesignStore((s) => s.renameProject)
  const deleteProject = useDesignStore((s) => s.deleteProject)
  const loadSample = useDesignStore((s) => s.loadSample)

  const authStatus = useAuthStore((s) => s.status)
  const authEmail = useAuthStore((s) => s.email)
  const syncing = useAuthStore((s) => s.syncing)
  const signOut = useAuthStore((s) => s.signOut)

  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const data = JSON.stringify(exportSnapshot(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProjectName || 'floorplan'}.json`
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

      {/* Projects */}
      <div className="proj-group">
        <select
          className="proj-select"
          value={currentProjectId}
          onChange={(e) => switchProject(e.target.value)}
          title="Switch project"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="icon-btn"
          title="New project"
          onClick={() => {
            const name = prompt('New project name:', 'Untitled Plan')
            if (name !== null) newProject(name.trim() || 'Untitled Plan')
          }}
        >
          ＋
        </button>
        <button
          className="icon-btn"
          title="Rename project"
          onClick={() => {
            const name = prompt('Rename project:', currentProjectName)
            if (name !== null && name.trim()) renameProject(currentProjectId, name.trim())
          }}
        >
          ✎
        </button>
        <button
          className="icon-btn"
          title="Delete project"
          onClick={() => {
            if (confirm(`Delete project "${currentProjectName}"? This cannot be undone.`)) {
              deleteProject(currentProjectId)
            }
          }}
        >
          🗑
        </button>
        <select
          className="proj-select"
          value=""
          title="Load a sample scene"
          onChange={(e) => {
            if (e.target.value) loadSample(e.target.value)
            e.target.value = ''
          }}
        >
          <option value="">Samples…</option>
          {sampleList.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
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

      <select
        className="proj-select"
        value={unit}
        onChange={(e) => setUnit(e.target.value as Unit)}
        title="Display units"
        style={{ minWidth: 56 }}
      >
        <option value="mm">mm</option>
        <option value="m">m</option>
      </select>

      <button className="icon-btn" onClick={() => fileRef.current?.click()}>
        Import
      </button>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={doImport} />
      <button className="icon-btn" onClick={doExport}>
        Export
      </button>

      <div className="view-toggle" style={{ position: 'static' }}>
        <button className={`tool-btn ${view === '2d' ? 'active' : ''}`} onClick={() => setView('2d')} style={{ minWidth: 40 }}>
          2D
        </button>
        <button className={`tool-btn ${view === '3d' ? 'active' : ''}`} onClick={() => setView('3d')} style={{ minWidth: 40 }}>
          3D
        </button>
      </div>

      {authStatus === 'signedIn' && (
        <div className="account">
          <span className="account-email" title={authEmail ?? ''}>
            {syncing ? 'Syncing…' : authEmail}
          </span>
          <button className="icon-btn" onClick={() => signOut()} title="Sign out">
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
