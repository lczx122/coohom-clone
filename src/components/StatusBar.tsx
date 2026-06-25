import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import { company } from '../config/company'
import { dist } from '../lib/geometry'

export default function StatusBar() {
  const { walls, openings, items, snapEnabled, camera } = useDesignStore()
  const setSnapEnabled = useDesignStore((s) => s.setSnapEnabled)

  const totalWall = walls.reduce((sum, w) => sum + dist(w.start, w.end), 0)
  const totalCost = items.reduce((sum, it) => {
    const p = productById(it.productId)
    return sum + (p?.price ?? 0)
  }, 0)

  return (
    <div className="statusbar">
      <span>
        Walls <span className="chip">{walls.length}</span>
      </span>
      <span>
        Openings <span className="chip">{openings.length}</span>
      </span>
      <span>
        Products <span className="chip">{items.length}</span>
      </span>
      <span>
        Total wall length <span className="chip">{totalWall.toFixed(2)} m</span>
      </span>
      <span>
        Est. product total{' '}
        <span className="chip">
          {company.currency}
          {totalCost.toLocaleString()}
        </span>
      </span>
      <div style={{ flex: 1 }} />
      <label className="toggle">
        <input
          type="checkbox"
          checked={snapEnabled}
          onChange={(e) => setSnapEnabled(e.target.checked)}
        />
        Snap
      </label>
      <span>Zoom {(camera.zoom * 100).toFixed(0)}%</span>
    </div>
  )
}
