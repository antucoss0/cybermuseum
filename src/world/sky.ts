import * as THREE from 'three'

export const PALETTES = {
  lavanda: { a: new THREE.Color('#2b1a6b'), b: new THREE.Color('#0b1a5c'), c: new THREE.Color('#b89cff') },
  aurora: { a: new THREE.Color('#0f4a6b'), b: new THREE.Color('#2b1a6b'), c: new THREE.Color('#7cf2e4') },
  abismo: { a: new THREE.Color('#0a0f3a'), b: new THREE.Color('#05061a'), c: new THREE.Color('#7fb2ff') },
  solar: { a: new THREE.Color('#5a1a5c'), b: new THREE.Color('#2a0f3a'), c: new THREE.Color('#ffb3e6') },
}

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform float uEnergy;
uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
float stars(vec3 d, float scale, float thr){
  vec3 p = d*scale; vec3 i = floor(p); vec3 f = fract(p)-0.5;
  float h = hash(i);
  if (h < thr) return 0.0;
  vec3 o = vec3(hash(i+3.1), hash(i+7.7), hash(i+1.3))-0.5;
  float dist = length(f - o*0.7);
  float tw = 0.65 + 0.35*sin(uTime*(1.0+h*3.0) + h*40.0);
  return smoothstep(0.09, 0.0, dist) * tw * (h-thr)/(1.0-thr);
}
vec3 galaxy(vec3 d, vec3 center, vec3 up, float size, vec3 col, float rot){
  float c = dot(d, center);
  if (c < 0.6) return vec3(0);
  vec3 x = normalize(cross(up, center)); vec3 y = cross(center, x);
  vec2 q = vec2(dot(d,x), dot(d,y)) / size;
  q.y *= 2.1; // tilt
  float r = length(q); float a = atan(q.y, q.x);
  float arms = sin(a*2.0 - log(r+0.001)*4.5 + rot) * 0.5 + 0.5;
  float disc = exp(-r*3.2);
  float core = exp(-r*18.0);
  float g = disc * pow(arms, 2.0) * 1.4 + core * 2.5;
  return col * g;
}
void main(){
  vec3 d = normalize(vDir);
  float n = fbm(d*2.2 + vec3(0.0, uTime*0.004, 0.0));
  float n2 = fbm(d*4.5 + vec3(5.2, 1.3, uTime*0.006));
  float band = exp(-pow(d.y*2.4 + sin(d.x*2.0)*0.35, 2.0));
  vec3 col = vec3(0.004, 0.004, 0.012);
  col += uA * pow(n, 2.6) * 1.6 * (0.45 + band);
  col += uB * pow(n2, 3.0) * 1.8;
  col += uC * pow(max(n*n2*2.0-0.25, 0.0), 2.0) * (1.2 + uEnergy*1.5) * band;
  col += vec3(0.9,0.88,1.0) * stars(d, 220.0, 0.92);
  col += vec3(0.8,0.85,1.0) * stars(d, 520.0, 0.95) * 0.7;
  col += vec3(1.0) * stars(d, 90.0, 0.985) * 1.6;
  col += galaxy(d, normalize(vec3(0.55, 0.32, -0.77)), vec3(0,1,0), 0.22, vec3(0.75,0.62,1.0), uTime*0.02);
  col += galaxy(d, normalize(vec3(-0.8, 0.15, 0.45)), vec3(0.2,1,0), 0.14, vec3(0.55,0.7,1.0), -uTime*0.015);
  col += galaxy(d, normalize(vec3(0.1, 0.85, 0.35)), vec3(1,0,0), 0.18, vec3(0.9,0.7,1.0), uTime*0.01);
  col += galaxy(d, normalize(vec3(-0.3, -0.25, -0.9)), vec3(0,1,0.3), 0.1, vec3(1.0,0.8,0.95), uTime*0.03);
  gl_FragColor = vec4(col, 1.0);
}`

export function createSky() {
  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uA: { value: PALETTES.lavanda.a.clone() },
    uB: { value: PALETTES.lavanda.b.clone() },
    uC: { value: PALETTES.lavanda.c.clone() },
  }
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, side: THREE.BackSide, depthWrite: false })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  return {
    mesh,
    uniforms,
    setPalette(name: keyof typeof PALETTES) {
      const p = PALETTES[name] ?? PALETTES.lavanda
      uniforms.uA.value.copy(p.a)
      uniforms.uB.value.copy(p.b)
      uniforms.uC.value.copy(p.c)
    },
  }
}
