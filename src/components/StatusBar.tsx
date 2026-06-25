import { useMemo } from 'react'
import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import { company } from '../config/company'
import { dist } from '../lib/geometry'
import { detectRooms } from '../lib/rooms'
import { formatLength } from '../lib/units'

export default function StatusBar() {
  const { walls, openings, items, snapEnabled, orthoEnabled, camera, unit } = useDesignStore()
  const setSnapEnabled = useDesignStore((s) => s.setSnapEnabled)
  const setOrthoEnabled = useDesignStore((s) => s.setOrthoEnabled)

  const rooms = useMemo(() => detectRooms(walls), [walls])
  const totalWall = walls.reduce((sum, w) => sum + dist(w.start, w.end), 0)
  const totalCost = items.reduce((sum, it) => sum + (productById(it.productId)?.price ?? 0), 0)

  return (
    <div className="statusbar">
      <span>
        Walls <span className="chip">{walls.length}</span>
      </span>
      <span>
        Rooms <span className="chip">{rooms.length}</span>
      </span>
      <span>
        Openings <span className="chip">{openings.length}</span>
      </span>
      <span>
        Products <span className="chip">{items.length}</span>
      </span>
      <span>
        Total wall <span className="chip">{formatLength(totalWall, unit)}</span>
      </span>
      <span>
        Est. total{' '}
        <span className="chip">
          {company.currency}
          {totalCost.toLocaleString()}
        </span>
      </span>
      <div style={{ flex: 1 }} />
      <label className="toggle" title="When on, holding Shift while drawing snaps to right angles">
        <input type="checkbox" checked={orthoEnabled} onChange={(e) => setOrthoEnabled(e.target.checked)} />
        Ortho (Shift)
      </label>
      <label className="toggle">
        <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
        Snap
      </label>
      <span>Zoom {(camera.zoom * 100).toFixed(0)}%</span>
    </div>
  )
}
