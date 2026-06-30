import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
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

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** A draggable resize handle sphere in the 3D preview. */
function Handle({ position, color, onDown }: { position: [number, number, number]; color: string; onDown: () => void }) {
  return (
    <mesh
      position={position}
      onPointerDown={(e) => {
        e.stopPropagation()
        onDown()
      }}
      onPointerOver={() => (document.body.style.cursor = 'grab')}
      onPointerOut={() => (document.body.style.cursor = 'default')}
    >
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
    </mesh>
  )
}

/** Width/height/depth drag handles; updates the draft via onResize. */
function DimensionHandles({
  spec,
  onResize,
}: {
  spec: CabinetSpec
  onResize: (dim: 'width' | 'height' | 'depth', value: number) => void
}) {
  const three = useThree() as unknown as {
    camera: THREE.Camera
    gl: { domElement: HTMLCanvasElement }
    controls: { enabled: boolean } | null
  }
  const { camera, gl, controls } = three
  const ray = useRef(new THREE.Raycaster())
  const drag = useRef<'x' | 'y' | 'z' | null>(null)

  const W = spec.width
  const H = spec.height
  const D = spec.depth
  const toe = spec.toeKick ?? 0
  const midY = toe + H / 2
  const topY = toe + H

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const axis = drag.current
      if (!axis) return
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      ray.current.setFromCamera(ndc, camera)
      const pt = new THREE.Vector3()
      if (axis === 'x' || axis === 'z') {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -midY)
        if (ray.current.ray.intersectPlane(plane, pt)) {
          if (axis === 'x') onResize('width', clampN(Math.abs(pt.x) * 2, 0.1, 4))
          else onResize('depth', clampN(Math.abs(pt.z) * 2, 0.1, 1.2))
        }
      } else {
        const fwd = new THREE.Vector3()
        camera.getWorldDirection(fwd)
        fwd.y = 0
        if (fwd.lengthSq() < 1e-6) return
        fwd.normalize()
        const plane = new THREE.Plane(fwd, 0)
        if (ray.current.ray.intersectPlane(plane, pt)) onResize('height', clampN(pt.y - toe, 0.1, 3))
      }
    }
    const onUp = () => {
      if (drag.current) {
        drag.current = null
        if (controls) controls.enabled = true
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, controls, midY, toe, onResize])

  const start = (axis: 'x' | 'y' | 'z') => () => {
    drag.current = axis
    if (controls) controls.enabled = false
  }

  return (
    <>
      <Handle position={[W / 2, midY, D / 2]} color="#ff6b6b" onDown={start('x')} />
      <Handle position={[0, midY, D / 2]} color="#6b9bff" onDown={start('z')} />
      <Handle position={[0, topY, D / 2]} color="#6bff8f" onDown={start('y')} />
    </>
  )
}

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
      const c = item.cabinet
      const sections = ensureSections(c).map((s) => ({ ...s, accessories: s.accessories.map((a) => ({ ...a })) }))
      setDraft({
        ...c,
        kind: c.kind ?? 'base',
        toeKick: c.toeKick ?? (c.kind === 'wall' ? 0 : 0.1),
        worktop: c.worktop ?? (c.kind === 'wall' ? false : true),
        worktopThickness: c.worktopThickness ?? 0.04,
        worktopColor: c.worktopColor ?? '#d9d6cf',
        mountHeight: c.mountHeight ?? 1.5,
        sections,
      })
    }
  }, [item?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const resize = useCallback(
    (dim: 'width' | 'height' | 'depth', value: number) => setDraft((d) => (d ? { ...d, [dim]: value } : d)),
    [],
  )

  if (!editingItemId || !item || !draft) return null

  const step = unitStep(unit)
  const sections = draft.sections ?? []
  const set = (patch: Partial<CabinetSpec>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const isWall = draft.kind === 'wall'

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

  const dimField = (
    label: string,
    key: 'width' | 'height' | 'depth' | 'panelThickness' | 'toeKick' | 'mountHeight' | 'worktopThickness',
  ) => (
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
              <DimensionHandles spec={draft} onResize={resize} />
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
            <p className="empty-note" style={{ marginTop: 0 }}>
              Tip: drag the coloured handles in the preview to resize width / depth / height.
            </p>
            <div className="row2">
              {dimField('Width', 'width')}
              {dimField('Height', 'height')}
            </div>
            <div className="row2">
              {dimField('Depth', 'depth')}
              {dimField('Board', 'panelThickness')}
            </div>
            <div className="row2">
              <div className="field">
                <label>Type</label>
                <select
                  value={draft.kind ?? 'base'}
                  onChange={(e) => {
                    const kind = e.target.value as 'base' | 'wall'
                    if (kind === 'wall') {
                      set({ kind: 'wall', toeKick: 0, worktop: false, mountHeight: draft.mountHeight ?? 1.5, depth: Math.min(draft.depth, 0.4) })
                    } else {
                      set({ kind: 'base', toeKick: draft.toeKick || 0.1, worktop: draft.worktop ?? true })
                    }
                  }}
                >
                  <option value="base">Base (on floor)</option>
                  <option value="wall">Wall (mounted)</option>
                </select>
              </div>
              {isWall ? dimField('Mount height', 'mountHeight') : dimField('Toe kick', 'toeKick')}
            </div>

            {!isWall && (
              <>
                <label className="toggle" style={{ margin: '4px 0 8px' }}>
                  <input type="checkbox" checked={draft.worktop !== false} onChange={(e) => set({ worktop: e.target.checked })} />
                  Worktop
                </label>
                {draft.worktop !== false && (
                  <div className="row2">
                    {dimField('Worktop thickness', 'worktopThickness')}
                    <div className="field">
                      <label>Worktop color</label>
                      <div className="color-field">
                        <input type="color" value={draft.worktopColor ?? '#d9d6cf'} onChange={(e) => set({ worktopColor: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

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
                {s.front !== 'none' && (
                  <div className="row2">
                    <div className="field">
                      <label>Handle</label>
                      <select value={s.handle ?? 'bar'} onChange={(e) => updateSection(s.id, { handle: e.target.value as 'bar' | 'knob' })}>
                        <option value="bar">Bar</option>
                        <option value="knob">Knob</option>
                      </select>
                    </div>
                    {s.front !== 'drawers' && (
                      <div className="field">
                        <label>Handle position</label>
                        <select value={s.handlePos ?? 'side'} onChange={(e) => updateSection(s.id, { handlePos: e.target.value as 'top' | 'side' })}>
                          <option value="side">Side</option>
                          <option value="top">Top</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

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
