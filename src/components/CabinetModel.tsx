import { useMemo } from 'react'
import type { CabinetSpec } from '../types'
import { accessoryType } from '../data/cabinet'

// Renders a parametric cabinet from a CabinetSpec. The cabinet sits with its
// base on y=0 and is centred on x/z. Reused by the editor preview and View3D.

function Panel({
  size,
  position,
  color,
}: {
  size: [number, number, number]
  position: [number, number, number]
  color: string
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} metalness={0.05} />
    </mesh>
  )
}

function Door({
  hingeX,
  dirSign,
  width,
  height,
  z,
  thickness,
  color,
  open,
}: {
  hingeX: number
  dirSign: 1 | -1
  width: number
  height: number
  z: number
  thickness: number
  color: string
  open: boolean
}) {
  const angle = open ? dirSign * (-1.7) : 0 // ~97° swing
  return (
    <group position={[hingeX, height / 2 + 0, z]} rotation={[0, angle, 0]}>
      {/* door panel, extends from the hinge in dirSign direction */}
      <mesh position={[(dirSign * width) / 2, 0, 0]} castShadow>
        <boxGeometry args={[width, height, thickness]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* handle near the free edge */}
      <mesh position={[dirSign * (width - 0.03), 0, thickness / 2 + 0.012]}>
        <boxGeometry args={[0.018, Math.min(0.12, height * 0.25), 0.018]} />
        <meshStandardMaterial color="#cfd3d8" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* hinges on the hinge axis */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * (height / 2 - 0.08), -thickness / 2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.05, 12]} />
          <meshStandardMaterial color="#b8bcc2" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function Accessory({
  typeKey,
  W,
  H,
  D,
  t,
  level,
}: {
  typeKey: string
  W: number
  H: number
  D: number
  t: number
  level: number
}) {
  const at = accessoryType(typeKey)
  const color = at?.color ?? '#b0b4ba'
  const innerW = W - 2 * t - 0.02
  const innerD = D - 2 * t - 0.02
  const y = t + 0.02 + level * Math.max(0.01, H - 2 * t - 0.2)

  if (typeKey === 'trash') {
    const r = Math.min(innerW, innerD) / 2.6
    return (
      <mesh position={[0, t + 0.2, 0]} castShadow>
        <cylinderGeometry args={[r, r * 0.85, 0.4, 20]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.4} />
      </mesh>
    )
  }

  let size: [number, number, number]
  switch (typeKey) {
    case 'drawer':
      size = [innerW, 0.14, innerD]
      break
    case 'wine':
      size = [innerW, 0.2, innerD]
      break
    case 'spice':
      size = [Math.min(0.16, innerW), 0.3, innerD]
      break
    case 'cutlery':
      size = [innerW, 0.04, innerD * 0.7]
      break
    default: // dish-rack, basket
      size = [innerW, 0.1, innerD]
  }
  return (
    <mesh position={[0, y + size[1] / 2, 0]} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
    </mesh>
  )
}

export default function CabinetModel({
  spec,
  open = false,
}: {
  spec: CabinetSpec
  open?: boolean
}) {
  const { width: W, height: H, depth: D, panelThickness: t, color } = spec
  const back = useMemo(() => shade(color, -0.12), [color])

  const shelfYs: number[] = []
  for (let i = 1; i <= spec.shelves; i++) shelfYs.push((H * i) / (spec.shelves + 1))

  const gap = 0.003
  const td = 0.018
  const doorZ = D / 2 + td / 2
  const dh = H - 2 * gap

  return (
    <group>
      {/* carcass */}
      <Panel size={[t, H, D]} position={[-W / 2 + t / 2, H / 2, 0]} color={color} />
      <Panel size={[t, H, D]} position={[W / 2 - t / 2, H / 2, 0]} color={color} />
      <Panel size={[W - 2 * t, t, D]} position={[0, t / 2, 0]} color={color} />
      <Panel size={[W - 2 * t, t, D]} position={[0, H - t / 2, 0]} color={color} />
      <Panel size={[W - 2 * t, H - 2 * t, t]} position={[0, H / 2, -D / 2 + t / 2]} color={back} />

      {/* shelves */}
      {shelfYs.map((y, i) => (
        <Panel key={i} size={[W - 2 * t, t, D - t]} position={[0, y, t / 2]} color={shade(color, -0.04)} />
      ))}

      {/* accessories */}
      {spec.accessories.map((a) => (
        <Accessory key={a.id} typeKey={a.type} W={W} H={H} D={D} t={t} level={a.level} />
      ))}

      {/* doors */}
      {spec.doors === 'double' && (
        <>
          <Door hingeX={-W / 2 + gap} dirSign={1} width={W / 2 - gap * 1.5} height={dh} z={doorZ} thickness={td} color={color} open={open} />
          <Door hingeX={W / 2 - gap} dirSign={-1} width={W / 2 - gap * 1.5} height={dh} z={doorZ} thickness={td} color={color} open={open} />
        </>
      )}
      {spec.doors === 'single-left' && (
        <Door hingeX={-W / 2 + gap} dirSign={1} width={W - 2 * gap} height={dh} z={doorZ} thickness={td} color={color} open={open} />
      )}
      {spec.doors === 'single-right' && (
        <Door hingeX={W / 2 - gap} dirSign={-1} width={W - 2 * gap} height={dh} z={doorZ} thickness={td} color={color} open={open} />
      )}
    </group>
  )
}

/** Lighten (amount>0) or darken (amount<0) a hex color. */
function shade(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amount)))
  return `#${[adj(r), adj(g), adj(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
