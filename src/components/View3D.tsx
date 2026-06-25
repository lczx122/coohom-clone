import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { useMemo } from 'react'
import { useDesignStore } from '../store/useDesignStore'
import { productById } from '../data/catalog'
import type { Wall } from '../types'

// World plan coordinates: x -> x, y -> z (depth). Height -> y (up).

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
  position,
  rotation,
  width,
  depth,
  height,
  color,
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

export default function View3D() {
  const walls = useDesignStore((s) => s.walls)
  const items = useDesignStore((s) => s.items)

  const center = useMemo(() => {
    if (walls.length === 0) return { x: 0, z: 0 }
    let sx = 0
    let sz = 0
    let n = 0
    for (const w of walls) {
      sx += w.start.x + w.end.x
      sz += w.start.y + w.end.y
      n += 2
    }
    return { x: sx / n, z: sz / n }
  }, [walls])

  return (
    <div className="canvas-wrap">
      <Canvas shadows camera={{ position: [center.x + 6, 6, center.z + 6], fov: 50 }}>
        <color attach="background" args={['#0c0e12']} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 15, 8]}
          intensity={1.1}
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
          fadeDistance={40}
          position={[0, 0, 0]}
        />
        {/* floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.01, center.z]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#11151c" />
        </mesh>

        {walls.map((w) => (
          <WallMesh key={w.id} wall={w} />
        ))}

        {items.map((it) => {
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
      </Canvas>
      <div className="canvas-hint">
        <b>3D preview</b> · drag to orbit · scroll to zoom · right-drag to pan
      </div>
    </div>
  )
}
