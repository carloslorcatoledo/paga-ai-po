# Paga aí po! — dividir cuentas entre amigos

Prototipo funcional (PWA) para dividir una cuenta **por ítem, no por total**: cada
gasto se reparte solo entre quienes lo consumieron. Pensado para usarse en el
celular, de noche, en 3 toques.

## Qué incluye este proyecto

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura y estilos de la app. |
| `app.js` | La interfaz (pantallas, guardado local, compartir). Script externo (ver Seguridad). |
| `config.js` | URL + publishable key de Supabase (la publishable es pública). |
| `cloud.js` | Capa de nube: login (correo+contraseña) y datos (guardar/historial/compartir). |
| `calc.js` | El "corazón": la lógica de cálculo, pura y sin dependencias. |
| `calc.test.js` | Pruebas de la lógica para `node --test`. |
| `test.html` | Las mismas pruebas corriendo en el navegador (sin instalar nada). |
| `manifest.json`, `sw.js`, `icon.svg` | Para instalarla como app y usarla sin internet. |
| `plan-app-dividir-cuentas.md` | El plan de producto completo. |
| `esquema-supabase.sql` | Esquema SQL (tablas + seguridad RLS + realtime) para la nube. |
| `guia-supabase.md` | Guía paso a paso para montar Supabase. |

## Monedas

Se cambian desde el **selector en la barra superior**: **CLP** (peso chileno, sin
decimales), **USD** (dólar) y **BRL** (real brasileño). Al cambiar de moneda, los
montos se **reescalan** manteniendo el número que escribiste (ej. `20.000` CLP →
`20,000.00` USD); **no** es una conversión por tipo de cambio.

## Propina / servicio

En la pantalla **Resumen** eliges el porcentaje de propina (Sin, 5%, 10%, 15% u
"Otro %"). La propina se **reparte proporcional al consumo de cada uno** (va
incluida en el monto efectivo de cada gasto), así que quien consumió más, aporta
más propina. Cada gasto puede **excluirse** de la propina con el interruptor
"Incluir propina / servicio" en su formulario (útil para un taxi o el super). Los
saldos siempre siguen sumando 0.

## Cómo probarla

### En el celular (lo más fácil)
Está publicada como página web. Abre el link en el teléfono y, en el menú del
navegador, elige **"Agregar a pantalla de inicio"** para instalarla como app.

### En el computador
Hay que servirla por HTTP (no abrir `index.html` con doble clic: la política de
seguridad **CSP** solo permite recursos del mismo origen, y `file://` no lo es).
Con Python:

```bash
py -3 -m http.server 8123
```

Luego abre <http://localhost:8123/index.html>.
(Las pruebas: <http://localhost:8123/test.html>.)

## Cómo correr las pruebas de la lógica

- **Sin instalar nada:** abre `test.html` (servido por HTTP, como arriba).
- **Con Node 18+:** `node --test`

Casos cubiertos: división exacta, reparto del residuo en CLP (ej. $10.000 ÷ 3 =
3.334 + 3.333 + 3.333), el escenario del plan (2 que no beben), que los saldos
siempre sumen 0, la simplificación de deudas (incluida la cadena A→B→C que se paga
directo A→C), la **propina** (aplicación, exclusión por gasto, reparto proporcional
al consumo) y una prueba de integración que verifica que todo quede saldado.

## Seguridad y privacidad

Decisiones tomadas para que la app sea segura por defecto:

- **Anti-XSS:** todo texto que escribe el usuario (nombres, descripciones) se
  **escapa** antes de mostrarse. Un nombre como `<script>` se muestra como texto,
  no se ejecuta.
- **CSP (Content-Security-Policy) estricta:** el navegador solo carga recursos del
  propio sitio; no se permiten scripts en línea ni dominios externos. Por eso el JS
  vive en `app.js`/`calc.js` (archivos aparte) y no incrustado en el HTML.
- **Datos solo en tu dispositivo:** todo se guarda en `localStorage`. Nada se envía
  a ningún servidor. Lo único que "sale" es el texto que tú decides compartir por
  WhatsApp.
- **Enlaces externos seguros:** la ventana de WhatsApp se abre con `noopener` y la
  página no filtra su dirección (`referrer: no-referrer`).
- **Validación de entrada:** montos siempre ≥ 0; límites de largo en nombres y
  descripciones.

> Nota: como los datos son locales y sin cuentas, "seguridad" aquí es sobre todo no
> ejecutar contenido malicioso y no filtrar datos. Cuando llegue la **Fase 4 (nube)**
> habrá que sumar autenticación, reglas de acceso en la base de datos y validación
> también en el servidor.

## Estado respecto al plan

- [x] **Fase 1 — Lógica** con pruebas (`calc.js` + `calc.test.js` + `test.html`).
- [x] **Fase 2 — MVP**: personas, gastos por ítem, categorías, resumen, guardado
      local, compartir por WhatsApp.
- [x] **Fase 3 (parcial)**: modo oscuro, monedas (CLP/USD/BRL), simplificación de
      deudas, instalable como PWA, **pasada de seguridad**.
- [x] **Propina / servicio** (porcentaje repartido proporcional al consumo, con
      exclusión por gasto).
- [ ] **Siguiente**: partes desiguales ("comí 2 porciones"), historial de eventos.
- [~] **Fase 4 — Nube** (en marcha, con Supabase): login (correo+contraseña), guardar
      eventos en la nube (= **historial**) y **compartir por código**. Falta: **tiempo real**.

## Publicar gratis (cuando quieras)

Al ser archivos estáticos, se publica en **GitHub Pages** subiendo la carpeta a un
repo y activando Pages. (Para los eventos compartidos de la Fase 4 se agrega
Supabase como backend.)

## Decisiones técnicas del prototipo

- **Dinero en enteros** (unidad mínima: pesos en CLP, centavos en USD/BRL) para
  evitar errores de redondeo.
- **Sin framework** a propósito: cero build, abre en cualquier lado (servido por
  HTTP). La ruta a producción del plan (React + Vite + Tailwind) sigue válida; este
  prototipo valida la UX y la lógica primero.
- **`calc.js` es universal** (UMD): el mismo archivo lo usan la app (navegador) y
  las pruebas (Node).
