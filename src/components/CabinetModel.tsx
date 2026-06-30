import type { CabinetSpec } from '../types'
import { accessoryType } from '../data/cabinet'

// Renders a parametric cabinet from a CabinetSpec. The cabinet sits with its
// base on y=0 and is centred on x/z. Reused by the editor preview and View3D.

const GAP = 0.004
const TD = 0.018 // door / drawer-front thickness

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

function Handle({ position, kind, vertical = true, length = 0.1 }: { position: [number, number, number]; kind: 'bar' | 'knob'; vertical?: boolean; length?: number }) {
  if (kind === 'knob') {
    return (
      <mesh position={position}>
        <sphereGeometry args={[0.018, 14, 14]} />
        <meshStandardMaterial color="#cfd3d8" metalness={0.8} roughness={0.3} />
      </mesh>
    )
  }
  const args: [number, number, number] = vertical ? [0.018, length, 0.018] : [length, 0.018, 0.018]
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#cfd3d8" metalness={0.8} roughness={0.3} />
    </mesh>
  )
}

function Door({
  hingeX,
  dirSign,
  width,
  height,
  yCenter,
  z,
  color,
  open,
  handle = 'bar',
  handlePos = 'side',
}: {
  hingeX: number
  dirSign: 1 | -1
  width: number
  height: number
  yCenter: number
  z: number
  color: string
  open: boolean
  handle?: 'bar' | 'knob'
  handlePos?: 'top' | 'side'
}) {
  const angle = open ? dirSign * -1.7 : 0
  const z2 = TD / 2 + 0.012
  return (
    <group position={[hingeX, yCenter, z]} rotation={[0, angle, 0]}>
      <mesh position={[(dirSign * width) / 2, 0, 0]} castShadow>
        <boxGeometry args={[width, height, TD]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </mesh>
      {handlePos === 'top' ? (
        <Handle position={[dirSign * width * 0.5, height / 2 - 0.05, z2]} kind={handle} vertical={false} length={Math.min(0.12, width * 0.4)} />
      ) : (
        <Handle position={[dirSign * (width - 0.03), 0, z2]} kind={handle} vertical length={Math.min(0.12, height * 0.25)} />
      )}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * (height / 2 - 0.08), -TD / 2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.05, 12]} />
          <meshStandardMaterial color="#b8bcc2" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function DrawerFront({
  cx,
  width,
  height,
  yCenter,
  z,
  color,
  handle = 'bar',
}: {
  cx: number
  width: number
  height: number
  yCenter: number
  z: number
  color: string
  handle?: 'bar' | 'knob'
}) {
  return (
    <group position={[cx, yCenter, z]}>
      <mesh castShadow>
        <boxGeometry args={[width, height, TD]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
      </mesh>
      <Handle position={[0, height / 2 - 0.045, TD / 2 + 0.012]} kind={handle} vertical={false} length={Math.min(0.28, width * 0.55)} />
    </group>
  )
}

function Accessory({
  typeKey,
  cx,
  segW,
  D,
  t,
  yBottom,
  interiorH,
  level,
}: {
  typeKey: string
  cx: number
  segW: number
  D: number
  t: number
  yBottom: number
  interiorH: number
  level: number
}) {
  const at = accessoryType(typeKey)
  const color = at?.color ?? '#b0b4ba'
  const innerW = Math.max(0.05, segW - 0.02)
  const innerD = D - 2 * t - 0.02

  if (typeKey === 'trash') {
    const r = Math.min(innerW, innerD) / 2.6
    return (
      <mesh position={[cx, yBottom + 0.2, 0]} castShadow>
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
    default:
      size = [innerW, 0.1, innerD]
  }
  const y = yBottom + level * Math.max(0.01, interiorH - size[1]) + size[1] / 2
  return (
    <mesh position={[cx, y, 0]} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
    </mesh>
  )
}

/** Detailed renderer: vertical sections with dividers, drawers, shelves, doors. */
function SectionsCabinet({ spec, open }: { spec: CabinetSpec; open: boolean }) {
  const { width: W, height: H, depth: D, panelThickness: t, color } = spec
  const sections = spec.sections!
  const back = shade(color, -0.12)
  const toe = spec.toeKick ?? 0

  const interiorLeft = -W / 2 + t
  const interiorW = W - 2 * t
  const bottomY = t
  const interiorH = H - 2 * t
  const totalWeight = sections.reduce((s, x) => s + Math.max(0.05, x.width), 0) || 1
  const doorZ = D / 2 + TD / 2

  // precompute section x-extents
  let cursor = interiorLeft
  const laid = sections.map((sec) => {
    const w = interiorW * (Math.max(0.05, sec.width) / totalWeight)
    const x0 = cursor
    const x1 = cursor + w
    cursor = x1
    return { sec, x0, x1, w, cx: (x0 + x1) / 2 }
  })

  return (
    <group>
      {toe > 0 && (
        <Panel size={[W - 0.02, toe, D - 0.06]} position={[0, toe / 2, -0.03]} color={shade(color, -0.2)} />
      )}
      <group position={[0, toe, 0]}>
        {/* carcass */}
        <Panel size={[t, H, D]} position={[-W / 2 + t / 2, H / 2, 0]} color={color} />
        <Panel size={[t, H, D]} position={[W / 2 - t / 2, H / 2, 0]} color={color} />
        <Panel size={[W - 2 * t, t, D]} position={[0, t / 2, 0]} color={color} />
        <Panel size={[W - 2 * t, t, D]} position={[0, H - t / 2, 0]} color={color} />
        <Panel size={[W - 2 * t, H - 2 * t, t]} position={[0, H / 2, -D / 2 + t / 2]} color={back} />

        {laid.map(({ sec, x0, x1, w, cx }, i) => (
          <group key={sec.id}>
            {/* divider before this section (not the first) */}
            {i > 0 && <Panel size={[t, interiorH, D - t]} position={[x0, H / 2, t / 2]} color={shade(color, -0.04)} />}

            {sec.front === 'drawers'
              ? Array.from({ length: Math.max(1, sec.drawers) }).map((_, k) => {
                  const count = Math.max(1, sec.drawers)
                  const dh = interiorH / count
                  const yC = bottomY + (k + 0.5) * dh
                  return (
                    <DrawerFront
                      key={k}
                      cx={cx}
                      width={w - 2 * GAP}
                      height={dh - GAP}
                      yCenter={yC}
                      z={doorZ}
                      color={color}
                      handle={sec.handle ?? 'bar'}
                    />
                  )
                })
              : (
                <>
                  {/* shelves */}
                  {Array.from({ length: Math.max(0, sec.shelves) }).map((_, k) => {
                    const y = bottomY + (interiorH * (k + 1)) / (sec.shelves + 1)
                    return <Panel key={k} size={[w - 0.004, t, D - t]} position={[cx, y, t / 2]} color={shade(color, -0.04)} />
                  })}
                  {/* accessories */}
                  {sec.accessories.map((a) => (
                    <Accessory
                      key={a.id}
                      typeKey={a.type}
                      cx={cx}
                      segW={w}
                      D={D}
                      t={t}
                      yBottom={bottomY}
                      interiorH={interiorH}
                      level={a.level}
                    />
                  ))}
                  {/* doors */}
                  {sec.front === 'door-double' && (
                    <>
                      <Door hingeX={x0 + GAP} dirSign={1} width={w / 2 - GAP * 1.5} height={H - 2 * GAP} yCenter={H / 2} z={doorZ} color={color} open={open} handle={sec.handle ?? 'bar'} handlePos={sec.handlePos ?? 'side'} />
                      <Door hingeX={x1 - GAP} dirSign={-1} width={w / 2 - GAP * 1.5} height={H - 2 * GAP} yCenter={H / 2} z={doorZ} color={color} open={open} handle={sec.handle ?? 'bar'} handlePos={sec.handlePos ?? 'side'} />
                    </>
                  )}
                  {sec.front === 'door-left' && (
                    <Door hingeX={x0 + GAP} dirSign={1} width={w - 2 * GAP} height={H - 2 * GAP} yCenter={H / 2} z={doorZ} color={color} open={open} handle={sec.handle ?? 'bar'} handlePos={sec.handlePos ?? 'side'} />
                  )}
                  {sec.front === 'door-right' && (
                    <Door hingeX={x1 - GAP} dirSign={-1} width={w - 2 * GAP} height={H - 2 * GAP} yCenter={H / 2} z={doorZ} color={color} open={open} handle={sec.handle ?? 'bar'} handlePos={sec.handlePos ?? 'side'} />
                  )}
                </>
              )}
          </group>
        ))}
      </group>
    </group>
  )
}

function Worktop({ spec }: { spec: CabinetSpec }) {
  if (spec.kind === 'wall' || spec.worktop === false) return null
  const toe = spec.toeKick ?? 0
  const topY = toe + spec.height
  const thk = spec.worktopThickness ?? 0.04
  const overhang = 0.03 // front overhang only, so a run of cabinets reads continuous
  return (
    <mesh position={[0, topY + thk / 2, overhang / 2]} castShadow receiveShadow>
      <boxGeometry args={[spec.width, thk, spec.depth + overhang]} />
      <meshStandardMaterial color={spec.worktopColor ?? '#d9d6cf'} roughness={0.4} metalness={0.05} />
    </mesh>
  )
}

export default function CabinetModel({ spec, open = false }: { spec: CabinetSpec; open?: boolean }) {
  return (
    <group>
      {spec.sections && spec.sections.length > 0 ? (
        <SectionsCabinet spec={spec} open={open} />
      ) : (
        <LegacyCabinet spec={spec} open={open} />
      )}
      <Worktop spec={spec} />
    </group>
  )
}

function LegacyCabinet({ spec, open }: { spec: CabinetSpec; open: boolean }) {
  const { width: W, height: H, depth: D, panelThickness: t, color } = spec
  const back = shade(color, -0.12)
  const shelfYs: number[] = []
  for (let i = 1; i <= spec.shelves; i++) shelfYs.push((H * i) / (spec.shelves + 1))
  const doorZ = D / 2 + TD / 2
  const dh = H - 2 * GAP

  return (
    <group>
      <Panel size={[t, H, D]} position={[-W / 2 + t / 2, H / 2, 0]} color={color} />
      <Panel size={[t, H, D]} position={[W / 2 - t / 2, H / 2, 0]} color={color} />
      <Panel size={[W - 2 * t, t, D]} position={[0, t / 2, 0]} color={color} />
      <Panel size={[W - 2 * t, t, D]} position={[0, H - t / 2, 0]} color={color} />
      <Panel size={[W - 2 * t, H - 2 * t, t]} position={[0, H / 2, -D / 2 + t / 2]} color={back} />
      {shelfYs.map((y, i) => (
        <Panel key={i} size={[W - 2 * t, t, D - t]} position={[0, y, t / 2]} color={shade(color, -0.04)} />
      ))}
      {spec.accessories.map((a) => (
        <Accessory key={a.id} typeKey={a.type} cx={0} segW={W} D={D} t={t} yBottom={t} interiorH={H - 2 * t} level={a.level} />
      ))}
      {spec.doors === 'double' && (
        <>
          <Door hingeX={-W / 2 + GAP} dirSign={1} width={W / 2 - GAP * 1.5} height={dh} yCenter={H / 2} z={doorZ} color={color} open={open} />
          <Door hingeX={W / 2 - GAP} dirSign={-1} width={W / 2 - GAP * 1.5} height={dh} yCenter={H / 2} z={doorZ} color={color} open={open} />
        </>
      )}
      {spec.doors === 'single-left' && (
        <Door hingeX={-W / 2 + GAP} dirSign={1} width={W - 2 * GAP} height={dh} yCenter={H / 2} z={doorZ} color={color} open={open} />
      )}
      {spec.doors === 'single-right' && (
        <Door hingeX={W / 2 - GAP} dirSign={-1} width={W - 2 * GAP} height={dh} yCenter={H / 2} z={doorZ} color={color} open={open} />
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
