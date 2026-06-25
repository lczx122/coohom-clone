import { useCallback, useEffect, useRef, useState } from 'react'
import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import type { Vec2 } from '../types'
import {
  dist,
  lerp,
  nearestWall,
  snapToEndpoints,
  snapToGrid,
  sub,
} from '../lib/geometry'

const BASE_PPM = 100 // pixels per meter at zoom = 1

type Interaction =
  | { type: 'idle' }
  | { type: 'panning'; startScreen: Vec2; startPan: { x: number; y: number } }
  | { type: 'drawing'; anchor: Vec2 }
  | { type: 'drag-item'; id: string; grabOffset: Vec2; current: Vec2 }
  | { type: 'drag-wall'; id: string; start0: Vec2; end0: Vec2; grab: Vec2; current: Vec2 }
  | { type: 'drag-endpoint'; id: string; which: 'start' | 'end'; current: Vec2 }
  | { type: 'drag-opening'; id: string; current: Vec2 }

export default function FloorPlanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [interaction, setInteraction] = useState<Interaction>({ type: 'idle' })
  const [mouseWorld, setMouseWorld] = useState<Vec2>({ x: 0, y: 0 })

  const store = useDesignStore()
  const {
    walls,
    openings,
    items,
    camera,
    tool,
    selection,
    placingProductId,
    snapEnabled,
    snapIncrement,
    gridSize,
  } = store

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

  /** Snap a world point: endpoints first, then grid. */
  const snap = useCallback(
    (p: Vec2): Vec2 => {
      if (!snapEnabled) return p
      const endpointThreshold = 12 / ppm
      const ep = snapToEndpoints(p, walls, endpointThreshold)
      if (ep) return ep
      return snapToGrid(p, snapIncrement)
    },
    [snapEnabled, ppm, walls, snapIncrement],
  )

  // ----- resize handling -----
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // ----- hit testing -----
  const itemAt = useCallback(
    (p: Vec2) => {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]
        const prod = productById(it.productId)
        if (!prod) continue
        // transform point into the item's local frame
        const d = sub(p, it.position)
        const c = Math.cos(-it.rotation)
        const s = Math.sin(-it.rotation)
        const lx = d.x * c - d.y * s
        const ly = d.x * s + d.y * c
        if (Math.abs(lx) <= prod.width / 2 && Math.abs(ly) <= prod.depth / 2) {
          return it
        }
      }
      return null
    },
    [items],
  )

  // ----- pointer handlers -----
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      canvasRef.current?.setPointerCapture(e.pointerId)
      const screen = getMouse(e)
      const world = screenToWorld(screen)
      const middle = e.button === 1
      const space = (e as unknown as { getModifierState?: (k: string) => boolean }).getModifierState?.(' ')

      // Pan: middle mouse, pan tool, or space held
      if (middle || tool === 'pan' || space) {
        setInteraction({
          type: 'panning',
          startScreen: screen,
          startPan: { x: camera.panX, y: camera.panY },
        })
        return
      }

      if (tool === 'wall') {
        const p = snap(world)
        if (interaction.type === 'drawing') {
          // commit a segment from anchor -> p, continue chain from p
          if (dist(interaction.anchor, p) > 0.01) {
            store.addWall(interaction.anchor, p)
            setInteraction({ type: 'drawing', anchor: p })
          }
        } else {
          setInteraction({ type: 'drawing', anchor: p })
        }
        return
      }

      if (tool === 'door' || tool === 'window') {
        const hit = nearestWall(world, walls, 0.4)
        if (hit) store.addOpening(hit.wall.id, hit.t, tool)
        return
      }

      if (tool === 'place' && placingProductId) {
        const id = store.addItem(placingProductId, snap(world))
        store.setSelection({ kind: 'item', id })
        return
      }

      // ----- select tool -----
      // 1) endpoint handle of a selected wall
      if (selection?.kind === 'wall') {
        const w = walls.find((x) => x.id === selection.id)
        if (w) {
          const handleR = 10 / ppm
          if (dist(world, w.start) <= handleR) {
            setInteraction({ type: 'drag-endpoint', id: w.id, which: 'start', current: w.start })
            return
          }
          if (dist(world, w.end) <= handleR) {
            setInteraction({ type: 'drag-endpoint', id: w.id, which: 'end', current: w.end })
            return
          }
        }
      }

      // 2) items
      const it = itemAt(world)
      if (it) {
        store.setSelection({ kind: 'item', id: it.id })
        setInteraction({ type: 'drag-item', id: it.id, grabOffset: sub(world, it.position), current: it.position })
        return
      }

      // 3) openings
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

      // 4) walls
      const wallHit = nearestWall(world, walls, 0.15)
      if (wallHit) {
        store.setSelection({ kind: 'wall', id: wallHit.wall.id })
        setInteraction({
          type: 'drag-wall',
          id: wallHit.wall.id,
          start0: wallHit.wall.start,
          end0: wallHit.wall.end,
          grab: world,
          current: world,
        })
        return
      }

      store.setSelection(null)
    },
    [tool, interaction, selection, walls, openings, camera, placingProductId, ppm, snap, screenToWorld, getMouse, itemAt, store],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const screen = getMouse(e)
      const world = screenToWorld(screen)
      setMouseWorld(world)

      switch (interaction.type) {
        case 'panning': {
          store.setCamera({
            panX: interaction.startPan.x + (screen.x - interaction.startScreen.x),
            panY: interaction.startPan.y + (screen.y - interaction.startScreen.y),
          })
          break
        }
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
        case 'drag-item':
          store.updateItem(interaction.id, { position: interaction.current })
          setInteraction({ type: 'idle' })
          break
        case 'drag-endpoint':
          store.updateWall(interaction.id, { [interaction.which]: interaction.current })
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
          const w = walls.find((x) => x.id === store.openings.find((o) => o.id === interaction.id)?.wallId)
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
        // 'drawing' stays active across clicks; ended via keyboard/dblclick
        default:
          break
      }
    },
    [interaction, walls, store],
  )

  const onDoubleClick = useCallback(() => {
    if (interaction.type === 'drawing') setInteraction({ type: 'idle' })
  }, [interaction])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const screen = getMouse(e)
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.min(8, Math.max(0.15, camera.zoom * factor))
      // keep the world point under the cursor fixed
      const wx = (screen.x - camera.panX) / (BASE_PPM * camera.zoom)
      const wy = (screen.y - camera.panY) / (BASE_PPM * camera.zoom)
      store.setCamera({
        zoom: newZoom,
        panX: screen.x - wx * BASE_PPM * newZoom,
        panY: screen.y - wy * BASE_PPM * newZoom,
      })
    },
    [camera, getMouse, store],
  )

  // cancel drawing on Escape (handled globally too, but keep local safety)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && interaction.type === 'drawing') {
        setInteraction({ type: 'idle' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [interaction])

  // ----- drawing the scene -----
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

    // effective geometry (apply live drag overrides for smooth feedback)
    const effWalls = walls.map((w) => {
      if (interaction.type === 'drag-endpoint' && interaction.id === w.id) {
        return { ...w, [interaction.which]: interaction.current }
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

    // walls
    for (const w of effWalls) {
      const a = worldToScreen(w.start)
      const b = worldToScreen(w.end)
      const selected = selection?.kind === 'wall' && selection.id === w.id
      ctx.lineCap = 'round'
      ctx.strokeStyle = selected ? '#2f6df6' : '#cbd3e1'
      ctx.lineWidth = Math.max(2, w.thickness * ppm)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()

      // dimension label
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const length = dist(w.start, w.end)
      drawLabel(ctx, `${length.toFixed(2)} m`, mid.x, mid.y - Math.max(8, w.thickness * ppm))

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
      const angle = Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x)
      const halfW = (o.width / 2) * ppm
      const selected = selection?.kind === 'opening' && selection.id === o.id
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(angle)
      // gap (draw over the wall in background color)
      ctx.fillStyle = '#0c0e12'
      const t = Math.max(2, w.thickness * ppm) + 2
      ctx.fillRect(-halfW, -t / 2, halfW * 2, t)
      // symbol
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
      const prod = productById(it.productId)
      if (!prod) continue
      let pos = it.position
      if (interaction.type === 'drag-item' && interaction.id === it.id) pos = interaction.current
      const c = worldToScreen(pos)
      const selected = selection?.kind === 'item' && selection.id === it.id
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(it.rotation)
      const w = prod.width * ppm
      const d = prod.depth * ppm
      ctx.fillStyle = hexWithAlpha(prod.color, 0.85)
      ctx.strokeStyle = selected ? '#2f6df6' : 'rgba(0,0,0,0.45)'
      ctx.lineWidth = selected ? 2.5 : 1.5
      ctx.beginPath()
      ctx.rect(-w / 2, -d / 2, w, d)
      ctx.fill()
      ctx.stroke()
      // front-facing indicator (a line on +y edge)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.moveTo(-w / 2, d / 2)
      ctx.lineTo(0, d / 2 - Math.min(w, d) * 0.25)
      ctx.lineTo(w / 2, d / 2)
      ctx.stroke()
      ctx.restore()
      if (camera.zoom > 0.45) drawLabel(ctx, prod.name, c.x, c.y)
    }

    // in-progress wall preview
    if (interaction.type === 'drawing') {
      const a = worldToScreen(interaction.anchor)
      const snapped = snap(mouseWorld)
      const b = worldToScreen(snapped)
      ctx.strokeStyle = '#2f6df6'
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])
      const length = dist(interaction.anchor, snapped)
      drawLabel(ctx, `${length.toFixed(2)} m`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 10)
      // anchor dot
      ctx.fillStyle = '#2f6df6'
      ctx.beginPath()
      ctx.arc(a.x, a.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // place-tool ghost
    if (tool === 'place' && placingProductId) {
      const prod = productById(placingProductId)
      if (prod) {
        const c = worldToScreen(snap(mouseWorld))
        ctx.save()
        ctx.translate(c.x, c.y)
        ctx.globalAlpha = 0.5
        ctx.fillStyle = prod.color
        ctx.strokeStyle = '#2f6df6'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.rect((-prod.width / 2) * ppm, (-prod.depth / 2) * ppm, prod.width * ppm, prod.depth * ppm)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    }
  }, [
    size, walls, openings, items, camera, selection, interaction, mouseWorld,
    tool, placingProductId, gridSize, ppm, worldToScreen, snap,
  ])

  const cursor =
    tool === 'pan'
      ? 'grab'
      : tool === 'wall' || tool === 'place'
      ? 'crosshair'
      : 'default'

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
        onContextMenu={(e) => {
          e.preventDefault()
          if (interaction.type === 'drawing') setInteraction({ type: 'idle' })
        }}
      />
    </div>
  )
}

// ----------------------------------------------------------------------------
// drawing helpers
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

  // origin axes
  ctx.strokeStyle = 'rgba(120,160,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(camera.panX, 0)
  ctx.lineTo(camera.panX, size.h)
  ctx.moveTo(0, camera.panY)
  ctx.lineTo(size.w, camera.panY)
  ctx.stroke()
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
