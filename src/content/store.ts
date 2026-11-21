import { Emitter } from '../core/util'
import { defaultContent, withEnglish } from './defaults'
import type { Content } from './types'

const KEY = 'cm.content.v2'

function merge(saved: Partial<Content> | null): Content {
  const base = defaultContent()
  if (!saved) return base
  return withEnglish({
    ...base,
    ...saved,
    rooms: Object.fromEntries(Object.entries(base.rooms).map(([k, r]) => [k, { ...r, ...((saved.rooms as any)?.[k] ?? {}) }])) as Content['rooms'],
    temp: { ...base.temp, ...(saved.temp ?? {}) },
    about: { ...base.about, ...(saved.about ?? {}) },
    halls: saved.halls ?? base.halls,
    calls: saved.calls ?? base.calls,
    forum: saved.forum ?? base.forum,
    meetings: saved.meetings ?? base.meetings,
    settings: { ...base.settings, ...(saved.settings ?? {}), adminHash: base.settings.adminHash },
  } as Content)
}

function load(): Content {
  try {
    return merge(JSON.parse(localStorage.getItem(KEY) || 'null'))
  } catch {
    return defaultContent()
  }
}

/**
 * Museum content. Public source of truth is /api/content (Vercel Blob); localStorage is a cache and
 * offline fallback. Saves are pushed to the server when the SuperAdmin PIN is in the session.
 */
class ContentStore {
  data: Content = load()
  changed = new Emitter<Content>()
  remote: 'unknown' | 'on' | 'off' = 'unknown'
  lastSync: 'idle' | 'saving' | 'saved' | 'error' = 'idle'
  synced = new Emitter<string>()
  private pushTimer = 0

  async pull() {
    try {
      const r = await fetch('./api/content', { cache: 'no-store' })
      this.remote = r.status === 503 ? 'off' : 'on'
      if (!r.ok) return false
      const j = await r.json()
      this.data = merge(j.content)
      this.cache()
      this.changed.emit(this.data)
      return true
    } catch {
      this.remote = 'off'
      return false
    }
  }

  private cache() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data))
    } catch (e) {
      console.warn('No se pudo guardar el contenido', e)
    }
  }

  push() {
    const pin = sessionStorage.getItem('cm.adminPin')
    if (!pin || this.remote === 'off') return
    clearTimeout(this.pushTimer)
    this.pushTimer = window.setTimeout(async () => {
      this.lastSync = 'saving'
      this.synced.emit(this.lastSync)
      try {
        const r = await fetch('./api/content', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin }, body: JSON.stringify(this.data) })
        this.lastSync = r.ok ? 'saved' : 'error'
      } catch {
        this.lastSync = 'error'
      }
      this.synced.emit(this.lastSync)
    }, 600)
  }

  save() {
    this.cache()
    this.push()
    this.changed.emit(this.data)
  }

  update(fn: (c: Content) => void) {
    fn(this.data)
    this.save()
  }

  replace(c: Content) {
    this.data = merge(c)
    this.save()
  }

  reset() {
    this.data = defaultContent()
    this.save()
  }

  export(): string {
    return JSON.stringify(this.data, null, 2)
  }
}

export const content = new ContentStore()
