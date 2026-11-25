const SCATTER_GLSL = `
vec3 computeScatter(vec3 pos, float seed, float scatter) {
  if (scatter <= 0.001) {
    return vec3(0.0);
  }
  vec3 safePos = pos + vec3(0.0001, 0.0002, -0.0001);
  float r = length(safePos);
  vec3 dir = safePos / r;

  float radialNorm = clamp(r / 1.15, 0.0, 1.2);
  float jitter = fract(seed * 19.73) * 0.14;
  float implosion = sin(clamp(scatter / 0.18, 0.0, 1.0) * 3.14159265) * 0.095 * (1.0 - smoothstep(0.14, 0.36, scatter));

  float localS = clamp((scatter * 1.42 - radialNorm * 0.28 - jitter), 0.0, 1.0);
  float speedVar = 0.72 + fract(seed * 37.13) * 1.55;
  float s = pow(localS, 1.52) * speedVar;

  vec3 tangent = normalize(vec3(-dir.z, 0.34 * sin(seed * 9.0), dir.x) + vec3(0.0002, 0.0001, 0.0001));
  vec3 bitan = cross(dir, tangent);

  float swirlDir = fract(seed * 13.71) > 0.5 ? 1.0 : -1.0;
  float swirlAngle = s * (2.1 + fract(seed * 23.41) * 2.2) * swirlDir;

  vec3 curl1 = vec3(
    sin(pos.y * 5.2 + s * 3.4 + seed),
    cos(pos.z * 5.2 - s * 3.1 + seed * 1.3),
    sin(pos.x * 5.2 + s * 3.7 - seed * 0.7)
  ) * (0.38 * s);

  float radialBurst = s * 3.85 - implosion;
  vec3 vortexOffset = tangent * sin(swirlAngle) * (s * 1.45) + bitan * (cos(swirlAngle) - 1.0) * (s * 0.65);
  vec3 cameraRush = vec3(dir.x * 0.55, dir.y * 0.55, 1.15) * (pow(localS, 2.05) * 2.4 * speedVar);

  return dir * radialBurst + vortexOffset + curl1 + cameraRush;
}
`

export const SURFACE_VS = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in float aFold;
in float aRegion;

uniform mat4 uModelView;
uniform mat4 uProj;
uniform mat3 uNormalMat;
uniform float uTime;
uniform float uScatter;
uniform vec3 uPointerLocal;
uniform float uPointerActive;
uniform vec4 uBursts[6];

out vec3 vViewPos;
out vec3 vViewNormal;
out vec3 vLocalPos;
out float vFold;
out float vRegion;
out float vDynamicGlow;

void main() {
  float implode = sin(clamp(uScatter / 0.18, 0.0, 1.0) * 3.14159265) * 0.055 * (1.0 - smoothstep(0.14, 0.35, uScatter));
  float swell = pow(max(0.0, uScatter - 0.12), 1.35) * 0.52;
  vec3 displaced = aPosition * (1.0 - implode) + aNormal * (swell * (0.5 + 0.5 * aFold));
  vec4 mvPos = uModelView * vec4(displaced, 1.0);

  float waveAxis = sin(aPosition.z * 2.1 - uTime * 0.42 + aPosition.y * 0.9);
  float dWave = waveAxis - 0.82;
  float eegWave = exp(-dWave * dWave * 14.0);

  float hoverGlow = 0.0;
  if (uPointerActive > 0.5) {
    vec3 pd = aPosition - uPointerLocal;
    hoverGlow = exp(-dot(pd, pd) * 3.8) * 0.85;
  }

  float burstEnergy = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 b = uBursts[i];
    if (b.w >= 0.0) {
      float age = uTime - b.w;
      if (age >= 0.0 && age < 3.6) {
        float waveR = age * 0.72;
        float d = length(aPosition - b.xyz) - waveR;
        burstEnergy += exp(-d * d * 27.0) * (1.0 - age / 3.6) * 1.15;
      }
    }
  }

  vViewPos = mvPos.xyz;
  vViewNormal = normalize(uNormalMat * aNormal);
  vLocalPos = aPosition;
  vFold = aFold;
  vRegion = aRegion;
  vDynamicGlow = eegWave * 0.42 + hoverGlow * 0.58 + clamp(burstEnergy, 0.0, 1.4) * 0.78;
  gl_Position = uProj * mvPos;
}
`

export const SURFACE_FS = `#version 300 es
precision highp float;

in vec3 vViewPos;
in vec3 vViewNormal;
in vec3 vLocalPos;
in float vFold;
in float vRegion;
in float vDynamicGlow;

uniform float uTime;
uniform float uPassOpacity;
uniform float uScatter;
uniform float uLightMode;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vViewNormal);
  if (!gl_FrontFacing) {
    N = -N;
  }
  vec3 V = normalize(-vViewPos);
  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float invNdv = 1.0 - ndv;
  float fresnel = invNdv * invNdv;

  vec3 lightDir1 = vec3(0.545, 0.713, 0.442);
  vec3 lightDir2 = vec3(-0.707, -0.381, 0.596);
  float diff1 = max(dot(N, lightDir1), 0.0);
  float diff2 = max(dot(N, lightDir2), 0.0);
  vec3 H = normalize(lightDir1 + V);
  float ndh = max(dot(N, H), 0.0);
  float ndh2 = ndh * ndh;
  float ndh4 = ndh2 * ndh2;
  float spec = ndh4 * ndh4 * ndh4 * ndh4;

  float gyrusCrest = smoothstep(0.28, 0.9, vFold);
  float sulcusLine = 1.0 - smoothstep(0.14, 0.48, vFold);
  float fDiff = (vFold - 0.52) * 5.2;
  float ridgeLip = 1.0 / (1.0 + fDiff * fDiff * 1.5);
  float contour = 0.5 + 0.5 * sin(vFold * 26.0 + vLocalPos.z * 6.5 - uTime * 0.35);
  float c2 = contour * contour;
  float microContour = c2 * c2 * 0.12;

  float surfDist = length(vLocalPos) * 0.84 - vFold * 0.12;
  float waveFront = uScatter * 1.68 - 0.06;
  float shockEdge = 0.0;
  float dissolveMask = 1.0;
  if (uScatter > 0.005) {
    float sDiff = (surfDist - waveFront) * 9.5;
    shockEdge = (1.0 / (1.0 + sDiff * sDiff)) * smoothstep(0.0, 0.12, uScatter);
    dissolveMask = smoothstep(waveFront - 0.18, waveFront + 0.05, surfDist);
  }

  float stemFade = 1.0;
  if (vRegion >= 1.5 && vRegion < 2.5) {
    stemFade = smoothstep(-1.02, -0.58, vLocalPos.y);
  }

  if (uLightMode > 0.5) {
    vec3 sulcusColor = vec3(0.08, 0.17, 0.46);
    vec3 gyrusColor = vec3(0.03, 0.44, 0.58);
    vec3 rimColor = vec3(0.11, 0.52, 0.78);

    if (vRegion > 0.5 && vRegion < 1.5) {
      sulcusColor = vec3(0.10, 0.22, 0.54);
      gyrusColor = vec3(0.05, 0.44, 0.74);
      rimColor = vec3(0.16, 0.50, 0.88);
    } else if (vRegion >= 1.5 && vRegion < 2.5) {
      sulcusColor = vec3(0.24, 0.14, 0.52);
      gyrusColor = vec3(0.35, 0.26, 0.76);
      rimColor = vec3(0.45, 0.36, 0.88);
    } else if (vRegion >= 2.5) {
      sulcusColor = vec3(0.04, 0.34, 0.44);
      gyrusColor = vec3(0.06, 0.52, 0.58);
      rimColor = vec3(0.10, 0.64, 0.70);
    }

    vec3 baseCol = mix(sulcusColor, gyrusColor, gyrusCrest);
    baseCol = mix(baseCol, rimColor, clamp(fresnel * 0.68 + ridgeLip * 0.22, 0.0, 0.82));
    baseCol += vec3(0.04, 0.20, 0.34) * (diff1 * 0.22 * gyrusCrest + microContour * 0.55);
    baseCol += vec3(0.08, 0.15, 0.44) * diff2 * 0.18;
    baseCol = mix(baseCol, vec3(0.05, 0.62, 0.74), clamp(vDynamicGlow * 0.48 + spec * 0.28 * gyrusCrest, 0.0, 0.72));
    baseCol = mix(baseCol, vec3(0.03, 0.52, 0.72), clamp(shockEdge * 0.88, 0.0, 1.0));
    baseCol *= 1.0 - sulcusLine * 0.34;

    float baseAlpha = 0.095 + fresnel * 0.56 + gyrusCrest * 0.12 + ridgeLip * 0.08 + spec * 0.14;
    baseAlpha += vDynamicGlow * 0.28 + shockEdge * 0.48;
    if (vRegion >= 2.5) {
      baseAlpha += 0.24;
    }

    float finalAlpha = clamp(baseAlpha * uPassOpacity * stemFade * dissolveMask, 0.0, 0.86);
    fragColor = vec4(baseCol, finalAlpha);
    return;
  }

  vec3 sulcusColor = vec3(0.16, 0.19, 0.58);
  vec3 gyrusColor = vec3(0.08, 0.68, 0.78);
  vec3 rimColor = vec3(0.36, 0.93, 0.88);

  if (vRegion > 0.5 && vRegion < 1.5) {
    sulcusColor = vec3(0.11, 0.25, 0.62);
    gyrusColor = vec3(0.22, 0.74, 0.98);
    rimColor = vec3(0.49, 0.85, 1.0);
  } else if (vRegion >= 1.5 && vRegion < 2.5) {
    sulcusColor = vec3(0.24, 0.14, 0.52);
    gyrusColor = vec3(0.55, 0.42, 0.96);
    rimColor = vec3(0.76, 0.62, 1.0);
  } else if (vRegion >= 2.5) {
    sulcusColor = vec3(0.06, 0.45, 0.42);
    gyrusColor = vec3(0.18, 0.85, 0.75);
    rimColor = vec3(0.42, 0.98, 0.88);
  }

  vec3 baseCol = mix(sulcusColor, gyrusColor, gyrusCrest);
  baseCol += rimColor * (fresnel * 1.15 + spec * 0.65 * gyrusCrest + ridgeLip * 0.24);
  baseCol += vec3(0.14, 0.26, 0.78) * diff2 * 0.36;
  baseCol += vec3(0.28, 0.9, 0.96) * (diff1 * 0.34 * gyrusCrest + microContour);
  baseCol += vec3(0.26, 0.95, 0.88) * vDynamicGlow;
  baseCol += vec3(0.72, 0.99, 1.0) * (shockEdge * 1.65);
  baseCol *= 1.0 - sulcusLine * 0.44;

  float baseAlpha = 0.085 + fresnel * 0.62 + gyrusCrest * 0.13 + ridgeLip * 0.08 + spec * 0.24;
  baseAlpha += vDynamicGlow * 0.42 + shockEdge * 0.65;
  if (vRegion >= 2.5) {
    baseAlpha += 0.22;
  }

  float finalAlpha = clamp(baseAlpha * uPassOpacity * stemFade * dissolveMask, 0.0, 0.95);
  fragColor = vec4(baseCol, finalAlpha);
}
`

export const TRACT_VS = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec4 aTractAttr;

uniform mat4 uModelView;
uniform mat4 uProj;
uniform float uTime;
uniform float uScatter;
uniform vec3 uPointerLocal;
uniform float uPointerActive;
uniform vec4 uBursts[6];

out float vDepthFade;
out vec4 vTractAttr;
out float vBoost;

void main() {
  float implode = sin(clamp(uScatter / 0.18, 0.0, 1.0) * 3.14159265) * 0.055 * (1.0 - smoothstep(0.14, 0.35, uScatter));
  float swell = pow(max(0.0, uScatter - 0.08), 1.25) * 0.38;
  vec3 pos = aPosition * (1.0 - implode + swell);
  vec4 mvPos = uModelView * vec4(pos, 1.0);

  float burstBoost = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 b = uBursts[i];
    if (b.w >= 0.0) {
      float age = uTime - b.w;
      if (age >= 0.0 && age < 3.6) {
        float waveR = age * 0.72;
        float d = length(aPosition - b.xyz) - waveR;
        burstBoost += exp(-d * d * 20.0) * (1.0 - age / 3.6);
      }
    }
  }

  float pointerBoost = 0.0;
  if (uPointerActive > 0.5) {
    vec3 pd = aPosition - uPointerLocal;
    pointerBoost = exp(-dot(pd, pd) * 3.6) * 0.55;
  }

  vTractAttr = aTractAttr;
  vBoost = burstBoost + pointerBoost * 0.65;
  vDepthFade = clamp((mvPos.z + 5.6) / 2.2, 0.28, 1.0);
  gl_Position = uProj * mvPos;
}
`

export const TRACT_FS = `#version 300 es
precision highp float;

in float vDepthFade;
in vec4 vTractAttr;
in float vBoost;

uniform float uTime;
uniform float uBaseAlpha;
uniform float uScatter;
uniform float uLightMode;

out vec4 fragColor;

void main() {
  float progress = vTractAttr.x;
  float phase = vTractAttr.y;
  float speed = vTractAttr.z;
  float colorMix = vTractAttr.w;

  float head = fract(uTime * speed + phase);
  float dist = progress - head;
  if (dist > 0.0) {
    dist -= 1.0;
  }
  float absDist = -dist;
  float tailPulse = smoothstep(0.28, 0.0, absDist) / (1.0 + absDist * 8.0);

  float revHead = fract(uTime * speed * 0.68 + phase * 1.37 + 0.5);
  float revDist = (1.0 - progress) - revHead;
  if (revDist > 0.0) {
    revDist -= 1.0;
  }
  float revAbs = -revDist;
  float revPulse = (smoothstep(0.22, 0.0, revAbs) / (1.0 + revAbs * 9.0)) * 0.65;

  float pulse = clamp(tailPulse + revPulse, 0.0, 1.25);
  float scatterFlash = sin(min(1.0, uScatter * 2.8) * 3.14159) * 0.75;
  float scatterFade = 1.0 - smoothstep(0.06, 0.34, uScatter);

  if (uLightMode > 0.5) {
    vec3 tealCol = vec3(0.03, 0.50, 0.55);
    vec3 indigoCol = vec3(0.20, 0.30, 0.82);
    vec3 violetCol = vec3(0.45, 0.24, 0.80);
    vec3 tractHue = mix(tealCol, mix(indigoCol, violetCol, smoothstep(0.45, 1.0, colorMix)), smoothstep(0.0, 0.7, colorMix));
    vec3 finalCol = mix(tractHue, vec3(0.02, 0.62, 0.84), clamp(pulse * 0.68 + vBoost * 0.60 + scatterFlash * 0.5, 0.0, 1.0));
    float alpha = (uBaseAlpha * 1.35 + pulse * 0.76 + vBoost * 0.65 + scatterFlash * 0.32) * vDepthFade * scatterFade;
    fragColor = vec4(finalCol, clamp(alpha, 0.0, 0.92));
    return;
  }

  vec3 tealCol = vec3(0.18, 0.88, 0.8);
  vec3 indigoCol = vec3(0.42, 0.54, 0.99);
  vec3 violetCol = vec3(0.75, 0.52, 0.98);
  vec3 tractHue = mix(tealCol, mix(indigoCol, violetCol, smoothstep(0.45, 1.0, colorMix)), smoothstep(0.0, 0.7, colorMix));

  vec3 finalCol = mix(tractHue * 0.8, vec3(0.76, 0.98, 1.0), clamp(pulse * 0.72 + vBoost * 0.65 + scatterFlash * 0.55, 0.0, 1.0));
  float alpha = (uBaseAlpha + pulse * 0.86 + vBoost * 0.75 + scatterFlash * 0.35) * vDepthFade * scatterFade;

  fragColor = vec4(finalCol, clamp(alpha, 0.0, 0.98));
}
`

export const POINT_VS = `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aPointAttr;

uniform mat4 uModelView;
uniform mat4 uProj;
uniform float uTime;
uniform float uDpr;
uniform float uPointScale;
uniform float uScatter;
uniform vec3 uPointerLocal;
uniform float uPointerActive;
uniform vec4 uBursts[6];

out float vAlpha;
out float vTint;
out float vExcite;
${SCATTER_GLSL}
void main() {
  float seed = aPointAttr.y + aPointAttr.z * 5.0;
  vec3 scatteredPos = aPosition + computeScatter(aPosition, seed, uScatter);
  vec4 mvPos = uModelView * vec4(scatteredPos, 1.0);
  float distCam = max(0.45, -mvPos.z);

  float breathe = 0.55 + 0.45 * sin(uTime * 0.65 + aPointAttr.y);
  float dWave = sin(aPosition.z * 2.1 - uTime * 0.42 + aPosition.y * 0.9) - 0.82;
  float wave = exp(-dWave * dWave * 14.0);

  float excite = wave * 0.7;
  if (uPointerActive > 0.5) {
    vec3 pd = aPosition - uPointerLocal;
    excite = max(excite, exp(-dot(pd, pd) * 3.8));
  }
  for (int i = 0; i < 6; i++) {
    vec4 b = uBursts[i];
    if (b.w >= 0.0) {
      float age = uTime - b.w;
      if (age >= 0.0 && age < 3.6) {
        float waveR = age * 0.72;
        float d = length(aPosition - b.xyz) - waveR;
        excite += exp(-d * d * 20.0) * (1.0 - age / 3.6) * 1.1;
      }
    }
  }

  float rNorm = clamp(length(aPosition) / 1.15, 0.0, 1.2);
  float localS = clamp((uScatter * 1.42 - rNorm * 0.28 - fract(seed * 19.73) * 0.14), 0.0, 1.0);
  float bloom = sin(min(1.0, localS * 1.35) * 3.14159265);
  float isMicro = step(aPointAttr.x, 1.22);
  float idleVis = mix(1.0, min(1.0, 0.28 + localS * 2.4 + uScatter * 0.9), isMicro * step(1.5, uPointScale));
  float scatterFade = 1.0 - smoothstep(0.75, 1.0, localS);

  vExcite = clamp(excite + bloom * 1.25, 0.0, 1.6);
  vTint = aPointAttr.z;
  float depthFade = clamp((mvPos.z + 5.6) / 2.2, 0.25, 1.0);
  vAlpha = (0.3 + 0.34 * breathe + 0.56 * vExcite) * depthFade * idleVis * scatterFade;

  float baseSize = aPointAttr.x * uPointScale * (1.0 + vExcite * 0.6 + bloom * 0.85);
  gl_PointSize = clamp((baseSize * uDpr * 3.8) / distCam, 1.5, 26.0);
  gl_Position = uProj * mvPos;
}
`

export const POINT_FS = `#version 300 es
precision highp float;

in float vAlpha;
in float vTint;
in float vExcite;

uniform float uLightMode;

out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) {
    discard;
  }

  float inv = 1.0 - r2;
  float halo = inv * inv;
  float core = halo * halo * halo;

  if (uLightMode > 0.5) {
    vec3 c1 = vec3(0.04, 0.54, 0.56);
    vec3 c2 = vec3(0.18, 0.34, 0.84);
    vec3 c3 = vec3(0.46, 0.24, 0.82);
    vec3 hue = mix(c1, mix(c2, c3, smoothstep(0.45, 1.0, vTint)), smoothstep(0.0, 0.7, vTint));
    vec3 col = mix(hue, vec3(0.04, 0.70, 0.84), clamp(core * 0.65 + vExcite * 0.42, 0.0, 1.0));
    float alpha = (core * 0.90 + halo * 0.38) * vAlpha * 0.82;
    fragColor = vec4(col, clamp(alpha, 0.0, 0.92));
    return;
  }

  vec3 c1 = vec3(0.18, 0.89, 0.78);
  vec3 c2 = vec3(0.38, 0.56, 0.99);
  vec3 c3 = vec3(0.75, 0.52, 0.98);
  vec3 hue = mix(c1, mix(c2, c3, smoothstep(0.45, 1.0, vTint)), smoothstep(0.0, 0.7, vTint));

  vec3 col = mix(hue, vec3(0.94, 0.99, 1.0), clamp(core * 0.75 + vExcite * 0.48, 0.0, 1.0));
  float alpha = (core * 0.88 + halo * 0.42) * vAlpha;
  fragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`
