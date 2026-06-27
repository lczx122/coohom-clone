import { useDesignStore } from '../store/useDesignStore'
import type { Tool } from '../types'

const TOOLS: { tool: Tool; label: string; icon: string }[] = [
  { tool: 'select', label: 'Select', icon: '⇖' },
  { tool: 'wall', label: 'Wall', icon: '╱' },
  { tool: 'door', label: 'Door', icon: '⌶' },
  { tool: 'window', label: 'Window', icon: '□' },
  { tool: 'sketch', label: 'Sketch', icon: '✎' },
  { tool: 'pan', label: 'Pan', icon: '✋' },
]

/** Thumb-friendly tool dock anchored to the bottom on touch devices (2D only). */
export default function BottomToolDock() {
  const tool = useDesignStore((s) => s.tool)
  const setTool = useDesignStore((s) => s.setTool)
  return (
    <div className="thumb-dock">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`thumb-btn ${tool === t.tool ? 'active' : ''}`}
          onClick={() => setTool(t.tool)}
        >
          <span className="ico">{t.icon}</span>
          <span className="lbl">{t.label}</span>
        </button>
      ))}
    </div>
  )
}
