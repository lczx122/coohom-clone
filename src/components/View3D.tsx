import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Sky } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import { detectRooms } from '../lib/rooms'
import { DEFAULT_FLOORING, flooringByKey, floorings } from '../data/flooring'
import type { FloorKind } from '../data/flooring'
import { defaultCabinet, defaultWallCabinet } from '../data/cabinet'
import { snapToWall } from '../lib/geometry'
import CabinetModel from './CabinetModel'
import type { CabinetSpec, PlacedItem, Vec2, Wall } from '../types'

const DEFAULT_WALL_COLOR = '#d6dae0'

// Plan coordinates map to 3D as: world.x -> x, world.y -> z (depth), height -> y.

// ---------------------------------------------------------------------------
// 3D sketch-to-cabinet: transcribe a 2D screen stroke into a cabinet by
// ray-casting onto the floor and reading width/height from the drawn box.
// ---------------------------------------------------------------------------
interface SketchPreview {
  spec: CabinetSpec
  position: Vec2
  rotation: number
}

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const RAY = new THREE.Raycaster()

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function screenToFloor(px: number, py: number, rect: { width: number; height: number }, camera: THREE.Camera) {
  const ndc = new THREE.Vector2((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1)
  RAY.setFromCamera(ndc, camera)
  const out = new THREE.Vector3()
  return RAY.ray.intersectPlane(FLOOR_PLANE, out) ? out : null
}

function screenToPlane(px: number, py: number, rect: { width: number; height: number }, camera: THREE.Camera, plane: THREE.Plane) {
  const ndc = new THREE.Vector2((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1)
  RAY.setFromCamera(ndc, camera)
  const out = new THREE.Vector3()
  return RAY.ray.intersectPlane(plane, out) ? out : null
}

function worldToScreenPt(v: THREE.Vector3, rect: { width: number; height: number }, camera: THREE.Camera) {
  const p = v.clone().project(camera)
  return { x: (p.x * 0.5 + 0.5) * rect.width, y: (-p.y * 0.5 + 0.5) * rect.height }
}

function pxPerMeterAt(p: THREE.Vector3, rect: { width: number; height: number }, camera: THREE.Camera) {
  const sB = worldToScreenPt(p, rect, camera)
  const sUp = worldToScreenPt(p.clone().add(new THREE.Vector3(0, 1, 0)), rect, camera)
  const v = Math.abs(sB.y - sUp.y)
  return v < 2 ? 120 : v
}

function transcribeStroke(
  stroke: { x: number; y: number }[],
  rect: { width: number; height: number },
  camera: THREE.Camera,
  scene: THREE.Scene,
  walls: Wall[],
): SketchPreview | null {
  if (stroke.length < 2) return null
  const xs = stroke.map((p) => p.x)
  const ys = stroke.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  if (maxX - minX < 8 || maxY - minY < 8) return null

  let candidate: Vec2
  let width: number
  let height: number
  let onWall = false
  let wallMounted = false
  let mountHeight = 0

  // 1) does the stroke land on a wall? -> place flush against it (depth inferred)
  const cndc = new THREE.Vector2(((minX + maxX) / 2 / rect.width) * 2 - 1, -((minY + maxY) / 2 / rect.height) * 2 + 1)
  RAY.setFromCamera(cndc, camera)
  const hits = RAY.intersectObjects(scene.children, true)
  const wallHit = hits.find((h) => h.object.userData && h.object.userData.isWall)

  if (wallHit) {
    onWall = true
    const p = wallHit.point
    candidate = { x: p.x, y: p.z }
    const normal = wallHit.face
      ? wallHit.face.normal.clone().transformDirection(wallHit.object.matrixWorld)
      : new THREE.Vector3(0, 0, 1)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p)
    const pL = screenToPlane(minX, (minY + maxY) / 2, rect, camera, plane)
    const pR = screenToPlane(maxX, (minY + maxY) / 2, rect, camera, plane)
    width = pL && pR ? clamp(Math.hypot(pL.x - pR.x, pL.z - pR.z), 0.2, 4) : 0.6
    height = clamp((maxY - minY) / pxPerMeterAt(p, rect, camera), 0.2, 3)
    // if the box sits high on the wall, make it a wall (upper) cabinet
    const bottom = screenToPlane((minX + maxX) / 2, maxY, rect, camera, plane)
    const by = bottom ? bottom.y : 0
    if (by > 0.6) {
      wallMounted = true
      mountHeight = clamp(by, 0, 2.4)
    }
  } else {
    const base = screenToFloor((minX + maxX) / 2, maxY, rect, camera)
    const left = screenToFloor(minX, maxY, rect, camera)
    const right = screenToFloor(maxX, maxY, rect, camera)
    if (!base || !left || !right) return null
    candidate = { x: base.x, y: base.z }
    width = clamp(Math.hypot(left.x - right.x, left.z - right.z), 0.2, 4)
    height = clamp((maxY - minY) / pxPerMeterAt(base, rect, camera), 0.2, 3)
  }

  const depth = wallMounted ? 0.35 : 0.6

  // 2) snap to the nearest wall (definitely when drawn on a wall)
  const snap = snapToWall(candidate, depth, walls, onWall ? 3 : 0.7)
  let position: Vec2
  let rotation: number
  if (snap) {
    position = snap.position
    rotation = snap.rotation
  } else {
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0
    if (fwd.lengthSq() < 1e-6) return null
    fwd.normalize()
    position = { x: candidate.x + (fwd.x * depth) / 2, y: candidate.y + (fwd.z * depth) / 2 }
    rotation = Math.atan2(fwd.x, -fwd.z)
  }

  const spec = wallMounted
    ? { ...defaultWallCabinet('Wall Cabinet'), width, height, depth, mountHeight }
    : { ...defaultCabinet('Cabinet'), width, height, depth }

  return { spec, position, rotation }
}

/** Keeps a live reference to the R3F camera + scene for the screen-space overlay. */
function CameraTap({ tapRef }: { tapRef: React.MutableRefObject<{ camera: THREE.Camera; scene: THREE.Scene } | null> }) {
  useFrame(({ camera, scene }) => {
    tapRef.current = { camera, scene }
  })
  return null
}

function WallMesh({ wall }: { wall: Wall }) {
  const dx = wall.end.x - wall.start.x
  const dy = wall.end.y - wall.start.y
  const length = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  const cx = (wall.start.x + wall.end.x) / 2
  const cz = (wall.start.y + wall.end.y) / 2
  return (
    <mesh
      position={[cx, wall.height / 2, cz]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
      userData={{ isWall: true, wallId: wall.id }}
    >
      <boxGeometry args={[length, wall.height, wall.thickness]} />
      <meshStandardMaterial color={wall.color ?? DEFAULT_WALL_COLOR} />
    </mesh>
  )
}

function ItemMesh({
  position, rotation, width, depth, height, color,
}: {
  position: [number, number]
  rotation: number
  width: number
  depth: number
  height: number
  color: string
}) {
  return (
    <mesh position={[position[0], height / 2, position[1]]} rotation={[0, -rotation, 0]} castShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

/** Procedural floor texture per flooring kind. */
function makeFloorTexture(kind: FloorKind, color: string): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 256, 256)

  if (kind === 'wood') {
    for (let y = 0; y <= 256; y += 64) {
      ctx.strokeStyle = 'rgba(60,40,20,0.45)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(256, y)
      ctx.stroke()
    }
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(80,55,30,${0.04 + Math.random() * 0.06})`
      const y = Math.random() * 256
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(256, y + (Math.random() * 8 - 4))
      ctx.stroke()
    }
  } else if (kind === 'tile') {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 3
    for (let p = 0; p <= 256; p += 128) {
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(256, p); ctx.stroke()
    }
  } else if (kind === 'stone') {
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`
      const r = 6 + Math.random() * 22
      ctx.beginPath()
      ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'carpet') {
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
    }
  } else {
    // concrete
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3)
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(kind === 'tile' ? 1.5 : 0.8, kind === 'tile' ? 1.5 : 0.8)
  return tex
}

function RoomFloors() {
  const walls = useDesignStore((s) => s.walls)
  const roomFloors = useDesignStore((s) => s.roomFloors)
  const rooms = useMemo(() => detectRooms(walls), [walls])
  // one texture per flooring preset, reused across rooms
  const textures = useMemo(() => {
    const map = new Map<string, THREE.Texture>()
    for (const f of floorings) map.set(f.key, makeFloorTexture(f.kind, f.color))
    return map
  }, [])
  return (
    <>
      {rooms.map((r) => {
        const shape = new THREE.Shape()
        r.polygon.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)))
        shape.closePath()
        const fl = flooringByKey(roomFloors[r.key] ?? DEFAULT_FLOORING)
        return (
          <mesh key={r.key} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial map={textures.get(fl.key)} side={THREE.DoubleSide} roughness={0.85} metalness={0} />
          </mesh>
        )
      })}
    </>
  )
}

/** A placeable light: a point light plus a glowing bulb mesh. */
function LightFixture({ item }: { item: PlacedItem }) {
  const l = item.light!
  return (
    <group position={[item.position.x, l.height, item.position.y]}>
      <pointLight color={l.color} intensity={l.intensity * 6} distance={9} decay={2} />
      <mesh>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={2.5} />
      </mesh>
    </group>
  )
}

/** WASD movement layered on top of OrbitControls (free-fly the camera). */
function WasdControls({ speed = 4 }: { speed?: number }) {
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.Camera
    controls: { target: THREE.Vector3; update: () => void } | null
  }
  const keys = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement
      return el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')
    }
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return
      keys.current[e.key.toLowerCase()] = true
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useFrame((_, delta) => {
    if (!controls) return
    const k = keys.current
    const move = new THREE.Vector3()

    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    right.y = 0
    right.normalize()

    if (k['w']) move.add(forward)
    if (k['s']) move.sub(forward)
    if (k['d']) move.add(right)
    if (k['a']) move.sub(right)
    if (k['e']) move.y += 1
    if (k['q']) move.y -= 1

    if (move.lengthSq() > 0) {
      const boost = k['shift'] ? 2.4 : 1
      move.normalize().multiplyScalar(speed * boost * delta)
      camera.position.add(move)
      controls.target.add(move)
      controls.update()
    }
  })

  return null
}

export default function View3D() {
  const walls = useDesignStore((s) => s.walls)
  const items = useDesignStore((s) => s.items)
  const environment = useDesignStore((s) => s.environment)
  const setEnvironment = useDesignStore((s) => s.setEnvironment)
  const addCabinetItem = useDesignStore((s) => s.addCabinetItem)
  const updateItem = useDesignStore((s) => s.updateItem)

  // 3D sketch-to-cabinet
  const [sketch3d, setSketch3d] = useState(false)
  const [preview, setPreview] = useState<SketchPreview | null>(null)
  const tapRef = useRef<{ camera: THREE.Camera; scene: THREE.Scene } | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const strokeRef = useRef<{ x: number; y: number }[]>([])
  const drawingRef = useRef(false)
  const penActiveRef = useRef(false)

  // size the drawing overlay to the canvas when sketch mode turns on
  useEffect(() => {
    if (!sketch3d) {
      setPreview(null)
      strokeRef.current = []
      return
    }
    const cv = overlayRef.current
    const wrap = cv?.parentElement
    if (cv && wrap) {
      cv.width = wrap.clientWidth
      cv.height = wrap.clientHeight
    }
  }, [sketch3d])

  const redrawOverlay = () => {
    const cv = overlayRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    const pts = strokeRef.current
    if (pts.length < 2) return
    ctx.strokeStyle = '#2f6df6'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.stroke()
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    ctx.strokeStyle = 'rgba(47,109,246,0.45)'
    ctx.setLineDash([5, 4])
    ctx.strokeRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    ctx.setLineDash([])
  }

  const relPoint = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect }
  }

  const onSketchDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') penActiveRef.current = true
    // palm rejection: ignore touch while a stylus is in use, or large contacts
    if (e.pointerType === 'touch' && (penActiveRef.current || e.width > 45 || e.height > 45)) return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* not capturable */
    }
    const { x, y } = relPoint(e)
    strokeRef.current = [{ x, y }]
    drawingRef.current = true
  }

  const onSketchMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return
    const { x, y, rect } = relPoint(e)
    const last = strokeRef.current[strokeRef.current.length - 1]
    if (last && Math.hypot(x - last.x, y - last.y) < 2) return
    strokeRef.current.push({ x, y })
    redrawOverlay()
    const tap = tapRef.current
    if (tap) setPreview(transcribeStroke(strokeRef.current, rect, tap.camera, tap.scene, walls))
  }

  // a finished stroke just updates the (editable) preview — it is not committed
  // until the user clicks Done.
  const onSketchUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') penActiveRef.current = false
    if (!drawingRef.current) return
    drawingRef.current = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
    const rect = overlayRef.current!.getBoundingClientRect()
    const tap = tapRef.current
    if (tap) setPreview(transcribeStroke(strokeRef.current, rect, tap.camera, tap.scene, walls))
  }

  const commitSketch = () => {
    if (!preview) return
    const id = addCabinetItem(preview.spec, preview.position)
    updateItem(id, { rotation: preview.rotation })
    strokeRef.current = []
    setPreview(null)
    redrawOverlay()
  }

  const clearSketch = () => {
    strokeRef.current = []
    setPreview(null)
    redrawOverlay()
  }

  const center = useMemo(() => {
    let sx = 0
    let sz = 0
    let n = 0
    for (const w of walls) {
      sx += w.start.x + w.end.x
      sz += w.start.y + w.end.y
      n += 2
    }
    for (const it of items) {
      sx += it.position.x
      sz += it.position.y
      n += 1
    }
    if (n === 0) return { x: 0, z: 0 }
    return { x: sx / n, z: sz / n }
  }, [walls, items])

  const outdoor = environment === 'outdoor'

  return (
    <div className="canvas-wrap">
      <Canvas shadows camera={{ position: [center.x + 6, 6, center.z + 6], fov: 50, near: 0.05, far: 600000 }}>
        {outdoor ? (
          <>
            <Sky distance={450000} sunPosition={[8, 6, 5]} turbidity={6} rayleigh={1.5} />
            <hemisphereLight args={['#bcd7ff', '#6b7a55', 0.8]} />
            <ambientLight intensity={0.35} />
            <directionalLight
              position={[8, 12, 5]}
              intensity={2.0}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            {/* grass ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.01, center.z]} receiveShadow>
              <planeGeometry args={[200, 200]} />
              <meshStandardMaterial color="#5f7a43" roughness={1} />
            </mesh>
          </>
        ) : (
          <>
            <color attach="background" args={['#0c0e12']} />
            <ambientLight intensity={0.8} />
            <hemisphereLight args={['#ffffff', '#444a55', 0.6]} />
            <directionalLight
              position={[10, 15, 8]}
              intensity={0.9}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <Grid
              args={[40, 40]}
              cellSize={1}
              cellColor="#2a313d"
              sectionSize={5}
              sectionColor="#3a4555"
              infiniteGrid
              fadeDistance={50}
              position={[0, 0, 0]}
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.01, center.z]} receiveShadow>
              <planeGeometry args={[80, 80]} />
              <meshStandardMaterial color="#11151c" />
            </mesh>
          </>
        )}

        <RoomFloors />

        {walls.map((w) => (
          <WallMesh key={w.id} wall={w} />
        ))}

        {items.map((it) => {
          if (it.light) return <LightFixture key={it.id} item={it} />
          if (it.cabinet) {
            const baseY = it.cabinet.kind === 'wall' ? it.cabinet.mountHeight ?? 1.5 : 0
            return (
              <group key={it.id} position={[it.position.x, baseY, it.position.y]} rotation={[0, -it.rotation, 0]}>
                <CabinetModel spec={it.cabinet} />
              </group>
            )
          }
          const prod = productById(it.productId)
          if (!prod) return null
          return (
            <ItemMesh
              key={it.id}
              position={[it.position.x, it.position.y]}
              rotation={it.rotation}
              width={prod.width}
              depth={prod.depth}
              height={prod.height}
              color={prod.color}
            />
          )
        })}

        {/* live preview of the sketched cabinet */}
        {preview && (
          <group position={[preview.position.x, 0, preview.position.y]} rotation={[0, -preview.rotation, 0]}>
            <CabinetModel spec={preview.spec} />
          </group>
        )}

        <CameraTap tapRef={tapRef} />
        <OrbitControls enabled={!sketch3d} target={[center.x, 1, center.z]} makeDefault />
        {!sketch3d && <WasdControls />}
      </Canvas>

      {sketch3d && (
        <canvas
          ref={overlayRef}
          className="sketch3d-overlay"
          onPointerDown={onSketchDown}
          onPointerMove={onSketchMove}
          onPointerUp={onSketchUp}
        />
      )}

      {sketch3d && (
        <div className="sketch3d-controls">
          <button className="icon-btn primary" onClick={commitSketch} disabled={!preview}>
            Done — place cabinet
          </button>
          <button className="icon-btn" onClick={clearSketch} disabled={!preview}>
            Clear
          </button>
        </div>
      )}

      <div className="view-env">
        <button
          className={`tool-btn ${sketch3d ? 'active' : ''}`}
          onClick={() => setSketch3d((v) => !v)}
          style={{ minWidth: 64 }}
          title="Freeze the view and sketch a cabinet"
        >
          ✎ Sketch
        </button>
        <button className={`tool-btn ${!outdoor ? 'active' : ''}`} onClick={() => setEnvironment('studio')} style={{ minWidth: 56 }} disabled={sketch3d}>
          Studio
        </button>
        <button className={`tool-btn ${outdoor ? 'active' : ''}`} onClick={() => setEnvironment('outdoor')} style={{ minWidth: 56 }} disabled={sketch3d}>
          Outdoor
        </button>
      </div>

      <div className="canvas-hint">
        {sketch3d ? (
          <>
            <b>Sketch a cabinet:</b> the view is frozen — draw a box on a wall or the floor
            (redraw to adjust), then click <b>Done</b> to place it. It snaps to the nearest
            wall. Toggle <b>✎ Sketch</b> off to move the camera again.
          </>
        ) : (
          <>
            <b>3D view</b> · <b>WASD</b> to move · <b>Q/E</b> up/down · Shift to go faster ·
            drag to look · scroll to zoom
          </>
        )}
      </div>
    </div>
  )
}
