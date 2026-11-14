import * as THREE from 'three'

export const shared = {
  time: { value: 0 },
  energy: { value: 0 },
  ripples: { value: [new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0), new THREE.Vector4(0, 0, -100, 0)] },
  lavender: { value: new THREE.Color('#b89cff') },
}

export const M = {
  stone: new THREE.MeshStandardMaterial({ color: '#16131f', roughness: 0.55, metalness: 0.35 }),
  stoneLight: new THREE.MeshStandardMaterial({ color: '#2a2440', roughness: 0.45, metalness: 0.4 }),
  obsidian: new THREE.MeshStandardMaterial({ color: '#0b0a12', roughness: 0.18, metalness: 0.75 }),
  marble: new THREE.MeshStandardMaterial({ color: '#cfc9e6', roughness: 0.3, metalness: 0.1 }),
  neon: new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9b3ff').multiplyScalar(2.4), toneMapped: false }),
  neonSoft: new THREE.MeshBasicMaterial({ color: new THREE.Color('#9b7bff').multiplyScalar(1.6), toneMapped: false }),
  neonWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.2), toneMapped: false }),
  glass: new THREE.MeshBasicMaterial({ color: '#8a7cff', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
  black: new THREE.MeshBasicMaterial({ color: '#000000' }),
}

/** Checkerboard marble floor with animated lavender light waves driven by payments. */
export function floorMaterial(tile = 2, glowFrom = new THREE.Vector2(0, 0)) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.time,
      uEnergy: shared.energy,
      uRipples: shared.ripples,
      uTile: { value: tile },
      uCenter: { value: glowFrom },
      uLav: shared.lavender,
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      uniform float uTime; uniform float uEnergy; uniform float uTile; uniform vec2 uCenter; uniform vec3 uLav;
      uniform vec4 uRipples[4];
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
      void main(){
        vec2 p = vW.xz / uTile;
        vec2 c = floor(p);
        float chk = mod(c.x + c.y, 2.0);
        vec2 f = fract(p);
        float vein = smoothstep(0.62, 0.0, abs(vnoise(vW.xz*0.9)*2.0-1.0 + vnoise(vW.xz*3.1)*0.3 - 0.15));
        vec3 white = vec3(0.62,0.6,0.7) - vein*0.12;
        vec3 black = vec3(0.012,0.01,0.02) + vein*0.03;
        vec3 col = mix(black, white, chk);
        float grout = 1.0 - smoothstep(0.0, 0.025, min(min(f.x,1.0-f.x), min(f.y,1.0-f.y)));
        col = mix(col, vec3(0.05,0.04,0.09), grout*0.8);
        float d = length(vW.xz - uCenter);
        // fake reflection of the lights above
        float refl = exp(-d*0.09) * (0.35 + uEnergy*1.2);
        col += uLav * refl * mix(0.9, 0.25, chk);
        // concentric pattern waves
        float wave = sin(d*1.4 - uTime*1.6) * 0.5 + 0.5;
        col += uLav * pow(wave, 12.0) * (0.05 + uEnergy*0.6) * exp(-d*0.04) * (1.0-chk*0.5);
        for (int i=0;i<4;i++){
          vec4 r = uRipples[i];
          float age = uTime - r.z;
          if (age < 0.0 || age > 6.0) continue;
          float rd = length(vW.xz - r.xy);
          float ring = exp(-pow((rd - age*9.0)*0.8, 2.0));
          col += mix(uLav, vec3(1.0), 0.3) * ring * (1.0 - age/6.0) * 1.6 * r.w;
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
