# Cybermuseo

**Arte · Tecnología · Eternidad.** Un museo digital 3D persistente y multijugador que se recorre en el navegador como un videojuego. Es una catedral neogótica futurista que flota en un universo de galaxias. Un estudio de **Ethercoded**.

## Qué hay dentro

- **Landing**: intro animada y scroll 360° tipo pitch con la cúpula en vivo de fondo.
- **Un solo edificio continuo.** Desde el **lobby** (cúpula con nube gaussiana de partículas, piso de ajedrez reactivo, candelabros y tiras LED lavanda) se llega a pie, por arcos y pasillos, a:
  - Videosala (cine virtual)
  - Sala de Escultura 3D (se sube por escalinata)
  - Sala de Pintura 2D
  - Tienda de merchandising
  - Jardín Digital exterior: crece una planta por cada pago
  - Exposiciones temporales y convocatoria para artistas y curadores
  - Pasillo de Videojuegos, con puertas a minijuegos internos o a juegos externos por URL
  - Un ala procedural que se “construye” desde el panel con una semilla
- **3 personajes** (Oráculo, Centinela, Astral) en tercera persona. En escritorio se juega con WASD/flechas, Shift, arrastrar la cámara y `E`; en móvil, con joystick y botón de acción.
- **Multijugador P2P** (WebRTC vía [Trystero](https://github.com/dmotz/trystero), sin servidor). Ves a los demás visitantes y hay chat, y los pagos se propagan a todos.
- **HUD liquid glass** con mapa/teletransporte, ticker de pagos, energía de la nube, tienda y botón de apoyo.
- **SuperAdmin** en `#admin` (contraseña demo `cybermuseo`). Permite editar obras, tienda, videosala, videojuegos, eventos, salas, la exposición temporal y la convocatoria. También sube imágenes, videos y modelos `.glb`, que se guardan en IndexedDB; incluye el constructor procedural (semilla y paleta del universo), un simulador de pagos y la exportación/importación de JSON.

## Pagos y reacción visual

Todo pago confirmado entra a `payments` (`src/payments/bus.ts`), que:
dispara una onda en la nube gaussiana, cambia el color de la luz, genera ondas en el piso y planta una flor (con la semilla del pago) en el jardín.

Hoy el museo usa `SimulatedProvider` (QR de demostración y botón “Simular pago”).
**pey (siguiente fase):** `PeyProvider` (`src/payments/provider.ts`) se activa al poner la URL de un backend propio en *SuperAdmin → Pagos*. Ese backend debe:

1. `POST /checkout` `{amount, concept, purpose, payer}`: llama a `POST https://api.pey.mx/codi/qr` o `/payment-link/create` **con la API key del lado del servidor** y devuelve `{id, qrString?, url?}`.
2. Recibir los webhooks `codi.qr.payment_received` / `payment_link.status_updated`, validar la firma (Standard Webhooks) y deduplicar por `webhook-id`.
3. `GET /events` (SSE): emite cada pago confirmado como `PaymentEvent` para que todos los museos abiertos reaccionen.

La API key nunca va en el navegador.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ estático (base relativa, sirve en cualquier hosting)
```

Parámetros útiles: `?skip` entra directo al museo, `?room=jardin` aparece en una sala, `?solo` desactiva la red y `?q=low|mid|high` fija la calidad gráfica.

Stack: Vite, TypeScript y Three.js (bloom, shaders propios para cielo, nube y piso), Trystero y qrcode. El arte y la arquitectura son procedurales; no hay assets pesados.
