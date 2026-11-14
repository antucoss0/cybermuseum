export type RoomId =
  | 'lobby'
  | 'videosala'
  | 'escultura'
  | 'pintura'
  | 'tienda'
  | 'jardin'
  | 'temporales'
  | 'videojuegos'
  | 'futuro'

export interface RoomInfo {
  id: RoomId
  name: string
  subtitle: string
  description: string
  open: boolean
}

export type MediaKind = 'generative' | 'image' | 'video' | 'model'

export interface Artwork {
  id: string
  room: RoomId
  title: string
  author: string
  year: string
  description: string
  tags: string[]
  kind: MediaKind
  media?: string
  gen?: string
  seed?: number
}

export type ProductCategory = 'stickers' | 'ropa' | 'prints' | 'objetos'
export interface Product {
  id: string
  name: string
  category: ProductCategory
  price: number
  description: string
  media?: string
  gen?: string
  seed?: number
}

export interface Film {
  id: string
  title: string
  author: string
  duration: number
  media?: string
  gen?: string
}

export interface GameDoor {
  id: string
  title: string
  description: string
  kind: 'internal' | 'url'
  target: string
  open: boolean
}

export type EventKind = 'exposicion' | 'lanzamiento' | 'curaduria' | 'convocatoria' | 'concurso'
export interface EventItem {
  id: string
  title: string
  date: string
  kind: EventKind
  description: string
}

export interface Submission {
  id: string
  name: string
  email: string
  title: string
  link: string
  message: string
  at: number
}

export interface TempExpo {
  title: string
  curator: string
  statement: string
  callOpen: boolean
  callTitle: string
  callDeadline: string
}

export type Palette = 'lavanda' | 'aurora' | 'abismo' | 'solar'

export interface Settings {
  seed: number
  palette: Palette
  futureName: string
  futureOpen: boolean
  futureKind: 'mirador' | 'santuario' | 'archivo'
  multiplayer: boolean
  roomName: string
  adminHash: string
  peyBackend: string
}

export interface Content {
  version: number
  rooms: Record<RoomId, RoomInfo>
  artworks: Artwork[]
  products: Product[]
  films: Film[]
  games: GameDoor[]
  events: EventItem[]
  submissions: Submission[]
  temp: TempExpo
  settings: Settings
}
