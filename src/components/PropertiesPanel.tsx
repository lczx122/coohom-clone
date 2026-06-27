import { useEffect, useState } from 'react'
import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import { company } from '../config/company'
import { dist } from '../lib/geometry'
import { detectRooms } from '../lib/rooms'
import { formatArea, lengthValue, toMeters, unitStep } from '../lib/units'
import { floorings, DEFAULT_FLOORING } from '../data/flooring'

const DEFAULT_WALL_COLOR = '#cbd3e1'

export default function PropertiesPanel() {
  const { selection, walls, openings, items, unit, roomNames } = useDesignStore()
  const updateWall = useDesignStore((s) => s.updateWall)
  const setWallLength = useDesignStore((s) => s.setWallLength)
  const updateOpening = useDesignStore((s) => s.updateOpening)
  const updateItem = useDesignStore((s) => s.updateItem)
  const deleteSelection = useDesignStore((s) => s.deleteSelection)
  const setRoomName = useDesignStore((s) => s.setRoomName)
  const openCabinetEditor = useDesignStore((s) => s.openCabinetEditor)

  const step = unitStep(unit)

  if (!selection) {
    return (
      <div className="props">
        <div className="section-title">Properties</div>
        <p className="empty-note">
          Nothing selected. Use the <b>Select</b> tool and click a wall, door,
          window, room, or product to edit it here.
        </p>
        <div className="section-title">Tips</div>
        <p className="empty-note">
          • <b>Wall</b> tool: tap to add points; tap <b>Finish wall</b> (or
          double-tap) to end.
          <br />• Toggle <b>Ortho</b> for right angles; <b>pinch</b> to zoom and
          drag two fingers to pan.
          <br />• Tap a wall to edit its length right on the plan.
          <br />• Enclose an area with walls to create a <b>room</b>.
          <br />• Select an item to rotate, resize, or delete it here.
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
          <label>Length ({unit})</label>
          <input
            type="number"
            step={step}
            min={step}
            value={lengthValue(dist(w.start, w.end), unit)}
            onChange={(e) => {
              const v = toMeters(+e.target.value, unit)
              if (v > 0) setWallLength(w.id, v)
            }}
          />
        </div>
        <div className="row2">
          <div className="field">
            <label>Thickness ({unit})</label>
            <input
              type="number"
              step={step}
              min={step}
              value={lengthValue(w.thickness, unit)}
              onChange={(e) => updateWall(w.id, { thickness: Math.max(0.02, toMeters(+e.target.value, unit)) })}
            />
          </div>
          <div className="field">
            <label>Height ({unit})</label>
            <input
              type="number"
              step={step}
              min={step}
              value={lengthValue(w.height, unit)}
              onChange={(e) => updateWall(w.id, { height: Math.max(0.1, toMeters(+e.target.value, unit)) })}
            />
          </div>
        </div>
        <div className="field">
          <label>Color</label>
          <div className="color-field">
            <input
              type="color"
              value={w.color ?? DEFAULT_WALL_COLOR}
              onChange={(e) => updateWall(w.id, { color: e.target.value })}
            />
            <span>{(w.color ?? DEFAULT_WALL_COLOR).toUpperCase()}</span>
            {w.color && (
              <button className="icon-btn" onClick={() => updateWall(w.id, { color: undefined })}>
                Reset
              </button>
            )}
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
          <label>Width ({unit})</label>
          <input
            type="number"
            step={step}
            min={step}
            value={lengthValue(o.width, unit)}
            onChange={(e) => updateOpening(o.id, { width: Math.max(0.3, toMeters(+e.target.value, unit)) })}
          />
        </div>
        <div className="row2">
          <div className="field">
            <label>Height ({unit})</label>
            <input
              type="number"
              step={step}
              min={step}
              value={lengthValue(o.height, unit)}
              onChange={(e) => updateOpening(o.id, { height: Math.max(0.3, toMeters(+e.target.value, unit)) })}
            />
          </div>
          <div className="field">
            <label>Sill ({unit})</label>
            <input
              type="number"
              step={step}
              min={0}
              value={lengthValue(o.sill, unit)}
              onChange={(e) => updateOpening(o.id, { sill: Math.max(0, toMeters(+e.target.value, unit)) })}
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

  if (selection.kind === 'room') {
    return <RoomProps roomKey={selection.id} roomNames={roomNames} setRoomName={setRoomName} />
  }

  // item
  const it = items.find((x) => x.id === selection.id)
  if (!it) return null
  const deg = Math.round((it.rotation * 180) / Math.PI)

  // light fixture
  if (it.light) {
    const l = it.light
    return (
      <div className="props">
        <div className="section-title">Light</div>
        <div className="field">
          <label>Color</label>
          <div className="color-field">
            <input type="color" value={l.color} onChange={(e) => updateItem(it.id, { light: { ...l, color: e.target.value } })} />
            <span>{l.color.toUpperCase()}</span>
          </div>
        </div>
        <div className="field">
          <label>Brightness: {l.intensity.toFixed(1)}</label>
          <input
            type="range"
            min="0.2"
            max="4"
            step="0.1"
            value={l.intensity}
            onChange={(e) => updateItem(it.id, { light: { ...l, intensity: +e.target.value } })}
          />
        </div>
        <div className="field">
          <label>Height ({unit})</label>
          <input
            type="number"
            step={step}
            value={lengthValue(l.height, unit)}
            onChange={(e) => updateItem(it.id, { light: { ...l, height: Math.max(0.1, toMeters(+e.target.value, unit)) } })}
          />
        </div>
        <div className="row2">
          <div className="field">
            <label>X ({unit})</label>
            <input
              type="number"
              step={step}
              value={lengthValue(it.position.x, unit)}
              onChange={(e) => updateItem(it.id, { position: { ...it.position, x: toMeters(+e.target.value, unit) } })}
            />
          </div>
          <div className="field">
            <label>Y ({unit})</label>
            <input
              type="number"
              step={step}
              value={lengthValue(it.position.y, unit)}
              onChange={(e) => updateItem(it.id, { position: { ...it.position, y: toMeters(+e.target.value, unit) } })}
            />
          </div>
        </div>
        <button className="danger" onClick={deleteSelection}>
          Delete light
        </button>
      </div>
    )
  }

  // custom cabinet
  if (it.cabinet) {
    const cab = it.cabinet
    return (
      <div className="props">
        <div className="section-title">Cabinet</div>
        <div className="field">
          <label>Name</label>
          <input value={cab.name} disabled />
        </div>
        <button className="icon-btn primary" style={{ width: '100%' }} onClick={() => openCabinetEditor(it.id)}>
          Edit cabinet…
        </button>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Size (W × H × D)</label>
          <input
            value={`${lengthValue(cab.width, unit)} × ${lengthValue(cab.height, unit)} × ${lengthValue(cab.depth, unit)} ${unit}`}
            disabled
          />
        </div>
        <div className="row2">
          <div className="field">
            <label>X ({unit})</label>
            <input
              type="number"
              step={step}
              value={lengthValue(it.position.x, unit)}
              onChange={(e) => updateItem(it.id, { position: { ...it.position, x: toMeters(+e.target.value, unit) } })}
            />
          </div>
          <div className="field">
            <label>Y ({unit})</label>
            <input
              type="number"
              step={step}
              value={lengthValue(it.position.y, unit)}
              onChange={(e) => updateItem(it.id, { position: { ...it.position, y: toMeters(+e.target.value, unit) } })}
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
        <button className="danger" onClick={deleteSelection}>
          Delete cabinet
        </button>
      </div>
    )
  }

  const prod = productById(it.productId)
  if (!prod) return null
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
          <label>X ({unit})</label>
          <input
            type="number"
            step={step}
            value={lengthValue(it.position.x, unit)}
            onChange={(e) => updateItem(it.id, { position: { ...it.position, x: toMeters(+e.target.value, unit) } })}
          />
        </div>
        <div className="field">
          <label>Y ({unit})</label>
          <input
            type="number"
            step={step}
            value={lengthValue(it.position.y, unit)}
            onChange={(e) => updateItem(it.id, { position: { ...it.position, y: toMeters(+e.target.value, unit) } })}
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
      <button className="danger" onClick={deleteSelection}>
        Delete product
      </button>
    </div>
  )
}

function RoomProps({
  roomKey,
  roomNames,
  setRoomName,
}: {
  roomKey: string
  roomNames: Record<string, string>
  setRoomName: (key: string, name: string) => void
}) {
  const walls = useDesignStore((s) => s.walls)
  const roomFloors = useDesignStore((s) => s.roomFloors)
  const setRoomFloor = useDesignStore((s) => s.setRoomFloor)
  const rooms = detectRooms(walls)
  const room = rooms.find((r) => r.key === roomKey)
  const idx = rooms.findIndex((r) => r.key === roomKey)
  const [name, setName] = useState(roomNames[roomKey] ?? '')

  useEffect(() => {
    setName(roomNames[roomKey] ?? '')
  }, [roomKey, roomNames])

  if (!room) {
    return (
      <div className="props">
        <div className="section-title">Room</div>
        <p className="empty-note">This room no longer exists.</p>
      </div>
    )
  }

  return (
    <div className="props">
      <div className="section-title">Room</div>
      <div className="field">
        <label>Name</label>
        <input
          value={name}
          placeholder={`Room ${idx + 1}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setRoomName(roomKey, name)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setRoomName(roomKey, name)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      </div>
      <div className="field">
        <label>Floor area</label>
        <input value={formatArea(room.area)} disabled />
      </div>
      <div className="field">
        <label>Flooring</label>
        <select
          value={roomFloors[roomKey] ?? DEFAULT_FLOORING}
          onChange={(e) => setRoomFloor(roomKey, e.target.value)}
        >
          {floorings.map((f) => (
            <option key={f.key} value={f.key}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <p className="empty-note">
        Renaming &amp; flooring stick as long as this room's corners don't change.
      </p>
    </div>
  )
}
