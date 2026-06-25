import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { useDesignStore } from '../store/useDesignStore'
import CabinetModel from './CabinetModel'
import type { CabinetSpec, DoorConfig } from '../types'
import {
  accessoryType,
  accessoryTypes,
  hingeTypes,
  materialColor,
  materials,
  newAccessory,
} from '../data/cabinet'
import { lengthValue, toMeters, unitStep } from '../lib/units'
import { company } from '../config/company'

export default function CabinetEditor() {
  const editingItemId = useDesignStore((s) => s.editingItemId)
  const items = useDesignStore((s) => s.items)
  const unit = useDesignStore((s) => s.unit)
  const updateCabinet = useDesignStore((s) => s.updateCabinet)
  const saveModel = useDesignStore((s) => s.saveModel)
  const close = useDesignStore((s) => s.closeCabinetEditor)

  const item = items.find((i) => i.id === editingItemId)
  const [draft, setDraft] = useState<CabinetSpec | null>(null)
  const [openDoors, setOpenDoors] = useState(true)
  const [savedNote, setSavedNote] = useState('')

  useEffect(() => {
    if (item?.cabinet) setDraft({ ...item.cabinet, accessories: [...item.cabinet.accessories] })
  }, [item?.id]) // re-init only when switching items

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  if (!editingItemId || !item || !draft) return null

  const step = unitStep(unit)
  const set = (patch: Partial<CabinetSpec>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const accessoriesPrice = draft.accessories.reduce(
    (sum, a) => sum + (accessoryType(a.type)?.price ?? 0),
    0,
  )
  // simple carcass price model: proportional to material area
  const carcassPrice = Math.round((draft.width * draft.height + draft.width * draft.depth) * 220)
  const total = carcassPrice + accessoriesPrice

  const dimField = (label: string, key: 'width' | 'height' | 'depth' | 'panelThickness') => (
    <div className="field">
      <label>
        {label} ({unit})
      </label>
      <input
        type="number"
        step={step}
        min={step}
        value={lengthValue(draft[key], unit)}
        onChange={(e) => set({ [key]: Math.max(0.003, toMeters(+e.target.value, unit)) } as Partial<CabinetSpec>)}
      />
    </div>
  )

  const apply = () => {
    updateCabinet(item.id, draft)
  }

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal cabinet-editor" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>Cabinet Editor — {draft.name}</span>
          <button className="icon-btn" onClick={close}>
            ✕
          </button>
        </div>

        <div className="cabinet-body">
          {/* 3D preview */}
          <div className="cabinet-preview">
            <Canvas shadows camera={{ position: [1.1, 1.0, 1.4], fov: 45 }}>
              <color attach="background" args={['#0c0e12']} />
              <ambientLight intensity={0.7} />
              <directionalLight position={[2, 3, 2]} intensity={1.2} castShadow />
              <directionalLight position={[-2, 2, -1]} intensity={0.4} />
              <Grid args={[10, 10]} cellSize={0.1} cellColor="#2a313d" sectionSize={0.5} sectionColor="#3a4555" position={[0, 0, 0]} />
              <group position={[0, 0, 0]}>
                <CabinetModel spec={draft} open={openDoors} />
              </group>
              <OrbitControls target={[0, draft.height / 2, 0]} makeDefault />
            </Canvas>
            <label className="preview-toggle">
              <input type="checkbox" checked={openDoors} onChange={(e) => setOpenDoors(e.target.checked)} />
              Open doors
            </label>
          </div>

          {/* controls */}
          <div className="cabinet-controls">
            <div className="field">
              <label>Name</label>
              <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            </div>

            <div className="section-title">Dimensions</div>
            <div className="row2">
              {dimField('Width', 'width')}
              {dimField('Height', 'height')}
            </div>
            <div className="row2">
              {dimField('Depth', 'depth')}
              {dimField('Panel', 'panelThickness')}
            </div>

            <div className="section-title">Material</div>
            <div className="field">
              <select
                value={draft.material}
                onChange={(e) => set({ material: e.target.value, color: materialColor(e.target.value) })}
              >
                {materials.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="swatch-row">
              {materials.map((m) => (
                <button
                  key={m.key}
                  className={`swatch-btn ${draft.color === m.color ? 'active' : ''}`}
                  style={{ background: m.color }}
                  title={m.name}
                  onClick={() => set({ material: m.key, color: m.color })}
                />
              ))}
              <input
                type="color"
                value={draft.color}
                onChange={(e) => set({ color: e.target.value })}
                title="Custom color"
                className="color-input"
              />
            </div>

            <div className="section-title">Doors &amp; Hinges</div>
            <div className="row2">
              <div className="field">
                <label>Doors</label>
                <select value={draft.doors} onChange={(e) => set({ doors: e.target.value as DoorConfig })}>
                  <option value="none">None (open)</option>
                  <option value="single-left">Single — left hinge</option>
                  <option value="single-right">Single — right hinge</option>
                  <option value="double">Double</option>
                </select>
              </div>
              <div className="field">
                <label>Hinge type</label>
                <select
                  value={draft.hingeType}
                  disabled={draft.doors === 'none'}
                  onChange={(e) => set({ hingeType: e.target.value })}
                >
                  {hingeTypes.map((h) => (
                    <option key={h.key} value={h.key}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="section-title">Shelves</div>
            <div className="field">
              <input
                type="number"
                min={0}
                max={10}
                value={draft.shelves}
                onChange={(e) => set({ shelves: Math.max(0, Math.min(10, Math.round(+e.target.value))) })}
              />
            </div>

            <div className="section-title">Accessories</div>
            <div className="acc-palette">
              {accessoryTypes.map((a) => (
                <button
                  key={a.key}
                  className="acc-add"
                  title={`Add ${a.name}${a.price ? ` (${company.currency}${a.price})` : ''}`}
                  onClick={() => set({ accessories: [...draft.accessories, newAccessory(a.key)] })}
                >
                  + {a.name}
                </button>
              ))}
            </div>
            {draft.accessories.length === 0 && (
              <p className="empty-note">No accessories added yet.</p>
            )}
            {draft.accessories.map((a) => {
              const at = accessoryType(a.type)
              return (
                <div className="acc-row" key={a.id}>
                  <span className="acc-name">{at?.name ?? a.type}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={a.level}
                    title="Height position"
                    onChange={(e) =>
                      set({
                        accessories: draft.accessories.map((x) =>
                          x.id === a.id ? { ...x, level: +e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    className="acc-del"
                    onClick={() => set({ accessories: draft.accessories.filter((x) => x.id !== a.id) })}
                  >
                    ✕
                  </button>
                </div>
              )
            })}

            <div className="price-line">
              Est. price: <b>{company.currency}{total.toLocaleString()}</b>
              <span className="price-detail">
                {' '}
                (carcass {company.currency}{carcassPrice} + accessories {company.currency}{accessoriesPrice})
              </span>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {savedNote && <span className="saved-note">{savedNote}</span>}
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={close}>
            Cancel
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              apply()
              saveModel(draft)
              setSavedNote(`Saved "${draft.name}" to My Cabinets`)
              setTimeout(() => setSavedNote(''), 2500)
            }}
          >
            Save as Model
          </button>
          <button
            className="icon-btn primary"
            onClick={() => {
              apply()
              close()
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
