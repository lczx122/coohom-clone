import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { useDesignStore } from '../store/useDesignStore'
import CabinetModel from './CabinetModel'
import type { CabinetSection, CabinetSpec, SectionFront } from '../types'
import {
  accessoryType,
  accessoryTypes,
  ensureSections,
  hingeTypes,
  materialColor,
  materials,
  newAccessory,
  newSection,
} from '../data/cabinet'
import { lengthValue, toMeters, unitStep } from '../lib/units'
import { company } from '../config/company'

const FRONTS: { value: SectionFront; label: string }[] = [
  { value: 'door-double', label: 'Double door' },
  { value: 'door-left', label: 'Door — left hinge' },
  { value: 'door-right', label: 'Door — right hinge' },
  { value: 'drawers', label: 'Drawers' },
  { value: 'none', label: 'Open' },
]

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
    if (item?.cabinet) {
      const sections = ensureSections(item.cabinet).map((s) => ({ ...s, accessories: s.accessories.map((a) => ({ ...a })) }))
      setDraft({ ...item.cabinet, toeKick: item.cabinet.toeKick ?? 0.1, sections })
    }
  }, [item?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  if (!editingItemId || !item || !draft) return null

  const step = unitStep(unit)
  const sections = draft.sections ?? []
  const set = (patch: Partial<CabinetSpec>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const updateSection = (id: string, patch: Partial<CabinetSection>) =>
    set({ sections: sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const addSection = () => set({ sections: [...sections, newSection(0.3, 'door-left')] })
  const removeSection = (id: string) => set({ sections: sections.filter((s) => s.id !== id) })

  // price model
  const sectionsPrice = sections.reduce((sum, s) => {
    const acc = s.accessories.reduce((a, x) => a + (accessoryType(x.type)?.price ?? 0), 0)
    const drawers = s.front === 'drawers' ? s.drawers * 45 : 0
    return sum + acc + drawers
  }, 0)
  const carcassPrice = Math.round((draft.width * draft.height + draft.width * draft.depth) * 220)
  const total = carcassPrice + sectionsPrice

  const dimField = (label: string, key: 'width' | 'height' | 'depth' | 'panelThickness' | 'toeKick') => (
    <div className="field">
      <label>
        {label} ({unit})
      </label>
      <input
        type="number"
        step={step}
        min={key === 'toeKick' ? 0 : step}
        value={lengthValue(draft[key] ?? 0, unit)}
        onChange={(e) => set({ [key]: Math.max(0, toMeters(+e.target.value, unit)) } as Partial<CabinetSpec>)}
      />
    </div>
  )

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
            <Canvas shadows camera={{ position: [1.2, 1.1, 1.5], fov: 45 }}>
              <color attach="background" args={['#0c0e12']} />
              <ambientLight intensity={0.75} />
              <directionalLight position={[2, 3, 2]} intensity={1.2} castShadow />
              <directionalLight position={[-2, 2, -1]} intensity={0.4} />
              <Grid args={[10, 10]} cellSize={0.1} cellColor="#2a313d" sectionSize={0.5} sectionColor="#3a4555" position={[0, 0, 0]} />
              <CabinetModel spec={draft} open={openDoors} />
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

            <div className="section-title">Carcass dimensions</div>
            <div className="row2">
              {dimField('Width', 'width')}
              {dimField('Height', 'height')}
            </div>
            <div className="row2">
              {dimField('Depth', 'depth')}
              {dimField('Board', 'panelThickness')}
            </div>
            <div className="row2">{dimField('Toe kick', 'toeKick')}<div className="field" /></div>

            <div className="section-title">Material</div>
            <div className="field">
              <select value={draft.material} onChange={(e) => set({ material: e.target.value, color: materialColor(e.target.value) })}>
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
              <input type="color" value={draft.color} onChange={(e) => set({ color: e.target.value })} title="Custom color" className="color-input" />
            </div>
            <div className="field">
              <label>Hinge type</label>
              <select value={draft.hingeType} onChange={(e) => set({ hingeType: e.target.value })}>
                {hingeTypes.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="section-title">
              Sections / dividers
              <button className="acc-add" style={{ float: 'right' }} onClick={addSection}>
                + Add section
              </button>
            </div>
            <p className="empty-note" style={{ marginTop: 0 }}>
              Each section is a column split by a divider. Widths are relative and scale to fill the cabinet.
            </p>

            {sections.map((s, idx) => (
              <div className="cab-section" key={s.id}>
                <div className="cab-section-head">
                  <b>Section {idx + 1}</b>
                  {sections.length > 1 && (
                    <button className="acc-del" onClick={() => removeSection(s.id)} title="Remove section">
                      ✕
                    </button>
                  )}
                </div>
                <div className="row2">
                  <div className="field">
                    <label>Width ({unit})</label>
                    <input
                      type="number"
                      step={step}
                      min={step}
                      value={lengthValue(s.width, unit)}
                      onChange={(e) => updateSection(s.id, { width: Math.max(0.05, toMeters(+e.target.value, unit)) })}
                    />
                  </div>
                  <div className="field">
                    <label>Front</label>
                    <select value={s.front} onChange={(e) => updateSection(s.id, { front: e.target.value as SectionFront })}>
                      {FRONTS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {s.front === 'drawers' ? (
                  <div className="field">
                    <label>Drawers</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={s.drawers}
                      onChange={(e) => updateSection(s.id, { drawers: Math.max(1, Math.min(8, Math.round(+e.target.value))) })}
                    />
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label>Shelves</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={s.shelves}
                        onChange={(e) => updateSection(s.id, { shelves: Math.max(0, Math.min(10, Math.round(+e.target.value))) })}
                      />
                    </div>
                    <div className="acc-palette">
                      {accessoryTypes.map((a) => (
                        <button
                          key={a.key}
                          className="acc-add"
                          title={`Add ${a.name}`}
                          onClick={() => updateSection(s.id, { accessories: [...s.accessories, newAccessory(a.key)] })}
                        >
                          + {a.name}
                        </button>
                      ))}
                    </div>
                    {s.accessories.map((a) => (
                      <div className="acc-row" key={a.id}>
                        <span className="acc-name">{accessoryType(a.type)?.name ?? a.type}</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={a.level}
                          onChange={(e) =>
                            updateSection(s.id, {
                              accessories: s.accessories.map((x) => (x.id === a.id ? { ...x, level: +e.target.value } : x)),
                            })
                          }
                        />
                        <button
                          className="acc-del"
                          onClick={() => updateSection(s.id, { accessories: s.accessories.filter((x) => x.id !== a.id) })}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}

            <div className="price-line">
              Est. price: <b>{company.currency}{total.toLocaleString()}</b>
              <span className="price-detail"> (carcass {company.currency}{carcassPrice} + fit-out {company.currency}{sectionsPrice})</span>
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
              updateCabinet(item.id, draft)
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
              updateCabinet(item.id, draft)
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
