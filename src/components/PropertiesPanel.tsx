import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import { company } from '../config/company'
import { dist } from '../lib/geometry'

export default function PropertiesPanel() {
  const { selection, walls, openings, items } = useDesignStore()
  const updateWall = useDesignStore((s) => s.updateWall)
  const updateOpening = useDesignStore((s) => s.updateOpening)
  const updateItem = useDesignStore((s) => s.updateItem)
  const deleteSelection = useDesignStore((s) => s.deleteSelection)

  if (!selection) {
    return (
      <div className="props">
        <div className="section-title">Properties</div>
        <p className="empty-note">
          Nothing selected. Use the <b>Select</b> tool and click a wall, door,
          window, or product to edit it here.
        </p>
        <div className="section-title">Tips</div>
        <p className="empty-note">
          • <b>Wall</b> tool: click to chain segments, double-click or Esc to
          finish.
          <br />• Walls snap to the grid and to existing corners.
          <br />• Scroll to zoom, drag with the <b>Pan</b> tool or middle mouse.
          <br />• <b>R</b> rotates a selected product; <b>Delete</b> removes it.
        </p>
      </div>
    )
  }

  if (selection.kind === 'wall') {
    const w = walls.find((x) => x.id === selection.id)
    if (!w) return null
    return (
      <div className="props">
        <div className="section-title">Wall</div>
        <div className="field">
          <label>Length</label>
          <input value={`${dist(w.start, w.end).toFixed(3)} m`} disabled />
        </div>
        <div className="row2">
          <div className="field">
            <label>Thickness (m)</label>
            <input
              type="number"
              step="0.01"
              min="0.02"
              value={w.thickness}
              onChange={(e) => updateWall(w.id, { thickness: Math.max(0.02, +e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Height (m)</label>
            <input
              type="number"
              step="0.05"
              min="0.1"
              value={w.height}
              onChange={(e) => updateWall(w.id, { height: Math.max(0.1, +e.target.value) })}
            />
          </div>
        </div>
        <button className="danger" onClick={deleteSelection}>
          Delete wall
        </button>
      </div>
    )
  }

  if (selection.kind === 'opening') {
    const o = openings.find((x) => x.id === selection.id)
    if (!o) return null
    return (
      <div className="props">
        <div className="section-title">{o.kind === 'door' ? 'Door' : 'Window'}</div>
        <div className="field">
          <label>Width (m)</label>
          <input
            type="number"
            step="0.05"
            min="0.3"
            value={o.width}
            onChange={(e) => updateOpening(o.id, { width: Math.max(0.3, +e.target.value) })}
          />
        </div>
        <div className="row2">
          <div className="field">
            <label>Height (m)</label>
            <input
              type="number"
              step="0.05"
              min="0.3"
              value={o.height}
              onChange={(e) => updateOpening(o.id, { height: Math.max(0.3, +e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Sill (m)</label>
            <input
              type="number"
              step="0.05"
              min="0"
              value={o.sill}
              onChange={(e) => updateOpening(o.id, { sill: Math.max(0, +e.target.value) })}
            />
          </div>
        </div>
        <div className="field">
          <label>Position along wall</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={o.t}
            onChange={(e) => updateOpening(o.id, { t: +e.target.value })}
          />
        </div>
        <button className="danger" onClick={deleteSelection}>
          Delete {o.kind}
        </button>
      </div>
    )
  }

  // item
  const it = items.find((x) => x.id === selection.id)
  if (!it) return null
  const prod = productById(it.productId)
  if (!prod) return null
  const deg = Math.round((it.rotation * 180) / Math.PI)
  return (
    <div className="props">
      <div className="section-title">Product</div>
      <div className="field">
        <label>Name</label>
        <input value={prod.name} disabled />
      </div>
      <div className="row2">
        <div className="field">
          <label>SKU</label>
          <input value={prod.sku ?? '—'} disabled />
        </div>
        <div className="field">
          <label>Price</label>
          <input value={prod.price != null ? `${company.currency}${prod.price}` : '—'} disabled />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>X (m)</label>
          <input
            type="number"
            step="0.05"
            value={it.position.x.toFixed(2)}
            onChange={(e) => updateItem(it.id, { position: { ...it.position, x: +e.target.value } })}
          />
        </div>
        <div className="field">
          <label>Y (m)</label>
          <input
            type="number"
            step="0.05"
            value={it.position.y.toFixed(2)}
            onChange={(e) => updateItem(it.id, { position: { ...it.position, y: +e.target.value } })}
          />
        </div>
      </div>
      <div className="field">
        <label>Rotation: {deg}°</label>
        <input
          type="range"
          min="0"
          max="360"
          step="15"
          value={((deg % 360) + 360) % 360}
          onChange={(e) => updateItem(it.id, { rotation: (+e.target.value * Math.PI) / 180 })}
        />
      </div>
      <div className="field">
        <label>Footprint</label>
        <input value={`${prod.width} × ${prod.depth} × ${prod.height} m`} disabled />
      </div>
      <button className="danger" onClick={deleteSelection}>
        Delete product
      </button>
    </div>
  )
}
