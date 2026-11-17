import { useEffect, useRef } from 'react'
import { buildBrainSceneGeometry, SurfaceMeshData } from './neural-brain/brainGeometry'
import {
  POINT_FS,
  POINT_VS,
  SURFACE_FS,
  SURFACE_VS,
  TRACT_FS,
  TRACT_VS,
} from './neural-brain/brainShaders'

interface NeuralBrainCanvasProps {
  pulseBurst?: number
  entering?: boolean
}

interface CompiledProgram {
  program: WebGLProgram
  uniforms: Record<string, WebGLUniformLocation | null>
}

interface BurstEvent {
  x: number
  y: number
  z: number
  startTime: number
}

const MAX_BURSTS = 6

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Unable to create WebGL shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Shader compile error'
    gl.deleteShader(shader)
    throw new Error(info)
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
  uniformNames: string[]
): CompiledProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    throw new Error('Unable to create WebGL program')
  }
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Program link error'
    gl.deleteProgram(program)
    throw new Error(info)
  }

  const uniforms: Record<string, WebGLUniformLocation | null> = {}
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(program, name)
  }
  return { program, uniforms }
}

function createSurfaceVao(
  gl: WebGL2RenderingContext,
  mesh: SurfaceMeshData,
  program: WebGLProgram,
  buffers: WebGLBuffer[]
): WebGLVertexArrayObject | null {
  const vao = gl.createVertexArray()
  if (!vao) return null
  gl.bindVertexArray(vao)

  const bindAttrib = (name: string, data: Float32Array, size: number) => {
    const loc = gl.getAttribLocation(program, name)
    if (loc === -1) return
    const buf = gl.createBuffer()
    if (!buf) return
    buffers.push(buf)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
  }

  bindAttrib('aPosition', mesh.positions, 3)
  bindAttrib('aNormal', mesh.normals, 3)
  bindAttrib('aFold', mesh.folds, 1)
  bindAttrib('aRegion', mesh.regions, 1)

  const ibo = gl.createBuffer()
  if (ibo) {
    buffers.push(ibo)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
  }

  gl.bindVertexArray(null)
  return vao
}

function createPointOrLineVao(
  gl: WebGL2RenderingContext,
  positions: Float32Array,
  attrs: Float32Array,
  attrName: string,
  attrSize: number,
  program: WebGLProgram,
  buffers: WebGLBuffer[]
): WebGLVertexArrayObject | null {
  const vao = gl.createVertexArray()
  if (!vao) return null
  gl.bindVertexArray(vao)

  const posLoc = gl.getAttribLocation(program, 'aPosition')
  if (posLoc !== -1) {
    const pBuf = gl.createBuffer()
    if (pBuf) {
      buffers.push(pBuf)
      gl.bindBuffer(gl.ARRAY_BUFFER, pBuf)
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0)
    }
  }

  const attrLoc = gl.getAttribLocation(program, attrName)
  if (attrLoc !== -1) {
    const aBuf = gl.createBuffer()
    if (aBuf) {
      buffers.push(aBuf)
      gl.bindBuffer(gl.ARRAY_BUFFER, aBuf)
      gl.bufferData(gl.ARRAY_BUFFER, attrs, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(attrLoc)
      gl.vertexAttribPointer(attrLoc, attrSize, gl.FLOAT, false, 0, 0)
    }
  }

  gl.bindVertexArray(null)
  return vao
}

function writeOffsetPerspective(
  out: Float32Array,
  fovRad: number,
  aspect: number,
  near: number,
  far: number,
  ndcOffsetX: number,
  ndcOffsetY: number
) {
  const f = 1 / Math.tan(fovRad * 0.5)
  const nf = 1 / (near - far)
  out.fill(0)
  out[0] = f / Math.max(0.1, aspect)
  out[5] = f
  out[8] = -ndcOffsetX
  out[9] = -ndcOffsetY
  out[10] = (far + near) * nf
  out[11] = -1
  out[14] = 2 * far * near * nf
}

function writeModelView(
  mvOut: Float32Array,
  normOut: Float32Array,
  yaw: number,
  pitch: number,
  ty: number,
  tz: number
) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cx = Math.cos(pitch)
  const sx = Math.sin(pitch)

  const r00 = cy
  const r01 = 0
  const r02 = sy

  const r10 = sx * sy
  const r11 = cx
  const r12 = -sx * cy

  const r20 = -cx * sy
  const r21 = sx
  const r22 = cx * cy

  mvOut[0] = r00
  mvOut[1] = r10
  mvOut[2] = r20
  mvOut[3] = 0

  mvOut[4] = r01
  mvOut[5] = r11
  mvOut[6] = r21
  mvOut[7] = 0

  mvOut[8] = r02
  mvOut[9] = r12
  mvOut[10] = r22
  mvOut[11] = 0

  mvOut[12] = 0
  mvOut[13] = ty
  mvOut[14] = tz
  mvOut[15] = 1

  normOut[0] = r00
  normOut[1] = r10
  normOut[2] = r20
  normOut[3] = r01
  normOut[4] = r11
  normOut[5] = r21
  normOut[6] = r02
  normOut[7] = r12
  normOut[8] = r22
}

export function NeuralBrainCanvas({ pulseBurst = 0, entering = false }: NeuralBrainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const burstTriggerRef = useRef(0)
  const enteringRef = useRef(entering)

  useEffect(() => {
    enteringRef.current = entering
  }, [entering])

  useEffect(() => {
    if (pulseBurst > 0) {
      burstTriggerRef.current += 1
    }
  }, [pulseBurst])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: 'low-power',
    })
    if (!gl) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = buildBrainSceneGeometry()
    const buffers: WebGLBuffer[] = []
    const vaos: WebGLVertexArrayObject[] = []
    const programs: WebGLProgram[] = []

    let surfaceProg: CompiledProgram
    let tractProg: CompiledProgram
    let pointProg: CompiledProgram

    try {
      surfaceProg = createProgram(gl, SURFACE_VS, SURFACE_FS, [
        'uModelView',
        'uProj',
        'uNormalMat',
        'uTime',
        'uPassOpacity',
        'uScatter',
        'uPointerLocal',
        'uPointerActive',
        'uBursts[0]',
      ])
      tractProg = createProgram(gl, TRACT_VS, TRACT_FS, [
        'uModelView',
        'uProj',
        'uTime',
        'uBaseAlpha',
        'uScatter',
        'uPointerLocal',
        'uPointerActive',
        'uBursts[0]',
      ])
      pointProg = createProgram(gl, POINT_VS, POINT_FS, [
        'uModelView',
        'uProj',
        'uTime',
        'uDpr',
        'uPointScale',
        'uScatter',
        'uPointerLocal',
        'uPointerActive',
        'uBursts[0]',
      ])
      programs.push(surfaceProg.program, tractProg.program, pointProg.program)
    } catch {
      return
    }

    const surfaceVao = createSurfaceVao(gl, scene.surface, surfaceProg.program, buffers)
    const coreVao = createSurfaceVao(gl, scene.core, surfaceProg.program, buffers)
    const tractsVao = createPointOrLineVao(
      gl,
      scene.tracts.positions,
      scene.tracts.attrs,
      'aTractAttr',
      4,
      tractProg.program,
      buffers
    )
    const wireVao = createPointOrLineVao(
      gl,
      scene.wireframe.positions,
      scene.wireframe.attrs,
      'aTractAttr',
      4,
      tractProg.program,
      buffers
    )
    const ringsVao = createPointOrLineVao(
      gl,
      scene.rings.positions,
      scene.rings.attrs,
      'aTractAttr',
      4,
      tractProg.program,
      buffers
    )
    const nodesVao = createPointOrLineVao(
      gl,
      scene.nodes.positions,
      scene.nodes.attrs,
      'aPointAttr',
      3,
      pointProg.program,
      buffers
    )
    const dustVao = createPointOrLineVao(
      gl,
      scene.dust.positions,
      scene.dust.attrs,
      'aPointAttr',
      3,
      pointProg.program,
      buffers
    )

    if (surfaceVao) vaos.push(surfaceVao)
    if (coreVao) vaos.push(coreVao)
    if (tractsVao) vaos.push(tractsVao)
    if (wireVao) vaos.push(wireVao)
    if (ringsVao) vaos.push(ringsVao)
    if (nodesVao) vaos.push(nodesVao)
    if (dustVao) vaos.push(dustVao)

    const projMat = new Float32Array(16)
    const mvMat = new Float32Array(16)
    const normMat = new Float32Array(9)
    const dustMvMat = new Float32Array(16)
    const dustNormMat = new Float32Array(9)
    const ringMvMat = new Float32Array(16)
    const ringNormMat = new Float32Array(9)

    const bursts: BurstEvent[] = Array.from({ length: MAX_BURSTS }, () => ({
      x: 0,
      y: 0,
      z: 0,
      startTime: -10,
    }))
    const burstFlat = new Float32Array(MAX_BURSTS * 4)
    let nextBurstSlot = 0

    let width = window.innerWidth
    let height = window.innerHeight
    let dpr = 1

    const pointer = { ndcX: 0, ndcY: 0, active: false }
    let targetHoverYaw = 0
    let targetHoverPitch = 0
    let smoothHoverYaw = 0
    let smoothHoverPitch = 0
    let lastExternalBurst = burstTriggerRef.current
    let simTime = 1.6
    let enterStartTime: number | null = null
    let enterBurstStage = 0
    let lastTimestamp = performance.now()
    let lastInteractionTime = 0
    let animId = 0

    function getViewportLayout() {
      const isDesktop = width >= 1024
      const isWide = width >= 1440
      return {
        ndcOffsetX: isDesktop ? 0.04 : 0,
        ndcOffsetY: isDesktop ? 0.01 : 0.16,
        camZ: isWide ? -3.15 : isDesktop ? -3.45 : -4.45,
        fov: 0.68,
      }
    }

    function computePointerLocal(
      ndcX: number,
      ndcY: number,
      yaw: number,
      pitch: number,
      layout: ReturnType<typeof getViewportLayout>
    ): [number, number, number] {
      const aspect = Math.max(0.1, width / Math.max(1, height))
      const tanHalf = Math.tan(layout.fov * 0.5)
      const camDist = -layout.camZ
      const vx = (ndcX - layout.ndcOffsetX) * camDist * tanHalf * aspect
      const vy = (ndcY - layout.ndcOffsetY) * camDist * tanHalf
      const vz = 0.55

      const cy = Math.cos(-yaw)
      const sy = Math.sin(-yaw)
      const cx = Math.cos(-pitch)
      const sx = Math.sin(-pitch)

      const y1 = vy * cx - vz * sx
      const z1 = vy * sx + vz * cx
      const lx = vx * cy + z1 * sy
      const lz = -vx * sy + z1 * cy
      return [lx, y1, lz]
    }

    function pushBurst(x: number, y: number, z: number, time: number) {
      bursts[nextBurstSlot] = { x, y, z, startTime: time }
      nextBurstSlot = (nextBurstSlot + 1) % MAX_BURSTS
    }

    function resize() {
      if (!canvas || !gl) return
      width = window.innerWidth
      height = window.innerHeight
      const maxDpr = width * height > 1550000 ? 1 : 1.25
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    function onMouseMove(e: MouseEvent) {
      pointer.ndcX = (e.clientX / Math.max(1, width)) * 2 - 1
      pointer.ndcY = -((e.clientY / Math.max(1, height)) * 2 - 1)
      pointer.active = true
      targetHoverYaw = pointer.ndcX * 0.34
      targetHoverPitch = -pointer.ndcY * 0.22
      lastInteractionTime = performance.now()
    }

    function onMouseDown(e: MouseEvent) {
      lastInteractionTime = performance.now()
      const ndcX = (e.clientX / Math.max(1, width)) * 2 - 1
      const ndcY = -((e.clientY / Math.max(1, height)) * 2 - 1)
      const layout = getViewportLayout()
      const currentYaw = -0.88 + simTime * 0.044 + smoothHoverYaw
      const currentPitch = 0.14 + Math.sin(simTime * 0.22) * 0.035 + smoothHoverPitch
      const [lx, ly, lz] = computePointerLocal(ndcX, ndcY, currentYaw, currentPitch, layout)
      const len = Math.hypot(lx, ly, lz)
      if (len < 1.65) {
        pushBurst(lx * 0.72, ly * 0.72, lz * 0.72, simTime)
      }
    }

    function onMouseLeave() {
      pointer.active = false
      targetHoverYaw = 0
      targetHoverPitch = 0
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseleave', onMouseLeave)

    const surfaceIndexType =
      scene.surface.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    const coreIndexType =
      scene.core.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT

    function renderFrame(now: number) {
      if (!gl) return
      if (document.hidden) {
        lastTimestamp = now
        if (!reducedMotion) {
          animId = requestAnimationFrame(renderFrame)
        }
        return
      }

      const elapsedMs = now - lastTimestamp
      const isInteractive =
        enteringRef.current ||
        burstTriggerRef.current !== lastExternalBurst ||
        now - lastInteractionTime < 650
      const minFrameMs = isInteractive ? 15.8 : 21.8

      if (elapsedMs < minFrameMs) {
        if (!reducedMotion) {
          animId = requestAnimationFrame(renderFrame)
        }
        return
      }

      const dt = Math.min(Math.max(elapsedMs / 1000, 0.001), 0.05)
      lastTimestamp = now

      if (!reducedMotion) {
        simTime += dt
      }

      if (burstTriggerRef.current !== lastExternalBurst) {
        lastExternalBurst = burstTriggerRef.current
        const angle = lastExternalBurst * 2.1
        const side = lastExternalBurst % 2 === 0 ? 1 : -1
        pushBurst(side * (0.28 + 0.18 * Math.cos(angle)), 0.15 + 0.28 * Math.sin(angle), 0.36 * Math.cos(angle * 0.7), simTime)
      }

      if (enteringRef.current && enterStartTime === null) {
        enterStartTime = simTime
        enterBurstStage = 0
      } else if (!enteringRef.current) {
        enterStartTime = null
        enterBurstStage = 0
      }

      let enterP = 0
      if (enterStartTime !== null) {
        enterP = Math.min(1, Math.max(0, (simTime - enterStartTime) / 1.12))
        if (enterBurstStage === 0 && enterP >= 0.01) {
          pushBurst(0, 0.08, 0.18, simTime)
          enterBurstStage = 1
        } else if (enterBurstStage === 1 && enterP >= 0.16) {
          pushBurst(-0.34, 0.14, 0.1, simTime)
          pushBurst(0.34, 0.14, 0.1, simTime)
          enterBurstStage = 2
        } else if (enterBurstStage === 2 && enterP >= 0.32) {
          pushBurst(0, 0.02, -0.22, simTime)
          enterBurstStage = 3
        }
      }

      const smoothP = enterP * enterP * (3 - 2 * enterP)
      const st = Math.min(1, Math.max(0, (enterP - 0.04) / 0.96))
      const scatter = st * st * (3 - 2 * st)
      const diveP = enterP * enterP

      const ease = 1 - Math.exp(-3.4 * dt)
      smoothHoverYaw += (targetHoverYaw - smoothHoverYaw) * ease
      smoothHoverPitch += (targetHoverPitch - smoothHoverPitch) * ease

      const yaw = -0.88 + simTime * 0.044 + smoothHoverYaw * (1 - smoothP) + smoothP * 0.44
      const pitch = (0.14 + Math.sin(simTime * 0.22) * 0.035 + smoothHoverPitch) * (1 - smoothP * 0.68)
      const bobY = Math.sin(simTime * 0.36) * 0.028 * (1 - smoothP)

      const baseLayout = getViewportLayout()
      const layout = {
        ndcOffsetX: baseLayout.ndcOffsetX * (1 - smoothP),
        ndcOffsetY: baseLayout.ndcOffsetY * (1 - smoothP),
        camZ: baseLayout.camZ + (-1.65 - baseLayout.camZ) * diveP,
        fov: baseLayout.fov + diveP * 0.26,
      }
      const surfaceFade = 1 - Math.min(1, Math.max(0, (enterP - 0.32) / 0.48))
      const lineFade = 1 - Math.min(1, Math.max(0, (enterP - 0.06) / 0.32))
      const tractBaseAlpha = (0.12 + Math.sin(Math.min(1, enterP * 2.2) * Math.PI) * 0.2) * lineFade

      const aspect = Math.max(0.1, width / Math.max(1, height))
      writeOffsetPerspective(projMat, layout.fov, aspect, 0.1, 25, layout.ndcOffsetX, layout.ndcOffsetY)
      writeModelView(mvMat, normMat, yaw, pitch, bobY, layout.camZ)
      writeModelView(dustMvMat, dustNormMat, yaw * 0.28 + simTime * 0.008, pitch * 0.3, bobY * 0.4, layout.camZ * (1 - diveP * 0.35))
      writeModelView(ringMvMat, ringNormMat, yaw * 0.55 - simTime * 0.022 - smoothP * 0.9, pitch * 0.65, bobY * 0.5, layout.camZ)

      const ptrLocal = computePointerLocal(pointer.ndcX, pointer.ndcY, yaw, pitch, layout)
      const ptrActive = pointer.active && Math.hypot(ptrLocal[0], ptrLocal[1], ptrLocal[2]) < 1.85 ? 1 : 0

      for (let i = 0; i < MAX_BURSTS; i++) {
        burstFlat[i * 4] = bursts[i].x
        burstFlat[i * 4 + 1] = bursts[i].y
        burstFlat[i * 4 + 2] = bursts[i].z
        burstFlat[i * 4 + 3] = bursts[i].startTime
      }

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.BLEND)

      if (dustVao) {
        gl.disable(gl.DEPTH_TEST)
        gl.depthMask(false)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
        gl.useProgram(pointProg.program)
        gl.uniformMatrix4fv(pointProg.uniforms.uModelView, false, dustMvMat)
        gl.uniformMatrix4fv(pointProg.uniforms.uProj, false, projMat)
        gl.uniform1f(pointProg.uniforms.uTime, simTime * 0.45)
        gl.uniform1f(pointProg.uniforms.uDpr, dpr)
        gl.uniform1f(pointProg.uniforms.uPointScale, 1.3)
        gl.uniform1f(pointProg.uniforms.uScatter, scatter * 0.22)
        gl.uniform3f(pointProg.uniforms.uPointerLocal, ptrLocal[0], ptrLocal[1], ptrLocal[2])
        gl.uniform1f(pointProg.uniforms.uPointerActive, 0)
        gl.uniform4fv(pointProg.uniforms['uBursts[0]'], burstFlat)
        gl.bindVertexArray(dustVao)
        gl.drawArrays(gl.POINTS, 0, scene.dust.positions.length / 3)
      }

      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)

      if (coreVao && surfaceFade > 0.01) {
        gl.enable(gl.CULL_FACE)
        gl.cullFace(gl.BACK)
        gl.depthMask(false)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
        gl.useProgram(surfaceProg.program)
        gl.uniformMatrix4fv(surfaceProg.uniforms.uModelView, false, mvMat)
        gl.uniformMatrix4fv(surfaceProg.uniforms.uProj, false, projMat)
        gl.uniformMatrix3fv(surfaceProg.uniforms.uNormalMat, false, normMat)
        gl.uniform1f(surfaceProg.uniforms.uTime, simTime)
        gl.uniform1f(surfaceProg.uniforms.uPassOpacity, 0.72 * surfaceFade)
        gl.uniform1f(surfaceProg.uniforms.uScatter, scatter * 0.65)
        gl.uniform3f(surfaceProg.uniforms.uPointerLocal, ptrLocal[0], ptrLocal[1], ptrLocal[2])
        gl.uniform1f(surfaceProg.uniforms.uPointerActive, ptrActive)
        gl.uniform4fv(surfaceProg.uniforms['uBursts[0]'], burstFlat)
        gl.bindVertexArray(coreVao)
        gl.drawElements(gl.TRIANGLES, scene.core.indices.length, coreIndexType, 0)
      }

      if (ringsVao && lineFade > 0.01) {
        gl.disable(gl.CULL_FACE)
        gl.depthMask(false)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
        gl.useProgram(tractProg.program)
        gl.uniformMatrix4fv(tractProg.uniforms.uModelView, false, ringMvMat)
        gl.uniformMatrix4fv(tractProg.uniforms.uProj, false, projMat)
        gl.uniform1f(tractProg.uniforms.uTime, simTime)
        gl.uniform1f(tractProg.uniforms.uBaseAlpha, 0.14 * lineFade)
        gl.uniform1f(tractProg.uniforms.uScatter, scatter * 0.45)
        gl.uniform3f(tractProg.uniforms.uPointerLocal, ptrLocal[0], ptrLocal[1], ptrLocal[2])
        gl.uniform1f(tractProg.uniforms.uPointerActive, 0)
        gl.uniform4fv(tractProg.uniforms['uBursts[0]'], burstFlat)
        gl.bindVertexArray(ringsVao)
        gl.drawArrays(gl.LINES, 0, scene.rings.positions.length / 3)
      }

      if (tractsVao && lineFade > 0.01) {
        gl.disable(gl.CULL_FACE)
        gl.depthMask(false)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
        gl.useProgram(tractProg.program)
        gl.uniformMatrix4fv(tractProg.uniforms.uModelView, false, mvMat)
        gl.uniformMatrix4fv(tractProg.uniforms.uProj, false, projMat)
        gl.uniform1f(tractProg.uniforms.uTime, simTime)
        gl.uniform1f(tractProg.uniforms.uBaseAlpha, tractBaseAlpha)
        gl.uniform1f(tractProg.uniforms.uScatter, scatter * 0.92)
        gl.uniform3f(tractProg.uniforms.uPointerLocal, ptrLocal[0], ptrLocal[1], ptrLocal[2])
        gl.uniform1f(tractProg.uniforms.uPointerActive, ptrActive)
        gl.uniform4fv(tractProg.uniforms['uBursts[0]'], burstFlat)
        gl.bindVertexArray(tractsVao)
        gl.drawArrays(gl.LINES, 0, scene.tracts.positions.length / 3)
      }

      if (wireVao && lineFade > 0.01) {
        gl.disable(gl.CULL_FACE)
        gl.depthMask(false)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
        gl.useProgram(tractProg.program)
        gl.uniformMatrix4fv(tractProg.uniforms.uModelView, false, mvMat)
        gl.uniformMatrix4fv(tractProg.uniforms.uProj, false, projMat)
        gl.uniform1f(tractProg.uniforms.uTime, simTime)
        gl.uniform1f(tractProg.uniforms.uBaseAlpha, 0.032 * lineFade)
        gl.uniform1f(tractProg.uniforms.uScatter, scatter)
        gl.uniform3f(tractProg.uniforms.uPointerLocal, ptrLocal[0], ptrLocal[1], ptrLocal[2])
        gl.uniform1f(tractProg.uniforms.uPointerActive, ptrActive)
        gl.uniform4fv(tractProg.uniforms['uBursts[0]'], burstFlat)
        gl.bindVertexArray(wireVao)
        gl.drawArrays(gl.LINES, 0, scene.wireframe.positions.length / 3)
      }

      if (nodesVao) {
        gl.depthMask(false)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
        gl.useProgram(pointProg.program)
        gl.uniformMatrix4fv(pointProg.uniforms.uModelView, false, mvMat)
        gl.uniformMatrix4fv(pointProg.uniforms.uProj, false, projMat)
        gl.uniform1f(pointProg.uniforms.uTime, simTime)
        gl.uniform1f(pointProg.uniforms.uDpr, dpr)
        gl.uniform1f(pointProg.uniforms.uPointScale, 2.2)
        gl.uniform1f(pointProg.uniforms.uScatter, scatter)
        gl.uniform3f(pointProg.uniforms.uPointerLocal, ptrLocal[0], ptrLocal[1], ptrLocal[2])
        gl.uniform1f(pointProg.uniforms.uPointerActive, ptrActive)
        gl.uniform4fv(pointProg.uniforms['uBursts[0]'], burstFlat)
        gl.bindVertexArray(nodesVao)
        gl.drawArrays(gl.POINTS, 0, scene.nodes.positions.length / 3)
      }

      if (surfaceVao && surfaceFade > 0.01) {
        gl.enable(gl.CULL_FACE)
        gl.cullFace(gl.BACK)
        gl.depthMask(true)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.useProgram(surfaceProg.program)
        gl.uniformMatrix4fv(surfaceProg.uniforms.uModelView, false, mvMat)
        gl.uniformMatrix4fv(surfaceProg.uniforms.uProj, false, projMat)
        gl.uniformMatrix3fv(surfaceProg.uniforms.uNormalMat, false, normMat)
        gl.uniform1f(surfaceProg.uniforms.uTime, simTime)
        gl.uniform1f(surfaceProg.uniforms.uPassOpacity, 0.92 * surfaceFade)
        gl.uniform1f(surfaceProg.uniforms.uScatter, scatter)
        gl.uniform3f(surfaceProg.uniforms.uPointerLocal, ptrLocal[0], ptrLocal[1], ptrLocal[2])
        gl.uniform1f(surfaceProg.uniforms.uPointerActive, ptrActive)
        gl.uniform4fv(surfaceProg.uniforms['uBursts[0]'], burstFlat)
        gl.bindVertexArray(surfaceVao)
        gl.drawElements(gl.TRIANGLES, scene.surface.indices.length, surfaceIndexType, 0)
      }

      gl.bindVertexArray(null)

      if (!reducedMotion) {
        animId = requestAnimationFrame(renderFrame)
      }
    }

    animId = requestAnimationFrame(renderFrame)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseleave', onMouseLeave)
      for (const vao of vaos) gl.deleteVertexArray(vao)
      for (const buf of buffers) gl.deleteBuffer(buf)
      for (const prog of programs) gl.deleteProgram(prog)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 w-full h-full z-0"
    />
  )
}
