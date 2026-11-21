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
  | 'salas'
  | 'foro'
  | 'juntas'

export interface RoomInfo {
  en?: Record<string, any>
  id: RoomId
  name: string
  subtitle: string
  description: string
  open: boolean
}

export type MediaKind = 'generative' | 'image' | 'video' | 'model'

export interface Artwork {
  en?: Record<string, any>
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
  en?: Record<string, any>
  id: string
  name: string
  category: ProductCategory
  price: number
  description: string
  media?: string
  gen?: string
  seed?: number
  model?: string
  link?: string
  pod?: string
  visible?: boolean
}

export interface Film {
  en?: Record<string, any>
  id: string
  title: string
  author: string
  duration: number
  media?: string
  gen?: string
  category?: string
  synopsis?: string
  poster?: string
  year?: string
  schedule?: string
  ad?: boolean
  visible?: boolean
}

export interface GameDoor {
  en?: Record<string, any>
  id: string
  title: string
  description: string
  kind: 'internal' | 'url'
  target: string
  open: boolean
}

export type EventKind = 'exposicion' | 'lanzamiento' | 'curaduria' | 'convocatoria' | 'concurso'
export interface EventItem {
  en?: Record<string, any>
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
  status?: 'pendiente' | 'aprobada' | 'rechazada'
  note?: string
  callId?: string
}

export type AssetKind = 'image' | 'video' | 'gif' | 'model' | 'audio' | 'link'
export interface Asset {
  kind: AssetKind
  url: string
  name?: string
}

export interface Piece {
  en?: Record<string, any>
  id: string
  title: string
  author: string
  year: string
  lore: string
  links: string
  assets: Asset[]
  gen?: string
  seed?: number
  visible: boolean
  donation: boolean
  productId?: string
}

export type HallKind = 'temporal' | '2d' | '3d' | 'games'
export interface Hall {
  en?: Record<string, any>
  id: string
  kind: HallKind
  name: string
  theme: string
  curatorial: string
  color: string
  visible: boolean
  start?: string
  end?: string
  external?: string
  cover?: string
  pieces: Piece[]
}

export interface OpenCall {
  en?: Record<string, any>
  id: string
  title: string
  description: string
  terms: string
  deadline: string
  open: boolean
}

export interface ForumEvent {
  en?: Record<string, any>
  id: string
  title: string
  date: string
  time: string
  kind: 'concierto' | 'dj' | 'fiesta' | 'charla' | 'performance'
  description: string
  assets: Asset[]
  visible: boolean
}

export interface Meeting {
  id: string
  name: string
  code: string
  allowed: string
  active: boolean
}

export interface About {
  en?: Record<string, any>
  title: string
  body: string
  mission: string
  credits: string
}

export interface TempExpo {
  en?: Record<string, any>
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
  stripeCurrency: string
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
  halls: Hall[]
  calls: OpenCall[]
  forum: ForumEvent[]
  meetings: Meeting[]
  about: About
  settings: Settings
}
