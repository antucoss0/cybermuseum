// Uploaded media lives in IndexedDB; content references it as "idb:<id>".
const DB = 'cybermuseo-media'
const STORE = 'files'
let dbp: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1)
      r.onupgradeneeded = () => r.result.createObjectStore(STORE)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  return dbp
}

export async function putMedia(file: Blob): Promise<string> {
  const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  const d = await db()
  await new Promise<void>((res, rej) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(file, id)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  return 'idb:' + id
}

async function getBlob(id: string): Promise<Blob | null> {
  const d = await db()
  return new Promise((res) => {
    const r = d.transaction(STORE).objectStore(STORE).get(id)
    r.onsuccess = () => res((r.result as Blob) ?? null)
    r.onerror = () => res(null)
  })
}

const urlCache = new Map<string, Promise<string | null>>()

export function resolveMedia(ref: string | undefined | null): Promise<string | null> {
  if (!ref) return Promise.resolve(null)
  if (!ref.startsWith('idb:')) return Promise.resolve(ref)
  let p = urlCache.get(ref)
  if (!p) {
    p = getBlob(ref.slice(4)).then((b) => (b ? URL.createObjectURL(b) : null))
    urlCache.set(ref, p)
  }
  return p
}

/** Uploads to shared Vercel Blob storage when available (visible to every visitor); IndexedDB otherwise. */
export async function uploadMedia(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const pin = sessionStorage.getItem('cm.adminPin')
  if (pin) {
    try {
      const { upload } = await import('@vercel/blob/client')
      const safe = file.name.replace(/[^\w.\-]+/g, '_')
      const b = await upload(`media/${safe}`, file, { access: 'public', handleUploadUrl: './api/upload', clientPayload: JSON.stringify({ pin }), onUploadProgress: (e) => onProgress?.(e.percentage) })
      return b.url
    } catch (e) {
      console.warn('Blob upload failed, falling back to local storage', e)
    }
  }
  return putMedia(file)
}

export function assetKind(name: string, type = ''): 'image' | 'video' | 'gif' | 'model' | 'audio' | 'link' {
  const n = name.toLowerCase()
  if (/\.gif($|\?)/.test(n) || type === 'image/gif') return 'gif'
  if (/\.(glb|gltf|fbx|obj|ply|usdz)($|\?)/.test(n)) return 'model'
  if (type.startsWith('video') || /\.(mp4|webm|mov|m4v)($|\?)/.test(n)) return 'video'
  if (type.startsWith('audio') || /\.(mp3|wav|ogg)($|\?)/.test(n)) return 'audio'
  if (type.startsWith('image') || /\.(png|jpe?g|webp|avif|svg)($|\?)/.test(n)) return 'image'
  return 'link'
}
