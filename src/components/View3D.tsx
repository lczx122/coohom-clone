import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import { detectRooms } from '../lib/rooms'
import CabinetModel from './CabinetModel'
import type { Wall } from '../types'

// Plan coordinates map to 3D as: world.x -> x, world.y -> z (depth), height -> y.

function WallMesh({ wall }: { wall: Wall }) {
  const dx = wall.end.x - wall.start.x
  const dy = wall.end.y - wall.start.y
  const length = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  const cx = (wall.start.x + wall.end.x) / 2
  const cz = (wall.start.y + wall.end.y) / 2
  return (
    <mesh position={[cx, wall.height / 2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, wall.height, wall.thickness]} />
      <meshStandardMaterial color="#d6dae0" />
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

/** Procedural light-wood plank texture for "standard" flooring. */
function makeWoodTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#c19a6b'
  ctx.fillRect(0, 0, 256, 256)
  // plank seams + subtle grain
  for (let y = 0; y <= 256; y += 64) {
    ctx.strokeStyle = 'rgba(90,60,30,0.45)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y)
    ctx.stroke()
  }
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(140,100,60,${0.04 + Math.random() * 0.06})`
    ctx.lineWidth = 1
    const y = Math.random() * 256
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y + (Math.random() * 8 - 4))
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(0.8, 0.8) // ~1.25 m per plank-block
  return tex
}

function RoomFloors() {
  const walls = useDesignStore((s) => s.walls)
  const rooms = useMemo(() => detectRooms(walls), [walls])
  const tex = useMemo(() => makeWoodTexture(), [])
  return (
    <>
      {rooms.map((r) => {
        const shape = new THREE.Shape()
        r.polygon.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)))
        shape.closePath()
        return (
          <mesh key={r.key} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.85} metalness={0} />
          </mesh>
        )
      })}
    </>
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

  return (
    <div className="canvas-wrap">
      <Canvas shadows camera={{ position: [center.x + 6, 6, center.z + 6], fov: 50 }}>
        <color attach="background" args={['#0c0e12']} />
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#ffffff', '#444a55', 0.6]} />
        <directionalLight
          position={[10, 15, 8]}
          intensity={0.9}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
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
        {/* base ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.01, center.z]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#11151c" />
        </mesh>

        <RoomFloors />

        {walls.map((w) => (
          <WallMesh key={w.id} wall={w} />
        ))}

        {items.map((it) => {
          if (it.cabinet) {
            return (
              <group key={it.id} position={[it.position.x, 0, it.position.y]} rotation={[0, -it.rotation, 0]}>
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

        <OrbitControls target={[center.x, 1, center.z]} makeDefault />
        <WasdControls />
      </Canvas>
      <div className="canvas-hint">
        <b>3D view</b> · <b>WASD</b> to move · <b>Q/E</b> up/down · Shift to go faster ·
        drag to look · scroll to zoom
      </div>
    </div>
  )
}
