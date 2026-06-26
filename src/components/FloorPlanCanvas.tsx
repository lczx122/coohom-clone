import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import {
  dist,
  lerp,
  nearestWall,
  projectPointToSegment,
  snapToEndpoints,
  snapToGrid,
  sub,
} from '../lib/geometry'
import { detectRooms, pointInPolygon } from '../lib/rooms'
import { formatArea, formatLength, lengthValue, toMeters } from '../lib/units'
import { defaultCabinet } from '../data/cabinet'
import { flooringByKey, DEFAULT_FLOORING } from '../data/flooring'
import type { PlacedItem, Vec2, Wall } from '../types'

const DEFAULT_WALL_COLOR = '#cbd3e1'

/** Footprint + display info for a placed item (catalog product, cabinet, light). */
function footprintOf(it: PlacedItem) {
  if (it.light) {
    return { width: 0.3, depth: 0.3, color: it.light.color, name: 'Light' }
  }
  if (it.cabinet) {
    return { width: it.cabinet.width, depth: it.cabinet.depth, color: it.cabinet.color, name: it.cabinet.name }
  }
  const p = productById(it.productId)
  return p ? { width: p.width, depth: p.depth, color: p.color, name: p.name } : null
}

/** Snap a cabinet so its back rests against the nearest wall, facing the room. */
function snapCabinetToWall(
  depth: number,
  pos: Vec2,
  walls: Wall[],
): { position: Vec2; rotation: number } | null {
  const hit = nearestWall(pos, walls, 0.7)
  if (!hit) return null
  const w = hit.wall
  const proj = projectPointToSegment(pos, w.start, w.end).point
  const dx = w.end.x - w.start.x
  const dy = w.end.y - w.start.y
  const len = Math.hypot(dx, dy) || 1
  let n = { x: -dy / len, y: dx / len }
  const toItem = { x: pos.x - proj.x, y: pos.y - proj.y }
  if (toItem.x * n.x + toItem.y * n.y < 0) n = { x: -n.x, y: -n.y }
  const offset = depth / 2 + (w.thickness ?? 0.1) / 2
  return {
    position: { x: proj.x + n.x * offset, y: proj.y + n.y * offset },
    rotation: Math.atan2(-n.x, n.y),
  }
}

const BASE_PPM = 100 // pixels per meter at zoom = 1

type Interaction =
  | { type: 'idle' }
  | { type: 'panning'; startScreen: Vec2; startPan: { x: number; y: number } }
  | { type: 'drawing'; anchor: Vec2 }
  | { type: 'drag-item'; id: string; grabOffset: Vec2; current: Vec2 }
  | { type: 'drag-wall'; id: string; start0: Vec2; end0: Vec2; grab: Vec2; current: Vec2 }
  | { type: 'drag-endpoint'; origin: Vec2; current: Vec2 }
  | { type: 'drag-opening'; id: string; current: Vec2 }

export default function FloorPlanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [interaction, setInteraction] = useState<Interaction>({ type: 'idle' })
  const [mouseWorld, setMouseWorld] = useState<Vec2>({ x: 0, y: 0 })
  const [shiftHeld, setShiftHeld] = useState(false)
  const [lenDraft, setLenDraft] = useState('')

  const store = useDesignStore()
  const {
    walls, openings, items, camera, tool, selection, placingProductId, placingModelId, placingLight,
    snapEnabled, orthoEnabled, snapIncrement, gridSize, unit, roomNames, roomFloors,
  } = store

  const rooms = useMemo(() => detectRooms(walls), [walls])

  // ----- coordinate transforms -----
  const ppm = BASE_PPM * camera.zoom
  const worldToScreen = useCallback(
    (p: Vec2): Vec2 => ({ x: p.x * ppm + camera.panX, y: p.y * ppm + camera.panY }),
    [ppm, camera.panX, camera.panY],
  )
  const screenToWorld = useCallback(
    (s: Vec2): Vec2 => ({ x: (s.x - camera.panX) / ppm, y: (s.y - camera.panY) / ppm }),
    [ppm, camera.panX, camera.panY],
  )

  const getMouse = useCallback((e: { clientX: number; clientY: number }): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  /** Snap for moving things (endpoints first, then grid). */
  const snap = useCallback(
    (p: Vec2): Vec2 => {
      if (!snapEnabled) return p
      const ep = snapToEndpoints(p, walls, 12 / ppm)
      if (ep) return ep
      return snapToGrid(p, snapIncrement)
    },
    [snapEnabled, ppm, walls, snapIncrement],
  )

  /** Snap while drawing a wall: connect corners, then constrain to right angles. */
  const snapDraw = useCallback(
    (anchor: Vec2, raw: Vec2): Vec2 => {
      if (snapEnabled) {
        const ep = snapToEndpoints(raw, walls, 12 / ppm)
        if (ep) return ep
      }
      let p = raw
      // right-angle (ortho) snap applies only while Shift is held
      if (orthoEnabled && shiftHeld) {
        const dx = raw.x - anchor.x
        const dy = raw.y - anchor.y
        p = Math.abs(dx) >= Math.abs(dy) ? { x: raw.x, y: anchor.y } : { x: anchor.x, y: raw.y }
      }
      if (snapEnabled) p = snapToGrid(p, snapIncrement)
      return p
    },
    [snapEnabled, orthoEnabled, shiftHeld, ppm, walls, snapIncrement],
  )

  // ----- resize handling -----
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // ----- track Shift for temporary ortho override -----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true)
      if (e.key === 'Escape' && interaction.type === 'drawing') setInteraction({ type: 'idle' })
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [interaction])

  // keep the inline length editor in sync with the selected wall
  useEffect(() => {
    if (selection?.kind === 'wall') {
      const w = walls.find((x) => x.id === selection.id)
      if (w) setLenDraft(String(lengthValue(dist(w.start, w.end), unit)))
    }
  }, [selection, walls, unit])

  // ----- hit testing -----
  const itemAt = useCallback(
    (p: Vec2) => {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]
        const fp = footprintOf(it)
        if (!fp) continue
        const d = sub(p, it.position)
        const c = Math.cos(-it.rotation)
        const s = Math.sin(-it.rotation)
        const lx = d.x * c - d.y * s
        const ly = d.x * s + d.y * c
        if (Math.abs(lx) <= fp.width / 2 && Math.abs(ly) <= fp.depth / 2) return it
      }
      return null
    },
    [items],
  )

  // ----- pointer handlers -----
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Right click: finish any drawing and return to the cursor tool.
      if (e.button === 2) {
        setInteraction({ type: 'idle' })
        store.setTool('select')
        return
      }

      canvasRef.current?.setPointerCapture(e.pointerId)
      const screen = getMouse(e)
      const world = screenToWorld(screen)
      const middle = e.button === 1
      const space = (e as unknown as { getModifierState?: (k: string) => boolean }).getModifierState?.(' ')

      if (middle || tool === 'pan' || space) {
        setInteraction({ type: 'panning', startScreen: screen, startPan: { x: camera.panX, y: camera.panY } })
        return
      }

      if (tool === 'wall') {
        if (interaction.type === 'drawing') {
          const p = snapDraw(interaction.anchor, world)
          if (dist(interaction.anchor, p) > 0.01) {
            store.addWall(interaction.anchor, p)
            setInteraction({ type: 'drawing', anchor: p })
          }
        } else {
          setInteraction({ type: 'drawing', anchor: snap(world) })
        }
        return
      }

      if (tool === 'door' || tool === 'window') {
        const hit = nearestWall(world, walls, 0.4)
        if (hit) store.addOpening(hit.wall.id, hit.t, tool)
        return
      }

      if (tool === 'place' && (placingProductId || placingModelId || placingLight)) {
        const pos = snap(world)
        if (placingLight) {
          const id = store.addLightItem(pos)
          store.setSelection({ kind: 'item', id })
        } else if (placingModelId) {
          if (placingModelId === '__new__') {
            const spec = defaultCabinet()
            const snapped = snapCabinetToWall(spec.depth, pos, walls)
            const id = store.addCabinetItem(spec, snapped?.position ?? pos)
            if (snapped) store.updateItem(id, { rotation: snapped.rotation })
            store.setSelection({ kind: 'item', id })
            store.setPlacingModel(null)
            store.openCabinetEditor(id)
          } else {
            const model = store.models.find((m) => m.id === placingModelId)
            if (model) {
              const snapped = snapCabinetToWall(model.spec.depth, pos, walls)
              const id = store.addCabinetItem(
                { ...model.spec, accessories: model.spec.accessories.map((a) => ({ ...a })) },
                snapped?.position ?? pos,
              )
              if (snapped) store.updateItem(id, { rotation: snapped.rotation })
              store.setSelection({ kind: 'item', id })
            }
          }
        } else if (placingProductId) {
          const id = store.addItem(placingProductId, pos)
          store.setSelection({ kind: 'item', id })
        }
        return
      }

      // ----- select tool -----
      if (selection?.kind === 'wall') {
        const w = walls.find((x) => x.id === selection.id)
        if (w) {
          const handleR = 10 / ppm
          if (dist(world, w.start) <= handleR) {
            setInteraction({ type: 'drag-endpoint', origin: w.start, current: w.start })
            return
          }
          if (dist(world, w.end) <= handleR) {
            setInteraction({ type: 'drag-endpoint', origin: w.end, current: w.end })
            return
          }
        }
      }

      const it = itemAt(world)
      if (it) {
        store.setSelection({ kind: 'item', id: it.id })
        setInteraction({ type: 'drag-item', id: it.id, grabOffset: sub(world, it.position), current: it.position })
        return
      }

      let openHit: string | null = null
      for (const o of openings) {
        const w = walls.find((x) => x.id === o.wallId)
        if (!w) continue
        const center = lerp(w.start, w.end, o.t)
        if (dist(world, center) <= Math.max(o.width / 2, 0.15)) {
          openHit = o.id
          break
        }
      }
      if (openHit) {
        store.setSelection({ kind: 'opening', id: openHit })
        setInteraction({ type: 'drag-opening', id: openHit, current: world })
        return
      }

      const wallHit = nearestWall(world, walls, 0.15)
      if (wallHit) {
        store.setSelection({ kind: 'wall', id: wallHit.wall.id })
        setInteraction({
          type: 'drag-wall', id: wallHit.wall.id,
          start0: wallHit.wall.start, end0: wallHit.wall.end, grab: world, current: world,
        })
        return
      }

      // rooms (lowest priority)
      const room = rooms.find((r) => pointInPolygon(world, r.polygon))
      if (room) {
        store.setSelection({ kind: 'room', id: room.key })
        return
      }

      store.setSelection(null)
    },
    [tool, interaction, selection, walls, openings, camera, placingProductId, placingModelId, placingLight, ppm, rooms, snap, snapDraw, screenToWorld, getMouse, itemAt, store],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const screen = getMouse(e)
      const world = screenToWorld(screen)
      setMouseWorld(world)

      switch (interaction.type) {
        case 'panning':
          store.setCamera({
            panX: interaction.startPan.x + (screen.x - interaction.startScreen.x),
            panY: interaction.startPan.y + (screen.y - interaction.startScreen.y),
          })
          break
        case 'drag-item':
          setInteraction({ ...interaction, current: snap(sub(world, interaction.grabOffset)) })
          break
        case 'drag-wall':
          setInteraction({ ...interaction, current: world })
          break
        case 'drag-endpoint':
          setInteraction({ ...interaction, current: snap(world) })
          break
        case 'drag-opening':
          setInteraction({ ...interaction, current: world })
          break
        default:
          break
      }
    },
    [interaction, screenToWorld, getMouse, snap, store],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      canvasRef.current?.releasePointerCapture(e.pointerId)
      switch (interaction.type) {
        case 'drag-item': {
          const dragged = items.find((x) => x.id === interaction.id)
          if (dragged?.cabinet) {
            const snapped = snapCabinetToWall(dragged.cabinet.depth, interaction.current, walls)
            store.updateItem(interaction.id, snapped ?? { position: interaction.current })
          } else {
            store.updateItem(interaction.id, { position: interaction.current })
          }
          setInteraction({ type: 'idle' })
          break
        }
        case 'drag-endpoint':
          store.moveJoint(interaction.origin, interaction.current)
          setInteraction({ type: 'idle' })
          break
        case 'drag-wall': {
          const delta = sub(interaction.current, interaction.grab)
          store.updateWall(interaction.id, {
            start: { x: interaction.start0.x + delta.x, y: interaction.start0.y + delta.y },
            end: { x: interaction.end0.x + delta.x, y: interaction.end0.y + delta.y },
          })
          setInteraction({ type: 'idle' })
          break
        }
        case 'drag-opening': {
          const o = store.openings.find((x) => x.id === interaction.id)
          const w = walls.find((x) => x.id === o?.wallId)
          if (w) {
            const proj = nearestWall(interaction.current, [w], Infinity)
            if (proj) store.updateOpening(interaction.id, { t: proj.t })
          }
          setInteraction({ type: 'idle' })
          break
        }
        case 'panning':
          setInteraction({ type: 'idle' })
          break
        default:
          break
      }
    },
    [interaction, walls, items, store],
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (interaction.type === 'drawing') {
        setInteraction({ type: 'idle' })
        return
      }
      const world = screenToWorld(getMouse(e))
      const it = itemAt(world)
      if (it?.cabinet) {
        store.setSelection({ kind: 'item', id: it.id })
        store.openCabinetEditor(it.id)
      }
    },
    [interaction, screenToWorld, getMouse, itemAt, store],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const screen = getMouse(e)
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.min(8, Math.max(0.15, camera.zoom * factor))
      const wx = (screen.x - camera.panX) / (BASE_PPM * camera.zoom)
      const wy = (screen.y - camera.panY) / (BASE_PPM * camera.zoom)
      store.setCamera({ zoom: newZoom, panX: screen.x - wx * BASE_PPM * newZoom, panY: screen.y - wy * BASE_PPM * newZoom })
    },
    [camera, getMouse, store],
  )

  // ----- draw -----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    canvas.style.width = `${size.w}px`
    canvas.style.height = `${size.h}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)

    drawGrid(ctx, size, camera, gridSize)

    // effective walls with live drag overrides
    const effWalls = walls.map((w) => {
      if (interaction.type === 'drag-endpoint') {
        let { start, end } = w
        if (dist(start, interaction.origin) <= 0.005) start = interaction.current
        if (dist(end, interaction.origin) <= 0.005) end = interaction.current
        if (start !== w.start || end !== w.end) return { ...w, start, end }
      }
      if (interaction.type === 'drag-wall' && interaction.id === w.id) {
        const delta = sub(interaction.current, interaction.grab)
        return {
          ...w,
          start: { x: interaction.start0.x + delta.x, y: interaction.start0.y + delta.y },
          end: { x: interaction.end0.x + delta.x, y: interaction.end0.y + delta.y },
        }
      }
      return w
    })

    // rooms (under walls)
    const effRooms = interaction.type === 'idle' ? rooms : detectRooms(effWalls)
    effRooms.forEach((room, idx) => {
      const selected = selection?.kind === 'room' && selection.id === room.key
      ctx.beginPath()
      room.polygon.forEach((pt, i) => {
        const sp = worldToScreen(pt)
        if (i === 0) ctx.moveTo(sp.x, sp.y)
        else ctx.lineTo(sp.x, sp.y)
      })
      ctx.closePath()
      if (selected) {
        ctx.fillStyle = 'rgba(47,109,246,0.28)'
      } else {
        const fl = flooringByKey(roomFloors[room.key] ?? DEFAULT_FLOORING)
        ctx.fillStyle = hexWithAlpha(fl.color, 0.22)
      }
      ctx.fill()
      const c = worldToScreen(room.centroid)
      const name = roomNames[room.key] ?? `Room ${idx + 1}`
      ctx.font = '600 13px -apple-system, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#e6e9ef'
      ctx.fillText(name, c.x, c.y - 8)
      ctx.font = '11px -apple-system, system-ui, sans-serif'
      ctx.fillStyle = '#9aa3b2'
      ctx.fillText(formatArea(room.area), c.x, c.y + 9)
    })

    // walls
    for (const w of effWalls) {
      const a = worldToScreen(w.start)
      const b = worldToScreen(w.end)
      const selected = selection?.kind === 'wall' && selection.id === w.id
      ctx.lineCap = 'round'
      ctx.strokeStyle = selected ? '#2f6df6' : w.color ?? DEFAULT_WALL_COLOR
      ctx.lineWidth = Math.max(2, w.thickness * ppm)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()

      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (!(selected && interaction.type === 'idle')) {
        drawLabel(ctx, formatLength(dist(w.start, w.end), unit), mid.x, mid.y - Math.max(8, w.thickness * ppm))
      }

      if (selected) {
        for (const pt of [w.start, w.end]) {
          const sp = worldToScreen(pt)
          ctx.fillStyle = '#fff'
          ctx.strokeStyle = '#2f6df6'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // openings
    for (const o of openings) {
      const w = effWalls.find((x) => x.id === o.wallId)
      if (!w) continue
      const center = lerp(w.start, w.end, o.t)
      const c = worldToScreen(center)
      const ang = Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x)
      const halfW = (o.width / 2) * ppm
      const selected = selection?.kind === 'opening' && selection.id === o.id
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(ang)
      ctx.fillStyle = '#0c0e12'
      const t = Math.max(2, w.thickness * ppm) + 2
      ctx.fillRect(-halfW, -t / 2, halfW * 2, t)
      ctx.strokeStyle = selected ? '#2f6df6' : o.kind === 'door' ? '#7ee081' : '#7fb6ff'
      ctx.lineWidth = 2
      if (o.kind === 'door') {
        ctx.beginPath()
        ctx.moveTo(-halfW, 0)
        ctx.lineTo(halfW, 0)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(-halfW, 0, halfW * 2, 0, -Math.PI / 2, true)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(-halfW, -2)
        ctx.lineTo(halfW, -2)
        ctx.moveTo(-halfW, 2)
        ctx.lineTo(halfW, 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    // items
    for (const it of items) {
      const fp = footprintOf(it)
      if (!fp) continue
      let pos = it.position
      if (interaction.type === 'drag-item' && interaction.id === it.id) pos = interaction.current
      const c = worldToScreen(pos)
      const selected = selection?.kind === 'item' && selection.id === it.id

      // light fixtures get a glyph instead of a footprint box
      if (it.light) {
        const r = 9
        ctx.save()
        ctx.strokeStyle = selected ? '#2f6df6' : '#ffcf5c'
        ctx.fillStyle = selected ? 'rgba(47,109,246,0.25)' : 'rgba(255,207,92,0.25)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        for (let k = 0; k < 8; k++) {
          const a2 = (k / 8) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(c.x + Math.cos(a2) * (r + 2), c.y + Math.sin(a2) * (r + 2))
          ctx.lineTo(c.x + Math.cos(a2) * (r + 6), c.y + Math.sin(a2) * (r + 6))
          ctx.stroke()
        }
        ctx.restore()
        continue
      }

      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(it.rotation)
      const w = fp.width * ppm
      const d = fp.depth * ppm
      ctx.fillStyle = hexWithAlpha(fp.color, 0.85)
      ctx.strokeStyle = selected ? '#2f6df6' : 'rgba(0,0,0,0.45)'
      ctx.lineWidth = selected ? 2.5 : 1.5
      ctx.beginPath()
      ctx.rect(-w / 2, -d / 2, w, d)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.moveTo(-w / 2, d / 2)
      ctx.lineTo(0, d / 2 - Math.min(w, d) * 0.25)
      ctx.lineTo(w / 2, d / 2)
      ctx.stroke()
      ctx.restore()
      if (camera.zoom > 0.45) drawLabel(ctx, fp.name, c.x, c.y)
    }

    // in-progress wall preview
    if (interaction.type === 'drawing') {
      const a = worldToScreen(interaction.anchor)
      const snapped = snapDraw(interaction.anchor, mouseWorld)
      const b = worldToScreen(snapped)
      ctx.strokeStyle = '#2f6df6'
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])
      drawLabel(ctx, formatLength(dist(interaction.anchor, snapped), unit), (a.x + b.x) / 2, (a.y + b.y) / 2 - 10)
      ctx.fillStyle = '#2f6df6'
      ctx.beginPath()
      ctx.arc(a.x, a.y, 4, 0, Math.PI * 2)
      ctx.fill()

      // angle indicator vs. a wall connected at the anchor
      const segLen = dist(interaction.anchor, snapped)
      if (segLen > 1e-4) {
        const newAng = Math.atan2(snapped.y - interaction.anchor.y, snapped.x - interaction.anchor.x)
        let bestAng: number | null = null
        let bestDiff = Infinity
        for (const w of walls) {
          let other: Vec2 | null = null
          if (dist(w.start, interaction.anchor) <= 0.01) other = w.end
          else if (dist(w.end, interaction.anchor) <= 0.01) other = w.start
          if (!other) continue
          const wallAng = Math.atan2(other.y - interaction.anchor.y, other.x - interaction.anchor.x)
          let diff = Math.abs(newAng - wallAng)
          while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI)
          if (diff < bestDiff) {
            bestDiff = diff
            bestAng = wallAng
          }
        }
        if (bestAng !== null) drawAngleIndicator(ctx, a, bestAng, newAng)
      }
    }

    // light placement ghost
    if (tool === 'place' && placingLight) {
      const c = worldToScreen(snap(mouseWorld))
      ctx.save()
      ctx.globalAlpha = 0.6
      ctx.strokeStyle = '#ffcf5c'
      ctx.fillStyle = 'rgba(255,207,92,0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(c.x, c.y, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    // place-tool ghost
    if (tool === 'place' && (placingProductId || placingModelId)) {
      let ghost: { width: number; depth: number; color: string } | null = null
      if (placingModelId === '__new__') {
        const c0 = defaultCabinet()
        ghost = { width: c0.width, depth: c0.depth, color: c0.color }
      } else if (placingModelId) {
        const m = store.models.find((x) => x.id === placingModelId)
        if (m) ghost = { width: m.spec.width, depth: m.spec.depth, color: m.spec.color }
      } else if (placingProductId) {
        const prod = productById(placingProductId)
        if (prod) ghost = { width: prod.width, depth: prod.depth, color: prod.color }
      }
      if (ghost) {
        const c = worldToScreen(snap(mouseWorld))
        ctx.save()
        ctx.translate(c.x, c.y)
        ctx.globalAlpha = 0.5
        ctx.fillStyle = ghost.color
        ctx.strokeStyle = '#2f6df6'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.rect((-ghost.width / 2) * ppm, (-ghost.depth / 2) * ppm, ghost.width * ppm, ghost.depth * ppm)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    }
  }, [
    size, walls, openings, items, camera, selection, interaction, mouseWorld,
    tool, placingProductId, placingModelId, placingLight, gridSize, ppm, unit, rooms, roomNames, roomFloors, worldToScreen, snap, snapDraw, store,
  ])

  // inline editable length for the selected wall
  const selectedWall = selection?.kind === 'wall' ? walls.find((w) => w.id === selection.id) : null
  let lenBox: { x: number; y: number } | null = null
  if (selectedWall && interaction.type === 'idle') {
    const a = worldToScreen(selectedWall.start)
    const b = worldToScreen(selectedWall.end)
    lenBox = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  const commitLen = () => {
    if (!selectedWall) return
    const v = parseFloat(lenDraft)
    if (!isNaN(v) && v > 0) store.setWallLength(selectedWall.id, toMeters(v, unit))
  }

  const cursor =
    tool === 'pan' ? 'grab' : tool === 'wall' || tool === 'place' ? 'crosshair' : 'default'

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {lenBox && (
        <div className="len-editor" style={{ left: lenBox.x, top: lenBox.y }}>
          <input
            value={lenDraft}
            onChange={(e) => setLenDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitLen()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            onBlur={commitLen}
            title="Wall length — type a value and press Enter"
          />
          <span className="unit">{unit}</span>
        </div>
      )}

      <div className="canvas-hint">
        <b>Wall tool:</b> left-click to add points · right-click to finish &amp; switch to cursor ·
        hold <b>Shift</b> to snap to right angles · double-click a cabinet to edit
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
function drawGrid(
  ctx: CanvasRenderingContext2D,
  size: { w: number; h: number },
  camera: { zoom: number; panX: number; panY: number },
  gridSize: number,
) {
  const ppm = BASE_PPM * camera.zoom
  const step = gridSize * ppm
  if (step < 6) return
  const startX = camera.panX % step
  const startY = camera.panY % step
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = startX; x < size.w; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size.h)
  }
  for (let y = startY; y < size.h; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(size.w, y)
  }
  ctx.stroke()
  ctx.strokeStyle = 'rgba(120,160,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(camera.panX, 0)
  ctx.lineTo(camera.panX, size.h)
  ctx.moveTo(0, camera.panY)
  ctx.lineTo(size.w, camera.panY)
  ctx.stroke()
}

function drawAngleIndicator(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  fromAng: number,
  toAng: number,
) {
  const R = 28
  let delta = toAng - fromAng
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  const deg = Math.abs((delta * 180) / Math.PI)

  ctx.save()
  ctx.strokeStyle = '#ffcf5c'
  ctx.fillStyle = '#ffcf5c'
  ctx.lineWidth = 1.5
  // arc between the two directions
  ctx.beginPath()
  ctx.arc(center.x, center.y, R, fromAng, toAng, delta < 0)
  ctx.stroke()
  // label at the mid angle
  const mid = fromAng + delta / 2
  const lx = center.x + Math.cos(mid) * (R + 16)
  const ly = center.y + Math.sin(mid) * (R + 16)
  ctx.font = '600 12px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const text = `${deg.toFixed(1)}°`
  const w = ctx.measureText(text).width + 8
  ctx.fillStyle = 'rgba(15,17,21,0.85)'
  ctx.fillRect(lx - w / 2, ly - 9, w, 18)
  ctx.fillStyle = '#ffcf5c'
  ctx.fillText(text, lx, ly)
  ctx.restore()
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = '11px -apple-system, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width + 8
  ctx.fillStyle = 'rgba(15,17,21,0.8)'
  ctx.fillRect(x - w / 2, y - 8, w, 16)
  ctx.fillStyle = '#e6e9ef'
  ctx.fillText(text, x, y)
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
