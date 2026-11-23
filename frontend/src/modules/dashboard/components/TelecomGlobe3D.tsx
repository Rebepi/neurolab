import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { useTheme } from '../../../context/ThemeContext'
import { createEarthContinentTexture } from '../../../utils/threeTextures'

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

export function TelecomGlobe3D({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { mode } = useTheme()
  const isLight = mode === 'light'

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const width = Math.max(160, el.clientWidth)
    const height = Math.max(160, el.clientHeight)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(0, 0.45, 3.95)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setClearColor(0x000000, 0)
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = isLight ? 1.15 : 1.25
    el.appendChild(renderer.domElement)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.58, 0.42, 0.24)
    composer.addPass(bloomPass)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enableZoom = false
    controls.enablePan = false
    controls.autoRotate = true
    controls.autoRotateSpeed = 1.15

    scene.add(new THREE.AmbientLight(isLight ? 0xffffff : 0x38bdf8, isLight ? 2.2 : 1.45))
    const dirLight = new THREE.DirectionalLight(isLight ? 0xffffff : 0x5eead4, isLight ? 1.8 : 2.0)
    dirLight.position.set(4, 3, 5)
    scene.add(dirLight)

    const globeGroup = new THREE.Group()
    scene.add(globeGroup)

    const fallbackTex = createEarthContinentTexture(isLight)
    let loadedEarthTex: THREE.Texture | null = null

    const earthMat = new THREE.MeshStandardMaterial({
      map: fallbackTex,
      emissive: new THREE.Color(isLight ? '#e0f2fe' : '#22d3ee'),
      emissiveMap: fallbackTex,
      emissiveIntensity: isLight ? 0.25 : 1.05,
      roughness: isLight ? 0.42 : 0.35,
      metalness: isLight ? 0.08 : 0.2,
    })

    const loader = new THREE.TextureLoader()
    loader.load(
      isLight ? '/studio/earth-holo-equirect-light.png' : '/studio/earth-holo-equirect.png',
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        loadedEarthTex = tex
        earthMat.map = tex
        earthMat.emissiveMap = tex
        earthMat.needsUpdate = true
      },
      undefined,
      () => {}
    )

    const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1.02, 64, 64), earthMat)
    globeGroup.add(earthMesh)

    const atmoRim = new THREE.Mesh(
      new THREE.SphereGeometry(1.10, 48, 48),
      new THREE.MeshBasicMaterial({
        color: isLight ? 0x38bdf8 : 0x22d3ee,
        transparent: true,
        opacity: isLight ? 0.22 : 0.14,
        side: THREE.BackSide,
      })
    )
    globeGroup.add(atmoRim)

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.009, 12, 90),
      new THREE.MeshBasicMaterial({
        color: isLight ? 0x0284c7 : 0x2dd4bf,
        transparent: true,
        opacity: isLight ? 0.78 : 0.58,
      })
    )
    ring1.rotation.x = 1.12
    ring1.rotation.y = 0.38
    globeGroup.add(ring1)

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.28, 0.007, 12, 90),
      new THREE.MeshBasicMaterial({
        color: isLight ? 0x7c3aed : 0xa78bfa,
        transparent: true,
        opacity: isLight ? 0.72 : 0.45,
      })
    )
    ring2.rotation.x = -0.82
    ring2.rotation.y = 0.68
    globeGroup.add(ring2)

    const hubs: Array<[number, number, number]> = [
      [-12.04, -77.04, 0x2dd4bf],
      [40.71, -74.0, 0x38bdf8],
      [40.41, -3.7, 0xa78bfa],
      [35.68, 139.76, 0x22d3ee],
      [-23.55, -46.63, 0xfbbf24],
      [1.35, 103.81, 0x2dd4bf],
    ]
    const hubVecs = hubs.map(([lat, lon, col]) => {
      const v = latLonToVec3(lat, lon, 1.04)
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 12, 12),
        new THREE.MeshBasicMaterial({ color: col })
      )
      dot.position.copy(v)
      globeGroup.add(dot)
      return v
    })

    const arcPairs = [
      [0, 1],
      [1, 2],
      [2, 3],
      [0, 4],
      [3, 5],
      [4, 2],
    ]
    const curves: THREE.QuadraticBezierCurve3[] = []
    const travelers: THREE.Mesh[] = []

    arcPairs.forEach(([a, b], idx) => {
      const start = hubVecs[a]
      const end = hubVecs[b]
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.38)
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      curves.push(curve)
      const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.006, 6, false)
      const tubeMat = new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? (isLight ? 0x0284c7 : 0x2dd4bf) : (isLight ? 0x7c3aed : 0xa78bfa),
        transparent: true,
        opacity: isLight ? 0.78 : 0.62,
      })
      globeGroup.add(new THREE.Mesh(tubeGeo, tubeMat))

      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 10, 10),
        new THREE.MeshBasicMaterial({ color: isLight ? 0x38bdf8 : 0xffffff })
      )
      globeGroup.add(pulse)
      travelers.push(pulse)
    })

    const ro = new ResizeObserver(() => {
      if (!el) return
      const w = Math.max(160, el.clientWidth)
      const h = Math.max(160, el.clientHeight)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
    })
    ro.observe(el)

    let animId = 0
    const clock = new THREE.Clock()
    const animate = () => {
      const elapsed = clock.getElapsedTime()
      controls.update()
      ring1.rotation.z = elapsed * 0.24
      ring2.rotation.z = -elapsed * 0.18
      travelers.forEach((mesh, idx) => {
        const u = (elapsed * 0.35 + idx * 0.19) % 1
        mesh.position.copy(curves[idx].getPointAt(u))
      })
      if (isLight) {
        renderer.render(scene, camera)
      } else {
        composer.render()
      }
      animId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      controls.dispose()
      fallbackTex.dispose()
      if (loadedEarthTex) loadedEarthTex.dispose()
      composer.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement)
      }
    }
  }, [isLight])

  return (
    <div
      ref={containerRef}
      style={
        !isLight
          ? {
              maskImage: 'radial-gradient(circle at center, black 62%, transparent 98%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 62%, transparent 98%)',
            }
          : undefined
      }
      className={`w-full h-full cursor-grab active:cursor-grabbing ${!isLight ? 'nl-globe-blend' : ''} ${className}`}
    />
  )
}
