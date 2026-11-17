export interface SurfaceMeshData {
  positions: Float32Array
  normals: Float32Array
  folds: Float32Array
  regions: Float32Array
  indices: Uint16Array | Uint32Array
}

export interface TractData {
  positions: Float32Array
  attrs: Float32Array
}

export interface NodeCloudData {
  positions: Float32Array
  attrs: Float32Array
}

export interface DustCloudData {
  positions: Float32Array
  attrs: Float32Array
}

export interface BrainSceneGeometry {
  surface: SurfaceMeshData
  core: SurfaceMeshData
  wireframe: TractData
  tracts: TractData
  rings: TractData
  nodes: NodeCloudData
  dust: DustCloudData
}

interface Vec3 {
  x: number
  y: number
  z: number
}

interface MutableMesh {
  positions: number[]
  folds: number[]
  regions: number[]
  indices: number[]
}

const CUBE_FACES: Array<{ n: Vec3; u: Vec3; v: Vec3 }> = [
  { n: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 0, z: -1 }, v: { x: 0, y: 1, z: 0 } },
  { n: { x: -1, y: 0, z: 0 }, u: { x: 0, y: 0, z: 1 }, v: { x: 0, y: 1, z: 0 } },
  { n: { x: 0, y: 1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: -1 } },
  { n: { x: 0, y: -1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } },
  { n: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
  { n: { x: 0, y: 0, z: -1 }, u: { x: -1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
]

function createSeededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function gaussianBell(x: number, center: number, width: number): number {
  const d = (x - center) / width
  return Math.exp(-d * d)
}

function ridgeWave(v: number): number {
  return 1 - Math.pow(Math.abs(Math.sin(v)), 0.56)
}

function computeGyrusField(x: number, y: number, z: number, seedOffset: number): number {
  const sx = x * 6.3 + seedOffset
  const sy = y * 6.5 - seedOffset * 0.72
  const sz = z * 5.9 + seedOffset * 0.48

  const wx = sx + 0.64 * Math.sin(sy * 0.92 + sz * 0.78)
  const wy = sy + 0.64 * Math.sin(sz * 0.88 - sx * 0.82)
  const wz = sz + 0.64 * Math.sin(sx * 0.86 + sy * 0.84)

  const r1 = ridgeWave(wx * 1.54 + Math.cos(wz * 1.12) * 0.96)
  const r2 = ridgeWave(wy * 1.68 - wz * 1.14 + Math.sin(wx * 1.24) * 0.9)
  const r3 = ridgeWave((wx + wz) * 1.22 + Math.sin(wy * 1.62) * 0.86)
  const micro = ridgeWave((wx - wy + wz) * 2.28)

  return r1 * 0.4 + r2 * 0.34 + r3 * 0.16 + micro * 0.1
}

function buildCubeSphere(
  resolution: number,
  mapPoint: (ux: number, uy: number, uz: number) => { pos: Vec3; fold: number; region: number },
  flipWinding: boolean,
  target: MutableMesh,
  wirePositions?: number[],
  wireAttrs?: number[]
): Vec3[] {
  const baseVertexOffset = target.positions.length / 3
  const keyToIndex = new Map<string, number>()
  const vertexPositions: Vec3[] = []
  const vertexFolds: number[] = []
  const wireEdgeKeys = new Set<string>()

  const getOrCreateVertex = (nx: number, ny: number, nz: number): number => {
    const qx = Math.round(nx * 10000)
    const qy = Math.round(ny * 10000)
    const qz = Math.round(nz * 10000)
    const key = `${qx},${qy},${qz}`
    const existing = keyToIndex.get(key)
    if (existing !== undefined) {
      return existing
    }
    const mapped = mapPoint(nx, ny, nz)
    const localIdx = vertexPositions.length
    vertexPositions.push(mapped.pos)
    vertexFolds.push(mapped.fold)
    target.positions.push(mapped.pos.x, mapped.pos.y, mapped.pos.z)
    target.folds.push(mapped.fold)
    target.regions.push(mapped.region)
    keyToIndex.set(key, localIdx)
    return localIdx
  }

  const pushWireEdge = (aLocal: number, bLocal: number) => {
    if (!wirePositions || !wireAttrs) return
    const key = aLocal < bLocal ? `${aLocal}-${bLocal}` : `${bLocal}-${aLocal}`
    if (wireEdgeKeys.has(key)) return
    wireEdgeKeys.add(key)
    const pa = vertexPositions[aLocal]
    const pb = vertexPositions[bLocal]
    const fa = vertexFolds[aLocal]
    const fb = vertexFolds[bLocal]
    wirePositions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z)
    wireAttrs.push(fa, 0.25, 0.08, 0.3, fb, 0.25, 0.08, 0.3)
  }

  for (const face of CUBE_FACES) {
    const gridIndices: number[][] = []
    for (let iy = 0; iy <= resolution; iy++) {
      const row: number[] = []
      const tv = (iy / resolution) * 2 - 1
      for (let ix = 0; ix <= resolution; ix++) {
        const tu = (ix / resolution) * 2 - 1
        const px = face.n.x + tu * face.u.x + tv * face.v.x
        const py = face.n.y + tu * face.u.y + tv * face.v.y
        const pz = face.n.z + tu * face.u.z + tv * face.v.z
        const len = Math.hypot(px, py, pz) || 1
        row.push(getOrCreateVertex(px / len, py / len, pz / len))
      }
      gridIndices.push(row)
    }

    for (let iy = 0; iy < resolution; iy++) {
      for (let ix = 0; ix < resolution; ix++) {
        const l00 = gridIndices[iy][ix]
        const l10 = gridIndices[iy][ix + 1]
        const l11 = gridIndices[iy + 1][ix + 1]
        const l01 = gridIndices[iy + 1][ix]

        const i00 = baseVertexOffset + l00
        const i10 = baseVertexOffset + l10
        const i11 = baseVertexOffset + l11
        const i01 = baseVertexOffset + l01

        if (flipWinding) {
          target.indices.push(i00, i11, i10)
          target.indices.push(i00, i01, i11)
        } else {
          target.indices.push(i00, i10, i11)
          target.indices.push(i00, i11, i01)
        }

        if (iy % 2 === 0) pushWireEdge(l00, l10)
        if (ix % 2 === 0) pushWireEdge(l00, l01)
      }
    }
  }

  return vertexPositions
}

function finalizeSurfaceMesh(mesh: MutableMesh): SurfaceMeshData {
  const vertexCount = mesh.positions.length / 3
  const normals = new Float32Array(mesh.positions.length)
  const pos = mesh.positions
  const idx = mesh.indices

  for (let i = 0; i < idx.length; i += 3) {
    const ia = idx[i] * 3
    const ib = idx[i + 1] * 3
    const ic = idx[i + 2] * 3

    const ax = pos[ia]
    const ay = pos[ia + 1]
    const az = pos[ia + 2]
    const e1x = pos[ib] - ax
    const e1y = pos[ib + 1] - ay
    const e1z = pos[ib + 2] - az
    const e2x = pos[ic] - ax
    const e2y = pos[ic + 1] - ay
    const e2z = pos[ic + 2] - az

    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x

    normals[ia] += nx
    normals[ia + 1] += ny
    normals[ia + 2] += nz
    normals[ib] += nx
    normals[ib + 1] += ny
    normals[ib + 2] += nz
    normals[ic] += nx
    normals[ic + 1] += ny
    normals[ic + 2] += nz
  }

  for (let v = 0; v < vertexCount; v++) {
    const o = v * 3
    const len = Math.hypot(normals[o], normals[o + 1], normals[o + 2]) || 1
    normals[o] /= len
    normals[o + 1] /= len
    normals[o + 2] /= len
  }

  return {
    positions: new Float32Array(mesh.positions),
    normals,
    folds: new Float32Array(mesh.folds),
    regions: new Float32Array(mesh.regions),
    indices: vertexCount > 65535 ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices),
  }
}

function sculptCerebralPoint(ux: number, uy: number, uz: number, side: -1 | 1): { pos: Vec3; fold: number; region: number } {
  const domeX = 0.5 * (ux + Math.sqrt(ux * ux + 0.032))
  const asymZ = side === -1 ? -0.024 : 0.016
  let z = uz * 1.09 + asymZ

  const frontalTaper = 1 - 0.18 * Math.pow(Math.max(0, uz), 1.8)
  const occipitalTaper = 1 - 0.11 * Math.pow(Math.max(0, -uz), 1.8)
  const latScale = 0.72 * frontalTaper * occipitalTaper
  const poleFissureOpen = 0.036 * Math.pow(Math.abs(uz), 2.8)
  let rawX = 0.024 + poleFissureOpen + domeX * latScale

  const dorsalArch = 0.78 - 0.12 * Math.pow(Math.max(0, uz - 0.08), 1.8) - 0.1 * Math.pow(Math.max(0, -uz - 0.22), 1.8)
  let y = uy >= 0 ? uy * dorsalArch : uy * 0.42
  y += 0.065 * (1 - uz * uz * 0.7)

  const temporalMask =
    gaussianBell(uz, 0.04, 0.44) * smoothstep(0.14, 0.68, domeX) * smoothstep(0.14, -0.75, uy)
  rawX += 0.125 * temporalMask
  y -= 0.25 * temporalMask

  if (uz > 0.28 && uy < 0) {
    const orbitalFlat = smoothstep(0.28, 0.94, uz) * smoothstep(0.0, -0.9, uy)
    y += 0.18 * orbitalFlat
  }

  if (uz < -0.18 && uy < 0) {
    const tentorialArch = smoothstep(-0.18, -0.94, uz) * smoothstep(0.05, -0.92, uy)
    y += 0.25 * tentorialArch
  }

  let sylvianWeight = 0
  if (uz > -0.36 && uz < 0.54 && domeX > 0.26) {
    const fissureCenterY = -0.06 + (0.28 - uz) * 0.42
    const distToSylvian = Math.abs(y - fissureCenterY)
    sylvianWeight =
      Math.exp(-(distToSylvian * distToSylvian) / 0.0095) *
      smoothstep(0.26, 0.66, domeX) *
      smoothstep(-0.36, -0.16, uz) *
      smoothstep(0.54, 0.34, uz)
    rawX -= 0.11 * sylvianWeight
    y -= 0.028 * sylvianWeight
  }

  let centralSulcusWeight = 0
  if (y > 0.08 && domeX > 0.14) {
    const centralZ = 0.04 + (0.5 - y) * 0.28
    const dz = z - centralZ
    centralSulcusWeight = Math.exp(-(dz * dz) / 0.0055) * smoothstep(0.08, 0.34, y) * smoothstep(0.14, 0.45, domeX)
  }

  const rawFold = computeGyrusField(rawX, y, z, side * 1.45)
  const lateralMask = 0.28 + 0.72 * smoothstep(0.05, 0.32, domeX)
  const sulcusSuppress = 1 - Math.max(sylvianWeight * 0.72, centralSulcusWeight * 0.52)
  const gyrusDisp = (rawFold - 0.54) * 0.072 * lateralMask * sulcusSuppress

  const rLen = Math.hypot(rawX - 0.12, y - 0.05, z) || 1
  rawX += ((rawX - 0.12) / rLen) * gyrusDisp
  y += ((y - 0.05) / rLen) * gyrusDisp
  z += (z / rLen) * gyrusDisp

  const fold = clamp(rawFold * (1 - sylvianWeight * 0.72 - centralSulcusWeight * 0.45), 0, 1)

  return {
    pos: { x: rawX * side, y, z },
    fold,
    region: 0,
  }
}

function sculptCerebellarPoint(ux: number, uy: number, uz: number, side: -1 | 1): { pos: Vec3; fold: number; region: number } {
  const xLocal = 0.5 * (ux + Math.sqrt(ux * ux + 0.04))
  const widthScale = 1 - 0.18 * Math.pow(Math.abs(uz), 1.6)
  let x = (0.015 + xLocal * 0.46 * widthScale) * side
  let y = -0.35 + uy * 0.22 + (uz + 0.6) * 0.12
  let z = -0.62 + uz * 0.28

  if (uy > 0) {
    y -= uy * 0.045 * smoothstep(-0.4, -0.8, z)
  }

  const folia = 0.5 + 0.5 * Math.sin(y * 64 + Math.cos(z * 11) * 0.55 + x * 4.5 * side)
  const foliaDisp = (folia - 0.5) * 0.024
  x += ux * foliaDisp * 0.6 * side
  y += uy * foliaDisp
  z += uz * foliaDisp

  return {
    pos: { x, y, z },
    fold: clamp(0.24 + folia * 0.76, 0, 1),
    region: 1,
  }
}

function appendBrainstem(target: MutableMesh): Vec3[] {
  const rings = 24
  const radialSegs = 16
  const baseOffset = target.positions.length / 3
  const spineCenters: Vec3[] = []

  for (let i = 0; i <= rings; i++) {
    const t = i / rings
    const cy = -0.05 - t * 0.96
    const ponsBulge = gaussianBell(t, 0.34, 0.16)
    const cz = -0.05 - Math.pow(t, 1.35) * 0.26 + ponsBulge * 0.078
    const rx = 0.115 * (1 - t * 0.46) + ponsBulge * 0.046
    const rz = 0.105 * (1 - t * 0.44) + ponsBulge * 0.054
    spineCenters.push({ x: 0, y: cy, z: cz })

    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2
      const cosA = Math.cos(a)
      const sinA = Math.sin(a)
      const medianGroove = sinA > 0.75 ? -0.012 * Math.pow((sinA - 0.75) / 0.25, 2) : 0
      const striation = 0.5 + 0.5 * Math.sin(a * 8 + t * 14)

      let px = cosA * rx * (1 + medianGroove)
      let pz = cz + sinA * rz * (1 + medianGroove)
      let py = cy
      if (i === 0) {
        px *= 0.2
        pz = cz + sinA * 0.02
        py += 0.03
      } else if (i === rings) {
        px *= 0.22
        pz = cz + sinA * 0.02
        py -= 0.02
      }

      target.positions.push(px, py, pz)
      target.folds.push(clamp(0.45 + ponsBulge * 0.35 + striation * 0.2, 0, 1))
      target.regions.push(2)
    }
  }

  for (let i = 0; i < rings; i++) {
    const rowA = baseOffset + i * radialSegs
    const rowB = baseOffset + (i + 1) * radialSegs
    for (let j = 0; j < radialSegs; j++) {
      const jNext = (j + 1) % radialSegs
      target.indices.push(rowA + j, rowB + j, rowB + jNext)
      target.indices.push(rowA + j, rowB + jNext, rowA + jNext)
    }
  }

  return spineCenters
}

function appendInnerCallosum(target: MutableMesh): Vec3[] {
  const archSteps = 28
  const radialSegs = 14
  const baseOffset = target.positions.length / 3
  const anchors: Vec3[] = []

  for (let i = 0; i <= archSteps; i++) {
    const t = i / archSteps
    const angle = -0.35 + t * (Math.PI + 0.7)
    const cz = Math.cos(angle) * 0.42
    const cy = 0.01 + Math.sin(angle) * 0.25
    const rx = 0.17 - Math.abs(t - 0.5) * 0.07
    const ry = 0.044 + gaussianBell(t, 0.12, 0.16) * 0.018 + gaussianBell(t, 0.88, 0.16) * 0.018
    anchors.push({ x: 0, y: cy, z: cz })

    const tx = -Math.sin(angle)
    const ty = Math.cos(angle)

    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2
      const sinA = Math.sin(a)
      const cosA = Math.cos(a)
      let px = cosA * rx
      let py = cy + sinA * ry * Math.abs(tx) + sinA * ry * 0.35
      let pz = cz - sinA * ry * ty * 0.8
      if (i === 0 || i === archSteps) {
        px *= 0.25
        py = cy + sinA * 0.01
        pz = cz
      }
      target.positions.push(px, py, pz)
      target.folds.push(0.75 + 0.25 * Math.cos(t * Math.PI * 6))
      target.regions.push(3)
    }
  }

  for (let i = 0; i < archSteps; i++) {
    const rowA = baseOffset + i * radialSegs
    const rowB = baseOffset + (i + 1) * radialSegs
    for (let j = 0; j < radialSegs; j++) {
      const jNext = (j + 1) % radialSegs
      target.indices.push(rowA + j, rowB + jNext, rowB + j)
      target.indices.push(rowA + j, rowA + jNext, rowB + jNext)
    }
  }

  return anchors
}

function pushBezierTract(
  p0: Vec3,
  p1: Vec3,
  p2: Vec3,
  p3: Vec3,
  segments: number,
  phase: number,
  speed: number,
  colorMix: number,
  positions: number[],
  attrs: number[]
) {
  let prevX = p0.x
  let prevY = p0.y
  let prevZ = p0.z
  for (let s = 1; s <= segments; s++) {
    const t0 = (s - 1) / segments
    const t = s / segments
    const inv = 1 - t
    const inv2 = inv * inv
    const t2 = t * t

    const x = inv2 * inv * p0.x + 3 * inv2 * t * p1.x + 3 * inv * t2 * p2.x + t2 * t * p3.x
    const y = inv2 * inv * p0.y + 3 * inv2 * t * p1.y + 3 * inv * t2 * p2.y + t2 * t * p3.y
    const z = inv2 * inv * p0.z + 3 * inv2 * t * p1.z + 3 * inv * t2 * p2.z + t2 * t * p3.z

    positions.push(prevX, prevY, prevZ, x, y, z)
    attrs.push(t0, phase, speed, colorMix, t, phase, speed, colorMix)

    prevX = x
    prevY = y
    prevZ = z
  }
}

function appendOrbitalRing(
  radius: number,
  tiltX: number,
  tiltZ: number,
  yOffset: number,
  segments: number,
  phase: number,
  speed: number,
  colorMix: number,
  positions: number[],
  attrs: number[],
  beaconNodes: Vec3[]
) {
  const cosX = Math.cos(tiltX)
  const sinX = Math.sin(tiltX)
  const cosZ = Math.cos(tiltZ)
  const sinZ = Math.sin(tiltZ)

  const transformPoint = (ang: number, rad: number): Vec3 => {
    const px = Math.cos(ang) * rad
    const pz = Math.sin(ang) * rad
    const py = 0
    const y1 = py * cosX - pz * sinX
    const z1 = py * sinX + pz * cosX
    const x2 = px * cosZ - y1 * sinZ
    const y2 = px * sinZ + y1 * cosZ + yOffset
    return { x: x2, y: y2, z: z1 }
  }

  for (let i = 0; i < segments; i++) {
    if (i % 5 === 4) continue
    const t0 = i / segments
    const t1 = (i + 1) / segments
    const p0 = transformPoint(t0 * Math.PI * 2, radius)
    const p1 = transformPoint(t1 * Math.PI * 2, radius)
    positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
    attrs.push(t0, phase, speed, colorMix, t1, phase, speed, colorMix)

    if (i % 16 === 0) {
      const tickOuter = transformPoint(t0 * Math.PI * 2, radius + 0.045)
      positions.push(p0.x, p0.y, p0.z, tickOuter.x, tickOuter.y, tickOuter.z)
      attrs.push(t0, phase, speed, colorMix, t0, phase, speed, colorMix)
      beaconNodes.push(tickOuter)
    }
  }
}

export function buildBrainSceneGeometry(): BrainSceneGeometry {
  const rand = createSeededRandom(20261114)
  const surfaceMutable: MutableMesh = { positions: [], folds: [], regions: [], indices: [] }
  const coreMutable: MutableMesh = { positions: [], folds: [], regions: [], indices: [] }
  const wirePositions: number[] = []
  const wireAttrs: number[] = []

  const rightVertices = buildCubeSphere(
    20,
    (ux, uy, uz) => sculptCerebralPoint(ux, uy, uz, 1),
    false,
    surfaceMutable,
    wirePositions,
    wireAttrs
  )
  const leftVertices = buildCubeSphere(
    20,
    (ux, uy, uz) => sculptCerebralPoint(ux, uy, uz, -1),
    true,
    surfaceMutable,
    wirePositions,
    wireAttrs
  )
  const cerebRight = buildCubeSphere(
    11,
    (ux, uy, uz) => sculptCerebellarPoint(ux, uy, uz, 1),
    false,
    surfaceMutable
  )
  const cerebLeft = buildCubeSphere(
    11,
    (ux, uy, uz) => sculptCerebellarPoint(ux, uy, uz, -1),
    true,
    surfaceMutable
  )
  const stemCenters = appendBrainstem(surfaceMutable)
  const callosumAnchors = appendInnerCallosum(coreMutable)

  const sampleSubcortical = (pool: Vec3[], count: number, minXAbs = 0.08): Vec3[] => {
    const picked: Vec3[] = []
    let guard = 0
    while (picked.length < count && guard < count * 12) {
      guard += 1
      const candidate = pool[Math.floor(rand() * pool.length)]
      if (Math.abs(candidate.x) < minXAbs) continue
      const depthShrink = 0.72 + rand() * 0.24
      picked.push({
        x: candidate.x * depthShrink,
        y: candidate.y * depthShrink,
        z: candidate.z * depthShrink,
      })
    }
    return picked
  }

  const rightAnchors = sampleSubcortical(rightVertices, 165)
  const leftAnchors = sampleSubcortical(leftVertices, 165)
  const allCortexAnchors = [...rightAnchors, ...leftAnchors]
  const cerebAnchors = [...sampleSubcortical(cerebRight, 28, 0.04), ...sampleSubcortical(cerebLeft, 28, 0.04)]

  const tractPositions: number[] = []
  const tractAttrs: number[] = []

  const addHemisphereFibers = (anchors: Vec3[]) => {
    for (let i = 0; i < 125; i++) {
      const a = anchors[Math.floor(rand() * anchors.length)]
      let b = anchors[Math.floor(rand() * anchors.length)]
      let bestDist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
      for (let probe = 0; probe < 5; probe++) {
        const cand = anchors[Math.floor(rand() * anchors.length)]
        const d = Math.hypot(a.x - cand.x, a.y - cand.y, a.z - cand.z)
        if (d > 0.34 && d < 1.38 && (bestDist < 0.34 || d < bestDist)) {
          b = cand
          bestDist = d
        }
      }
      if (bestDist < 0.18) continue
      const inward = 0.56 + rand() * 0.18
      const c1 = { x: a.x * inward, y: a.y * inward + 0.04, z: a.z * inward }
      const c2 = { x: b.x * inward, y: b.y * inward + 0.04, z: b.z * inward }
      pushBezierTract(
        a,
        c1,
        c2,
        b,
        14,
        rand() * 10,
        0.1 + rand() * 0.1,
        rand(),
        tractPositions,
        tractAttrs
      )
    }
  }

  addHemisphereFibers(rightAnchors)
  addHemisphereFibers(leftAnchors)

  for (let i = 0; i < 72; i++) {
    const a = rightAnchors[Math.floor(rand() * rightAnchors.length)]
    const b = leftAnchors[Math.floor(rand() * leftAnchors.length)]
    const bridge = callosumAnchors[Math.floor(rand() * callosumAnchors.length)]
    const c1 = { x: a.x * 0.35, y: bridge.y + 0.05, z: (a.z + bridge.z) * 0.5 }
    const c2 = { x: b.x * 0.35, y: bridge.y + 0.05, z: (b.z + bridge.z) * 0.5 }
    pushBezierTract(
      a,
      c1,
      c2,
      b,
      16,
      rand() * 10,
      0.11 + rand() * 0.09,
      0.15 + rand() * 0.35,
      tractPositions,
      tractAttrs
    )
  }

  for (let i = 0; i < 40; i++) {
    const isLeft = i % 2 === 0
    const pool = isLeft ? leftAnchors : rightAnchors
    const topNode = pool[Math.floor(rand() * pool.length)]
    if (topNode.y < -0.05) continue
    const stemEnd = stemCenters[Math.floor(stemCenters.length * (0.55 + rand() * 0.42))]
    const c1 = { x: topNode.x * 0.4, y: (topNode.y + 0.1) * 0.45, z: topNode.z * 0.45 }
    const c2 = { x: topNode.x * 0.12, y: stemEnd.y * 0.45, z: stemEnd.z * 0.65 }
    pushBezierTract(
      topNode,
      c1,
      c2,
      stemEnd,
      14,
      rand() * 10,
      0.09 + rand() * 0.08,
      0.65 + rand() * 0.35,
      tractPositions,
      tractAttrs
    )
  }

  for (let i = 0; i < cerebAnchors.length; i++) {
    const cb = cerebAnchors[i]
    const pons = stemCenters[Math.floor(stemCenters.length * (0.28 + rand() * 0.22))]
    const c1 = { x: cb.x * 0.55, y: cb.y + 0.12, z: (cb.z + pons.z) * 0.5 }
    const c2 = { x: cb.x * 0.25, y: pons.y + 0.06, z: pons.z - 0.08 }
    pushBezierTract(cb, c1, c2, pons, 10, rand() * 10, 0.12 + rand() * 0.09, 0.45 + rand() * 0.35, tractPositions, tractAttrs)
  }

  const ringPositions: number[] = []
  const ringAttrs: number[] = []
  const ringBeacons: Vec3[] = []
  appendOrbitalRing(1.34, 0.32, -0.18, -0.05, 112, 0.1, 0.06, 0.15, ringPositions, ringAttrs, ringBeacons)
  appendOrbitalRing(1.52, -0.26, 0.34, 0.02, 128, 0.48, 0.045, 0.55, ringPositions, ringAttrs, ringBeacons)
  appendOrbitalRing(1.74, 0.46, 0.22, -0.08, 128, 0.72, 0.038, 0.82, ringPositions, ringAttrs, ringBeacons)

  const nodePositions: number[] = []
  const nodeAttrs: number[] = []

  const addCloudNode = (p: Vec3, size: number, tint: number) => {
    nodePositions.push(p.x, p.y, p.z)
    nodeAttrs.push(size, rand() * Math.PI * 2, tint)
  }

  for (const p of allCortexAnchors) {
    addCloudNode(p, 0.9 + rand() * 1.15, rand())
  }
  for (const p of cerebAnchors) {
    addCloudNode(p, 0.8 + rand() * 0.8, 0.35 + rand() * 0.3)
  }
  for (let i = 0; i < callosumAnchors.length; i++) {
    addCloudNode(callosumAnchors[i], 1.2 + rand() * 0.8, 0.1 + rand() * 0.2)
  }
  for (let i = 2; i < stemCenters.length; i += 2) {
    addCloudNode(stemCenters[i], 0.95 + rand() * 0.7, 0.8 + rand() * 0.2)
  }
  for (const p of ringBeacons) {
    addCloudNode(p, 1.0 + rand() * 0.5, 0.25)
  }

  const corticalPools = [rightVertices, leftVertices, cerebRight, cerebLeft]

  for (let pIdx = 0; pIdx < corticalPools.length; pIdx++) {
    const pool = corticalPools[pIdx]
    const step = 3
    for (let i = 0; i < pool.length; i += step) {
      const v = pool[i]
      const depth = 0.82 + rand() * 0.18
      const np = { x: v.x * depth, y: v.y * depth, z: v.z * depth }
      const tint = rand()
      addCloudNode(np, 0.52 + rand() * 0.72, tint)
    }
  }

  const dustPositions: number[] = []
  const dustAttrs: number[] = []
  for (let i = 0; i < 200; i++) {
    const spreadX = (rand() - 0.5) * 9.5
    const spreadY = (rand() - 0.5) * 5.2
    const spreadZ = (rand() - 0.5) * 4.5 - 0.6
    dustPositions.push(spreadX, spreadY, spreadZ)
    dustAttrs.push(0.55 + rand() * 1.65, rand() * Math.PI * 2, rand())
  }

  return {
    surface: finalizeSurfaceMesh(surfaceMutable),
    core: finalizeSurfaceMesh(coreMutable),
    wireframe: {
      positions: new Float32Array(wirePositions),
      attrs: new Float32Array(wireAttrs),
    },
    tracts: {
      positions: new Float32Array(tractPositions),
      attrs: new Float32Array(tractAttrs),
    },
    rings: {
      positions: new Float32Array(ringPositions),
      attrs: new Float32Array(ringAttrs),
    },
    nodes: {
      positions: new Float32Array(nodePositions),
      attrs: new Float32Array(nodeAttrs),
    },
    dust: {
      positions: new Float32Array(dustPositions),
      attrs: new Float32Array(dustAttrs),
    },
  }
}
