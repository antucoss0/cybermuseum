import type { Content, RoomId, RoomInfo } from './types'

const room = (id: RoomId, name: string, subtitle: string, description: string, open = true): RoomInfo => ({
  id,
  name,
  subtitle,
  description,
  open,
})

// SHA-256 of "cybermuseo" (demo passcode, change it in the admin).
export const DEFAULT_ADMIN_HASH = 'a6a4f95a58a417041cdcd101febc11e8c71cae1e06f23c8c7c3a20522f066bac'

export function defaultContent(): Content {
  return {
    version: 1,
    rooms: {
      lobby: room('lobby', 'Lobby · La Bóveda', 'Cúpula reactiva', 'En el centro de la bóveda flota la Nube Gaussiana: cada pago CoDi la enciende, sobrecarga su tensión y cambia la luz del edificio.'),
      videosala: room('videosala', 'Videosala', 'Cine virtual', 'Proyecciones constantes de cortos, videoclips y video arte transmedia.'),
      escultura: room('escultura', 'Sala Escultura 3D', 'Modelos vivos', 'Esculturas 3D animadas y funcionales en tiempo real sobre pedestales de obsidiana.'),
      pintura: room('pintura', 'Sala Pintura 2D', 'Imagen fija', 'Un museo tradicional: piezas 2D e imagen fija para contemplar sin prisa.'),
      tienda: room('tienda', 'Tienda', 'Merch del universo', 'Stickers, ropa, prints y objetos de recuerdo. Cada compra hace crecer el jardín.'),
      jardin: room('jardin', 'Jardín Digital', 'Exterior surreal', 'El exterior del edificio: una planta única nace con cada pago, flotando en medio de la galaxia.'),
      temporales: room('temporales', 'Exposiciones Temporales', 'Convocatoria abierta', 'Un espacio internacional para curadores y artistas transmedia: convocatorias, dinámicas y concursos.'),
      videojuegos: room('videojuegos', 'Videojuegos e Interactividad', 'Pasillo de portales', 'Un pasillo de puertas hacia videojuegos y salas inmersivas donde te vuelves coautor de la experiencia.'),
      futuro: room('futuro', 'Espacio Futuro', 'En construcción', 'Un ala que el SuperAdmin puede construir y abrir con la semilla procedural.', false),
    },
    temp: {
      title: 'Ethereal Echoes of My Mind',
      curator: 'Antu Coss',
      statement: 'Una exploración visual de la memoria, el deseo y la identidad en un universo digital.',
      callOpen: true,
      callTitle: 'Convocatoria Internacional 2026 · Obras transmedia',
      callDeadline: '2026-12-12',
    },
    artworks: [
      // pintura 2D
      { id: 'p1', room: 'pintura', title: 'Nebulosa de la Memoria', author: 'Antu Coss', year: '2025', description: 'Fragmentos de lo que fuimos, resonancias de lo que seremos.', tags: ['Arte digital', 'Cosmos'], kind: 'generative', gen: 'nebula', seed: 11 },
      { id: 'p2', room: 'pintura', title: 'Rosetón de Obsidiana', author: 'Lía Sombra', year: '2026', description: 'La geometría gótica reescrita como un algoritmo de luz.', tags: ['Gótico', 'Geometría'], kind: 'generative', gen: 'rose', seed: 23 },
      { id: 'p3', room: 'pintura', title: 'Flor de Vidrio Lunar', author: 'Mara Lux', year: '2025', description: 'Una flor que sólo florece cuando nadie la mira.', tags: ['Botánica', 'Vidrio'], kind: 'generative', gen: 'flower', seed: 37 },
      { id: 'p4', room: 'pintura', title: 'Portal Lavanda', author: 'Antu Coss', year: '2026', description: 'Un arco abierto hacia el espacio entre dos latidos.', tags: ['Portal', 'Neón'], kind: 'generative', gen: 'portal', seed: 41 },
      { id: 'p5', room: 'pintura', title: 'Marea Galáctica', author: 'Iker Vale', year: '2024', description: 'Ondas de un océano que existe sólo en la órbita.', tags: ['Líquido', 'Galaxia'], kind: 'generative', gen: 'tide', seed: 53 },
      { id: 'p6', room: 'pintura', title: 'Eclipse Efímero', author: 'Noa Kairos', year: '2026', description: 'Ser pequeño y efímero frente al universo es también ser uno con él.', tags: ['Eclipse', 'Efímero'], kind: 'generative', gen: 'eclipse', seed: 67 },
      { id: 'p7', room: 'pintura', title: 'Glifos del Coro', author: 'Lía Sombra', year: '2025', description: 'Partituras de un coro de estrellas transcritas en símbolos.', tags: ['Glifo', 'Sonido'], kind: 'generative', gen: 'glyph', seed: 71 },
      { id: 'p8', room: 'pintura', title: 'Catedral Interior', author: 'Mara Lux', year: '2026', description: 'La arquitectura de una plegaria que nunca se dijo.', tags: ['Arquitectura', 'Gótico'], kind: 'generative', gen: 'choir', seed: 89 },
      // escultura 3D
      { id: 's1', room: 'escultura', title: 'Corazón Líquido', author: 'Antu Coss', year: '2026', description: 'Una masa de cromo líquido que respira con el pulso del museo.', tags: ['3D', 'Tiempo real'], kind: 'generative', gen: 'liquid', seed: 5 },
      { id: 's2', room: 'escultura', title: 'Nudo de Eternidad', author: 'Iker Vale', year: '2025', description: 'Un camino sin principio ni fin, plegado sobre sí mismo.', tags: ['3D', 'Topología'], kind: 'generative', gen: 'knot', seed: 6 },
      { id: 's3', room: 'escultura', title: 'Celosía Astral', author: 'Noa Kairos', year: '2026', description: 'Retícula de luz que reorganiza su forma cada minuto.', tags: ['3D', 'Generativo'], kind: 'generative', gen: 'lattice', seed: 7 },
      { id: 's4', room: 'escultura', title: 'Busto de la Memoria', author: 'Mara Lux', year: '2025', description: 'Un rostro clásico deshecho en partículas, con un halo orbital.', tags: ['3D', 'Neoclásico'], kind: 'generative', gen: 'bust', seed: 8 },
      { id: 's5', room: 'escultura', title: 'Cinta de Órbitas', author: 'Lía Sombra', year: '2026', description: 'Trayectorias de lunas invisibles, solidificadas en una cinta.', tags: ['3D', 'Órbitas'], kind: 'generative', gen: 'ribbon', seed: 9 },
      { id: 's6', room: 'escultura', title: 'Ángel de Neón', author: 'Antu Coss', year: '2026', description: 'Guardián alado de la bóveda, cosido con filamentos de luz.', tags: ['3D', 'Gótico'], kind: 'generative', gen: 'angel', seed: 10 },
      // temporales
      { id: 't1', room: 'temporales', title: 'Ethereal Echoes I', author: 'Antu Coss', year: '2025', description: 'Una exploración visual de la memoria, el deseo y la identidad en un universo digital.', tags: ['3D', 'IA', 'Arte digital', 'Memoria'], kind: 'generative', gen: 'flower', seed: 101 },
      { id: 't2', room: 'temporales', title: 'Ethereal Echoes II', author: 'Antu Coss', year: '2025', description: 'Lo que recordamos cambia cada vez que lo recordamos.', tags: ['Memoria', 'Transmedia'], kind: 'generative', gen: 'nebula', seed: 102 },
      { id: 't3', room: 'temporales', title: 'Sala Sueños', author: 'Kai Noct', year: '2026', description: 'Imágenes recogidas en la frontera entre el sueño y la vigilia.', tags: ['Sueño', 'Imagen fija'], kind: 'generative', gen: 'portal', seed: 103 },
      { id: 't4', room: 'temporales', title: 'Sala Cosmos', author: 'Vera Ion', year: '2026', description: 'El universo como una catedral sin muros.', tags: ['Cosmos', 'Arquitectura'], kind: 'generative', gen: 'choir', seed: 104 },
      { id: 't5', room: 'temporales', title: 'Resonancia', author: 'Kai Noct', year: '2026', description: 'Frecuencias de la memoria convertidas en color.', tags: ['Sonido', 'Color'], kind: 'generative', gen: 'tide', seed: 105 },
      { id: 't6', room: 'temporales', title: 'Ofrenda Binaria', author: 'Vera Ion', year: '2026', description: 'Una ofrenda para los archivos que ya no existen.', tags: ['Archivo', 'Ritual'], kind: 'generative', gen: 'glyph', seed: 106 },
    ],
    films: [
      { id: 'f1', title: 'Nacimiento de una Nebulosa', author: 'Cybermuseo Studio', duration: 40, gen: 'nebula' },
      { id: 'f2', title: 'Catedral Líquida', author: 'Antu Coss', duration: 40, gen: 'cathedral' },
      { id: 'f3', title: 'Pulso · Videoclip', author: 'Noa Kairos', duration: 35, gen: 'pulse' },
      { id: 'f4', title: 'Floración', author: 'Mara Lux', duration: 35, gen: 'bloom' },
    ],
    products: [
      { id: 'pr1', name: 'Sticker Pack Constelación', category: 'stickers', price: 60, description: '6 stickers holográficos de las salas.', gen: 'glyph', seed: 201 },
      { id: 'pr2', name: 'Sticker Estrella ✦', category: 'stickers', price: 25, description: 'Sticker de vinil con la estrella del museo.', gen: 'portal', seed: 202 },
      { id: 'pr3', name: 'Playera Bóveda', category: 'ropa', price: 420, description: 'Algodón negro obsidiana, estampado lavanda neón.', gen: 'rose', seed: 203 },
      { id: 'pr4', name: 'Hoodie Galaxia', category: 'ropa', price: 890, description: 'Hoodie oversize con la Nube Gaussiana bordada.', gen: 'nebula', seed: 204 },
      { id: 'pr5', name: 'Print "Eclipse Efímero"', category: 'prints', price: 350, description: 'Giclée 30×40 cm, papel algodón.', gen: 'eclipse', seed: 205 },
      { id: 'pr6', name: 'Print "Flor de Vidrio"', category: 'prints', price: 350, description: 'Giclée 30×40 cm, papel algodón.', gen: 'flower', seed: 206 },
      { id: 'pr7', name: 'Taza Obsidiana', category: 'objetos', price: 240, description: 'Cerámica negra mate con estrella lavanda.', gen: 'tide', seed: 207 },
      { id: 'pr8', name: 'Vela Catedral', category: 'objetos', price: 180, description: 'Vela de soya con aroma a incienso y lavanda.', gen: 'choir', seed: 208 },
    ],
    games: [
      { id: 'g1', title: 'Cosecha Estelar', description: 'Plataforma flotante: recolecta 12 estrellas antes de que se apaguen.', kind: 'internal', target: 'stars', open: true },
      { id: 'g2', title: 'Sinestesia', description: 'Sala inmersiva: tus pasos pintan luz y componen música. Eres coautor.', kind: 'internal', target: 'synesthesia', open: true },
      { id: 'g3', title: 'Convocatoria · Juego Indie', description: 'Puerta abierta para el próximo videojuego seleccionado.', kind: 'url', target: '', open: false },
      { id: 'g4', title: 'Narrativa Experiencial', description: 'Próximamente: una historia que escribes al caminarla.', kind: 'url', target: '', open: false },
    ],
    events: [
      { id: 'e1', title: 'Ethereal Echoes of My Mind', date: '2026-11-14', kind: 'exposicion', description: 'Exposición temporal curada por Antu Coss.' },
      { id: 'e2', title: 'Convocatoria Internacional 2026', date: '2026-12-12', kind: 'convocatoria', description: 'Curadores y artistas transmedia: envía tu propuesta desde la sala temporal.' },
      { id: 'e3', title: 'Lanzamiento · Hoodie Galaxia', date: '2026-11-20', kind: 'lanzamiento', description: 'Edición limitada en la tienda del museo.' },
      { id: 'e4', title: 'Concurso Jardín Surreal', date: '2026-12-01', kind: 'concurso', description: 'La planta más extraña del jardín gana un print firmado.' },
      { id: 'e5', title: 'Obras curadas · Sala Escultura', date: '2026-11-28', kind: 'curaduria', description: 'Nueva selección de esculturas animadas en tiempo real.' },
    ],
    submissions: [],
    settings: {
      seed: 2026,
      palette: 'lavanda',
      futureName: 'Mirador Estelar',
      futureOpen: false,
      futureKind: 'mirador',
      multiplayer: true,
      roomName: 'boveda-principal',
      adminHash: DEFAULT_ADMIN_HASH,
      peyBackend: '',
    },
  }
}
