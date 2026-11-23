import * as THREE from 'three'

const CONTINENTS: Array<Array<[number, number]>> = [
  [
    [-168, 66], [-140, 70], [-100, 72], [-80, 62], [-55, 50],
    [-68, 42], [-81, 25], [-96, 18], [-84, 9], [-78, 8],
    [-92, 14], [-105, 20], [-112, 32], [-125, 48], [-152, 60],
  ],
  [
    [-78, 10], [-62, 11], [-50, 1], [-35, -6], [-40, -22],
    [-53, -33], [-66, -45], [-68, -55], [-74, -46], [-71, -30],
    [-77, -12], [-81, -4],
  ],
  [
    [-10, 36], [10, 37], [32, 31], [43, 12], [51, 11],
    [41, -2], [35, -24], [20, -35], [14, -22], [9, 4],
    [-16, 14], [-17, 24],
  ],
  [
    [-9, 37], [-5, 44], [2, 51], [10, 56], [24, 65],
    [40, 67], [30, 50], [28, 41], [16, 40], [6, 43],
  ],
  [
    [35, 34], [58, 24], [73, 22], [78, 8], [92, 22],
    [104, 2], [114, 22], [122, 31], [135, 36], [142, 52],
    [168, 65], [130, 71], [80, 72], [55, 68], [40, 52],
  ],
  [
    [114, -22], [132, -12], [146, -18], [153, -28], [146, -38],
    [131, -32], [115, -34],
  ],
]

function pointInPoly(lon: number, lat: number, poly: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-9) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function createEarthContinentTexture(isLight = false): THREE.CanvasTexture {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const ocean = ctx.createLinearGradient(0, 0, 0, h)
  if (isLight) {
    ocean.addColorStop(0, '#e0f2fe')
    ocean.addColorStop(0.5, '#bae6fd')
    ocean.addColorStop(1, '#dbeafe')
  } else {
    ocean.addColorStop(0, '#041229')
    ocean.addColorStop(0.5, '#061a38')
    ocean.addColorStop(1, '#041229')
  }
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.22)' : 'rgba(34, 211, 238, 0.14)'
  ctx.lineWidth = 1
  for (let x = 0; x <= w; x += w / 18) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += h / 9) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  for (const poly of CONTINENTS) {
    ctx.beginPath()
    poly.forEach(([lon, lat], idx) => {
      const px = ((lon + 180) / 360) * w
      const py = ((90 - lat) / 180) * h
      if (idx === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.28)' : 'rgba(13, 148, 136, 0.34)'
    ctx.fill()
    ctx.strokeStyle = isLight ? '#0284c7' : '#22d3ee'
    ctx.lineWidth = 2.2
    ctx.stroke()
  }

  for (let py = 8; py < h - 8; py += 6) {
    for (let px = 8; px < w - 8; px += 6) {
      const lon = (px / w) * 360 - 180
      const lat = 90 - (py / h) * 180
      if (CONTINENTS.some(poly => pointInPoly(lon, lat, poly))) {
        ctx.fillStyle = isLight
          ? (px + py) % 12 === 0
            ? '#0d9488'
            : '#0369a1'
          : (px + py) % 12 === 0
            ? '#5eead4'
            : '#38bdf8'
        ctx.fillRect(px, py, 2.4, 2.4)
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

export function createCityWindowTexture(accentHex = '#22d3ee', isLight = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = isLight ? '#1e3a5f' : '#071124'
  ctx.fillRect(0, 0, 128, 256)

  for (let y = 8; y < 248; y += 12) {
    for (let x = 8; x < 120; x += 14) {
      const lit = ((x * 17 + y * 31) % 11) > 3
      if (lit) {
        const hot = ((x + y) % 5) === 0
        ctx.fillStyle = hot ? (isLight ? '#e0f2fe' : '#a5f3fc') : accentHex
        ctx.fillRect(x, y, 8, 6)
      } else {
        ctx.fillStyle = isLight ? '#2b4c73' : '#0c1c3a'
        ctx.fillRect(x, y, 8, 6)
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createStudioBackdropTexture(isLight = false): THREE.CanvasTexture {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, 0, h)
  if (isLight) {
    bg.addColorStop(0, '#f8fbff')
    bg.addColorStop(0.54, '#eaf3fc')
    bg.addColorStop(1, '#dce9f7')
  } else {
    bg.addColorStop(0, '#030917')
    bg.addColorStop(0.54, '#081936')
    bg.addColorStop(1, '#030815')
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const horizon = ctx.createRadialGradient(w * 0.5, h * 0.56, 20, w * 0.5, h * 0.56, w * 0.52)
  if (isLight) {
    horizon.addColorStop(0, 'rgba(14, 165, 233, 0.14)')
    horizon.addColorStop(0.5, 'rgba(99, 102, 241, 0.06)')
    horizon.addColorStop(1, 'rgba(255, 255, 255, 0)')
  } else {
    horizon.addColorStop(0, 'rgba(34, 211, 238, 0.16)')
    horizon.addColorStop(0.45, 'rgba(99, 102, 241, 0.10)')
    horizon.addColorStop(1, 'rgba(3, 8, 21, 0)')
  }
  ctx.fillStyle = horizon
  ctx.fillRect(0, 0, w, h)

  if (!isLight) {
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 197 + 43) % w)
      const sy = ((i * 113 + 29) % Math.floor(h * 0.72))
      const a = 0.08 + (i % 4) * 0.05
      ctx.fillStyle = i % 3 === 0 ? `rgba(125, 211, 252, ${a})` : `rgba(167, 139, 250, ${a})`
      ctx.beginPath()
      ctx.arc(sx, sy, i % 5 === 0 ? 1.4 : 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createRadialFloorTexture(isLight = false): THREE.CanvasTexture {
  const s = 1024
  const c = s / 2
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, s, s)

  const base = ctx.createRadialGradient(c, c, 10, c, c, 500)
  if (isLight) {
    base.addColorStop(0, 'rgba(186, 230, 253, 0.42)')
    base.addColorStop(0.55, 'rgba(219, 234, 254, 0.22)')
    base.addColorStop(1, 'rgba(241, 245, 249, 0)')
  } else {
    base.addColorStop(0, 'rgba(10, 34, 68, 0.72)')
    base.addColorStop(0.55, 'rgba(7, 22, 48, 0.4)')
    base.addColorStop(1, 'rgba(3, 9, 23, 0)')
  }
  ctx.fillStyle = base
  ctx.fillRect(0, 0, s, s)

  ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.16)' : 'rgba(34, 211, 238, 0.16)'
  ctx.lineWidth = 1
  for (let i = 0; i <= s; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, s)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(s, i)
    ctx.stroke()
  }

  ctx.strokeStyle = isLight ? 'rgba(79, 70, 229, 0.22)' : 'rgba(99, 102, 241, 0.28)'
  ctx.lineWidth = 1.6
  for (let i = 0; i <= s; i += 128) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, s)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(s, i)
    ctx.stroke()
  }

  ;[120, 230, 340, 440].forEach((rad, idx) => {
    ctx.strokeStyle = isLight
      ? idx % 2 === 0
        ? 'rgba(2, 132, 199, 0.26)'
        : 'rgba(124, 58, 237, 0.18)'
      : idx % 2 === 0
        ? 'rgba(34, 211, 238, 0.28)'
        : 'rgba(129, 140, 248, 0.22)'
    ctx.lineWidth = idx === 1 || idx === 3 ? 1.8 : 1.2
    ctx.beginPath()
    ctx.arc(c, c, rad, 0, Math.PI * 2)
    ctx.stroke()
  })

  ctx.globalCompositeOperation = 'destination-in'
  const mask = ctx.createRadialGradient(c, c, s * 0.14, c, c, 500)
  mask.addColorStop(0, 'rgba(0, 0, 0, 1)')
  mask.addColorStop(0.45, 'rgba(0, 0, 0, 0.92)')
  mask.addColorStop(0.78, 'rgba(0, 0, 0, 0.4)')
  mask.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, s, s)
  ctx.globalCompositeOperation = 'source-over'

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createCyberGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#030917'
  ctx.fillRect(0, 0, 512, 512)

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)'
  ctx.lineWidth = 1.5
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 512)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(512, i)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)'
  ctx.lineWidth = 2
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 512)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(512, i)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 4)
  return tex
}

export function createGlowSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(94,234,212,0.85)')
  grad.addColorStop(0.6, 'rgba(56,189,248,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}
