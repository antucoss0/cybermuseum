import * as THREE from 'three'
import { getPbrTexture, P } from './pbr'

export const shared = {
  time: { value: 0 },
  energy: { value: 0 },
  ripples: { value: [new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0)] },
  lavender: { value: new THREE.Color('#b89cff') },
}

export const M = {
  stone: P.stoneWall,
  stoneLight: P.stoneCarved,
  obsidian: new THREE.MeshStandardMaterial({ color: '#0b0a12', roughness: 0.18, metalness: 0.75 }),
  marble: P.marbleFloor,
  neon: new THREE.MeshBasicMaterial({ color: new THREE.Color('#b89cff').multiplyScalar(1.15), toneMapped: false }),
  neonSoft: new THREE.MeshBasicMaterial({ color: new THREE.Color('#9b7bff').multiplyScalar(1.1), toneMapped: false }),
  neonWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.1), toneMapped: false }),
  glass: new THREE.MeshBasicMaterial({ color: '#8a7cff', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
  black: new THREE.MeshBasicMaterial({ color: '#000000' }),
  gold: P.gold,
  coffer: new THREE.MeshStandardMaterial({ color: '#1d1830', roughness: 0.5, metalness: 0.55, emissive: '#120c26', emissiveIntensity: 0.6 }),
}

/** Checkerboard marble floor with animated lavender light waves driven by payments. */
export function floorMaterial(tile = 2, glowFrom = new THREE.Vector2(0, 0)) {
  const marbleTexture = getPbrTexture('grey_cartago_01')
  const darkMarbleTexture = getPbrTexture('marble_rock_03')
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.time,
      uEnergy: shared.energy,
      uRipples: shared.ripples,
      uTile: { value: tile },
      uCenter: { value: glowFrom },
      uLav: shared.lavender,
      uMarble: { value: marbleTexture },
      uMarbleDark: { value: darkMarbleTexture },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      uniform float uTime; uniform float uEnergy; uniform float uTile; uniform vec2 uCenter; uniform vec3 uLav;
      uniform sampler2D uMarble; uniform sampler2D uMarbleDark;
      uniform vec4 uRipples[4];
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
      vec3 cmSrgbToLinear(vec3 value) {
        return mix(pow((value + 0.055) / 1.055, vec3(2.4)), value / 12.92, lessThanEqual(value, vec3(0.04045)));
      }
      void main(){
        vec2 p = vW.xz / uTile;
        vec2 c = floor(p);
        float chk = mod(c.x + c.y, 2.0);
        vec2 f = fract(p);
        float vein = smoothstep(0.62, 0.0, abs(vnoise(vW.xz*0.9)*2.0-1.0 + vnoise(vW.xz*3.1)*0.3 - 0.15));
        vec2 marbleUv = vW.xz / uTile;
        vec3 whiteMarble = cmSrgbToLinear(texture2D(uMarble, marbleUv).rgb);
        vec3 darkMarble = cmSrgbToLinear(texture2D(uMarbleDark, marbleUv).rgb);
        vec3 white = whiteMarble * vec3(0.48,0.48,0.56) - vein*0.018;
        vec3 black = darkMarble * vec3(0.12,0.12,0.17) + vein*0.018;
        vec3 col = mix(black, white, chk);
        float grout = 1.0 - smoothstep(0.0, 0.025, min(min(f.x,1.0-f.x), min(f.y,1.0-f.y)));
        col = mix(col, vec3(0.05,0.04,0.09), grout*0.8);
        float d = length(vW.xz - uCenter);
        // obsidian glitter: tiny stars embedded in the stone
        vec2 gq = floor(vW.xz*14.0);
        float gh = hash(gq);
        col += vec3(0.75,0.7,1.0) * step(0.996, gh) * (0.5 + 0.5*sin(uTime*3.0 + gh*80.0)) * 0.6;
        // polished reflection of the cloud column (view dependent)
        vec3 V = normalize(cameraPosition - vW);
        float spec = pow(max(0.0, 1.0 - V.y), 3.0) * exp(-d*0.05);
        col += uLav * spec * 0.035 * (1.0 + uEnergy*2.0);
        // fake reflection of the lights above
        float refl = exp(-d*0.12) * (0.12 + uEnergy*0.3);
        col += uLav * refl * mix(0.45, 0.12, chk);
        // concentric pattern waves
        float wave = sin(d*1.4 - uTime*1.6) * 0.5 + 0.5;
        col += uLav * pow(wave, 12.0) * (0.04 + uEnergy*0.22) * exp(-d*0.04) * (1.0-chk*0.5);
        for (int i=0;i<4;i++){
          vec4 r = uRipples[i];
          float age = uTime - r.z;
          if (age < 0.0 || age > 6.0) continue;
          float rd = length(vW.xz - r.xy);
          float ring = exp(-pow((rd - age*9.0)*0.8, 2.0));
          col += uLav * ring * (1.0 - age/6.0) * 0.45 * r.w;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

const labelCache = new Map<string, THREE.CanvasTexture>()
/** Plane with serif text, used for room titles and signage. */
export function label(text: string, sub = '', width = 6, color = '#e8e0ff') {
  const key = text + '|' + sub + '|' + color
  let tex = labelCache.get(key)
  if (!tex) {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 256
    const g = c.getContext('2d')!
    g.textAlign = 'center'
    g.fillStyle = color
    g.shadowColor = '#8b5cf6'
    g.shadowBlur = 18
    g.font = '400 92px "Playfair Display", Georgia, serif'
    g.fillText(text.toUpperCase().split('').join(String.fromCharCode(8202)), 512, sub ? 120 : 160)
    if (sub) {
      g.font = '400 34px "Roboto Mono", monospace'
      g.fillStyle = '#b89cff'
      g.fillText(sub.toUpperCase().split('').join(' '), 512, 200)
    }
    tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    labelCache.set(key, tex)
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  )
  return m
}

let ashTex: THREE.Texture | null = null
function ashlar() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#060606'
  g.fillRect(0, 0, 512, 512)
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const rh = 64
  for (let r = 0; r < 8; r++) {
    let x = -rnd() * 96
    while (x < 512) {
      const w = 80 + rnd() * 120
      const v = 150 + rnd() * 80
      g.fillStyle = `rgb(${v | 0},${(v - 6) | 0},${(v + 14) | 0})`
      g.fillRect(x + 2, r * rh + 2, w - 4, rh - 4)
      for (let k = 0; k < 70; k++) {
        const s = v + rnd() * 50 - 25
        g.fillStyle = `rgba(${s | 0},${s | 0},${(s + 10) | 0},0.55)`
        g.fillRect(x + 3 + rnd() * (w - 8), r * rh + 3 + rnd() * (rh - 8), 2, 2)
      }
      x += w
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** World-space triplanar ashlar masonry with breathing lavender seams, rim light and base uplight. */
export function patchStone(mat: THREE.MeshStandardMaterial, scale = 0.25, seam = 0.22, rim = 0.12) {
  ashTex ??= ashlar()
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uAsh: { value: ashTex }, uAshScale: { value: scale }, uSeam: { value: seam }, uRim: { value: rim }, uTime: shared.time, uEnergy: shared.energy, uLav: shared.lavender })
    sh.vertexShader =
      'varying vec3 vCmW;\nvarying vec3 vCmN;\n' +
      sh.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cmW = vec4(transformed, 1.0);
        vec3 cmN = objectNormal;
        #ifdef USE_INSTANCING
          cmW = instanceMatrix * cmW;
          cmN = mat3(instanceMatrix) * cmN;
        #endif
        vCmW = (modelMatrix * cmW).xyz;
        vCmN = normalize(mat3(modelMatrix) * cmN);`,
      )
    sh.fragmentShader =
      'uniform sampler2D uAsh;\nuniform float uAshScale;\nuniform float uSeam;\nuniform float uRim;\nuniform float uTime;\nuniform float uEnergy;\nuniform vec3 uLav;\nvarying vec3 vCmW;\nvarying vec3 vCmN;\n' +
      sh.fragmentShader
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec3 cmB = pow(abs(vCmN), vec3(4.0));
          cmB /= (cmB.x + cmB.y + cmB.z + 1e-4);
          vec3 cmT = texture2D(uAsh, vCmW.zy * uAshScale).rgb * cmB.x + texture2D(uAsh, vCmW.xz * uAshScale + vec2(0.37, 0.11)).rgb * cmB.y + texture2D(uAsh, vCmW.xy * uAshScale).rgb * cmB.z;
          float cmSeam = smoothstep(0.1, 0.015, cmT.r);
          diffuseColor.rgb *= mix(cmT * 2.3, vec3(0.35), cmSeam);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float cmPulse = 0.65 + 0.35 * sin(uTime * 0.7 + vCmW.y * 0.35 + vCmW.x * 0.05);
          totalEmissiveRadiance += uLav * uSeam * cmSeam * cmPulse * (1.0 + uEnergy * 2.5);
          float cmRim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
          totalEmissiveRadiance += uLav * (uRim * cmRim + 0.05 * smoothstep(5.0, 0.0, vCmW.y));`,
        )
  }
  mat.customProgramCacheKey = () => 'ashlar' + scale + seam
  mat.needsUpdate = true
}

patchStone(M.stone)
patchStone(M.stoneLight, 0.3, 0.16)
