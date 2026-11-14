export type Lang = 'es' | 'en'

const saved = localStorage.getItem('cm.lang')
const fromUrl = new URLSearchParams(location.search).get('lang')
export const lang: Lang =
  fromUrl === 'en' || fromUrl === 'es' ? fromUrl : saved === 'en' || saved === 'es' ? saved : (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en'
document.documentElement.lang = lang

/** Inline bilingual string: L('Hola', 'Hello'). */
export const L = (es: string, en: string) => (lang === 'en' ? en : es)

/** Bilingual content field: uses item.en[field] when browsing in English and it exists. */
export function tx(o: object, k: string): string {
  const en = (o as { en?: Record<string, unknown> }).en
  const v = lang === 'en' && en?.[k] ? en[k] : (o as Record<string, unknown>)[k]
  return Array.isArray(v) ? v.join(', ') : String(v ?? '')
}
export function txList(o: object, k: string): string[] {
  const en = (o as { en?: Record<string, unknown> }).en
  const v = lang === 'en' && Array.isArray(en?.[k]) && (en![k] as unknown[]).length ? en![k] : (o as Record<string, unknown>)[k]
  return Array.isArray(v) ? v.map(String) : []
}

export function setLang(l: Lang, keep: Record<string, string> = {}) {
  localStorage.setItem('cm.lang', l)
  const u = new URL(location.href)
  u.searchParams.delete('lang')
  for (const [k, v] of Object.entries(keep)) u.searchParams.set(k, v)
  location.href = u.toString()
}

export const langButton = (cls = 'btn sm glass') => `<button class="${cls} lang" data-lang title="${L('Change language', 'Cambiar idioma')}">${lang === 'es' ? 'EN' : 'ES'}</button>`

export function bindLang(root: ParentNode, keep: () => Record<string, string> = () => ({})) {
  root.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => (b.onclick = () => setLang(lang === 'es' ? 'en' : 'es', keep())))
}
