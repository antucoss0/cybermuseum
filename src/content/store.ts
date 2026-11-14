import { Emitter } from '../core/util'
import { defaultContent } from './defaults'
import type { Content } from './types'

const KEY = 'cm.content.v1'

function load(): Content {
  const base = defaultContent()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<Content>
    return {
      ...base,
      ...saved,
      rooms: { ...base.rooms, ...(saved.rooms ?? {}) },
      temp: { ...base.temp, ...(saved.temp ?? {}) },
      settings: { ...base.settings, ...(saved.settings ?? {}) },
    }
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
