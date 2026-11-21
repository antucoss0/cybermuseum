import * as THREE from 'three'
import { detectQuality, type Quality } from '../core/util'

export type PbrOptions = {
  repeat?: [number, number]
  color?: THREE.ColorRepresentation
  roughness?: number
  metalness?: number
  normalScale?: number
  physical?: boolean
}

const loader = new THREE.TextureLoader()
const textures = new Map<string, THREE.Texture>()
const materials: { material: THREE.MeshStandardMaterial; normal: THREE.Texture | null; rough: THREE.Texture | null }[] = []
let quality: Quality = detectQuality()
let maxAnisotropy = 1

function texture(slug: string, channel: 'diff' | 'nor' | 'rough', repeat: [number, number]) {
  const key = `${slug}/${channel}/${repeat[0]}x${repeat[1]}`
  let map = textures.get(key)
  if (!map) {
    map = loader.load(import.meta.env.BASE_URL + `tex/${slug}/${channel}.jpg`)
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.repeat.set(...repeat)
    map.colorSpace = channel === 'diff' ? THREE.SRGBColorSpace : THREE.NoColorSpace
    map.anisotropy = maxAnisotropy
    textures.set(key, map)
  }
  return map
}

export function pbr(slug: string, opts: PbrOptions = {}): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const repeat = opts.repeat ?? [1, 1]
  const mapped = slug !== 'procedural'
  const map = mapped ? texture(slug, 'diff', repeat) : null
  const normal = mapped && quality !== 'low' ? texture(slug, 'nor', repeat) : null
  const rough = mapped && quality !== 'low' ? texture(slug, 'rough', repeat) : null
  const parameters: THREE.MeshStandardMaterialParameters = {
    color: opts.color ?? '#ffffff',
    roughness: opts.roughness ?? 0.65,
    metalness: opts.metalness ?? 0,
    map,
    normalMap: normal,
    roughnessMap: rough,
    normalScale: new THREE.Vector2(opts.normalScale ?? 0.5, opts.normalScale ?? 0.5),
  }
  const material = opts.physical ? new THREE.MeshPhysicalMaterial(parameters) : new THREE.MeshStandardMaterial(parameters)
  materials.push({ material, normal, rough })
  return material
}

export function getPbrTexture(slug: string, channel: 'diff' | 'nor' | 'rough' = 'diff') {
  return texture(slug, channel, [1, 1])
}

export function configurePbr(renderer: THREE.WebGLRenderer, nextQuality: Quality) {
  quality = nextQuality
  maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
  for (const map of textures.values()) {
    map.anisotropy = maxAnisotropy
    if (map.image) map.needsUpdate = true
  }
  for (const { material, normal, rough } of materials) {
    material.normalMap = quality === 'low' ? null : normal
    material.roughnessMap = quality === 'low' ? null : rough
    material.needsUpdate = true
  }
}

const marbleFloor = pbr('grey_cartago_01', { color: '#d5d5de', roughness: 0.27, physical: true })
if (marbleFloor instanceof THREE.MeshPhysicalMaterial) {
  marbleFloor.clearcoat = 0.24
  marbleFloor.clearcoatRoughness = 0.24
}

const gold = pbr('procedural', { color: '#c9a86a', roughness: 0.28, metalness: 1, physical: true })
gold.emissive.set('#241b0d')
gold.emissiveIntensity = 0.18

export const P = {
  marbleFloor,
  marbleBlack: pbr('marble_rock_03', { repeat: [1.5, 1.5], color: '#5a5361', roughness: 0.34, normalScale: 0.3, physical: true }),
  stoneWall: pbr('stone_brick_wall_001', { repeat: [1.4, 1.4], color: '#514a60', roughness: 0.82, normalScale: 0.75 }),
  stoneCarved: pbr('white_sandstone_blocks_02', { repeat: [1.2, 1.2], color: '#b0aabd', roughness: 0.78, normalScale: 0.55 }),
  gold,
  velvet: pbr('velour_velvet', { repeat: [1.5, 1.5], color: '#7a536f', roughness: 0.88, normalScale: 0.28, physical: true }),
  wood: pbr('dark_wood', { repeat: [1.5, 1.5], color: '#88705d', roughness: 0.48 }),
}

// Box and plane UVs span 0..1; tune repeat to the size of each surface.
