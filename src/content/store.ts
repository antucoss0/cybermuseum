import { Emitter } from '../core/util'
import { defaultContent, withEnglish } from './defaults'
import type { Content } from './types'

const KEY = 'cm.content.v1'

function load(): Content {
  const base = defaultContent()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<Content>
    return withEnglish({
      ...base,
      ...saved,
      rooms: Object.fromEntries(Object.entries(base.rooms).map(([k, r]) => [k, { ...r, ...((saved.rooms as any)?.[k] ?? {}) }])) as Content['rooms'],
      temp: { ...base.temp, ...(saved.temp ?? {}) },
      settings: { ...base.settings, ...(saved.settings ?? {}), adminHash: base.settings.adminHash },
    } as Content)
  } catch {
    return base
  }
}

class ContentStore {
  data: Content = load()
  changed = new Emitter<Content>()

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data))
    } catch (e) {
      console.warn('No se pudo guardar el contenido', e)
    }
    this.changed.emit(this.data)
  }

  update(fn: (c: Content) => void) {
    fn(this.data)
    this.save()
  }

  replace(c: Content) {
    this.data = c
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
