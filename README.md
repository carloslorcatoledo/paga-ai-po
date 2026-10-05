# Paga aí po! — dividir cuentas entre amigos

Prototipo funcional (PWA) para dividir una cuenta **por ítem, no por total**: cada
gasto se reparte solo entre quienes lo consumieron. Pensado para usarse en el
celular, de noche, en 3 toques.

## Qué incluye este proyecto

| Archivo | Qué es |
|---|---|
| `index.html` | Estructura y estilos de la app. |
| `app.js` | La interfaz, calendario, estado local y sincronización en vivo. Script externo (ver Seguridad). |
| `config.js` | URL + publishable key de Supabase (la publishable es pública). |
| `cloud.js` | Login, guardado transaccional, historial, compartir por código y suscripciones Realtime. |
| `calc.js` | El "corazón": la lógica de cálculo, pura y sin dependencias. |
| `calc.test.js` | Pruebas de la lógica para `node --test`. |
| `test.html` | Las mismas pruebas corriendo en el navegador (sin instalar nada). |
| `manifest.json`, `sw.js`, `icon.svg` | Para instalarla como app y usarla sin internet. |
| `plan-app-dividir-cuentas.md` | El plan de producto completo. |
| `esquema-supabase.sql` | Tablas, RLS, Realtime y guardado atómico con control de versión. |
| `guia-supabase.md` | Guía paso a paso para montar Supabase. |
| `guia-uso.md` | Instrucciones para crear salidas, calcular saldos y compartir eventos. |

## Monedas

Se cambian desde el **selector en la barra superior**: **CLP** (peso chileno, sin
decimales), **USD** (dólar) y **BRL** (real brasileño). Las salidas nuevas parten
en BRL; las salidas existentes conservan su moneda. Al cambiar de moneda, los
montos de la salida actual se **reescalan** manteniendo el número que escribiste
(ej. `20.000` CLP → `20,000.00` USD); **no** es una conversión por tipo de cambio.

## Idioma

El selector junto a la moneda permite elegir **español (ES)**, **portugués (PT)**
o **inglés (EN)**. La app parte en español y guarda el idioma elegido en el
navegador. También adapta los formatos de fecha y número al idioma; esto no
cambia la moneda ni los importes de la salida.

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
- **CSP (Content-Security-Policy) estricta:** no se permiten scripts en línea; los
  scripts propios y Supabase se limitan a los orígenes declarados en la política.
  Por eso el JS vive en `app.js`/`calc.js` (archivos aparte) y no en el HTML.
- **Datos locales y nube:** el borrador se conserva en `localStorage`. Un evento se
  guarda en Supabase solo cuando eliges "Guardar este evento en la nube"; sus
  miembros pueden abrirlo con el código y recibir cambios guardados en tiempo real.
  La app se puede probar sin iniciar sesión: los datos y el historial permanecen en
  ese dispositivo y no se sincronizan automáticamente. RLS limita el acceso cloud a
  miembros autenticados del evento. El menú de cuenta permite entrar con correo y
  contraseña; el registro pide nombre y la lista muestra eventos donde participa.
- **Perfil autenticado:** después del login, `asegurar_perfil_usuario()` repara el
  perfil propio a partir de la sesión de Supabase. No se concede identidad ni acceso
  cloud por buscar un correo o por conocer su dirección.
- **Auditoría de cuenta:** `perfil_usuario` conserva nombre y correo, y
  `registro_actividad` registra altas, inicios/cierres de sesión y membresías. El
  esquema SQL debe aplicarse en Supabase para activar estas funciones.
- **Enlaces externos seguros:** la ventana de WhatsApp se abre con `noopener` y la
  página no filtra su dirección (`referrer: no-referrer`).
- **Validación de entrada:** montos siempre ≥ 0; límites de largo en nombres y
  descripciones.

> La publishable key de Supabase es pública por diseño; nunca pongas una `service_role`
> key en el cliente. La seguridad de los eventos compartidos depende de RLS.

## Estado respecto al plan

- [x] **Fase 1 — Lógica** con pruebas (`calc.js` + `calc.test.js` + `test.html`).
- [x] **Fase 2 — MVP**: personas, gastos por ítem, categorías, resumen, guardado
      local, compartir por WhatsApp.
- [x] **Fase 3 (parcial)**: modo oscuro, monedas (CLP/USD/BRL), simplificación de
      deudas, instalable como PWA, **pasada de seguridad**.
- [x] **Propina / servicio** (porcentaje repartido proporcional al consumo, con
      exclusión por gasto).
- [x] **Calendario**: fechas y consulta de eventos guardados.
- [ ] **Pendiente**: partes desiguales ("comí 2 porciones").
- [~] **Fase 4 — Nube**: login, historial, compartir por código, Realtime y guardado
  transaccional con control de concurrencia ya implementados en el código.
- [x] **Supabase**: columna de versión, RPC de guardado transaccional y publicación
  Realtime aplicadas en el proyecto.
- [ ] **Verificación multiusuario**: probar un evento compartido con dos sesiones
  autenticadas y forzar dos guardados simultáneos.
- [ ] **Versión 3**: OCR de boletas, datos de transferencia y recordatorios de deuda.

## Publicar gratis (cuando quieras)

La app está publicada en [GitHub Pages](https://carloslorcatoledo.github.io/paga-ai-po/).
Para cambios futuros, haz commit y push a `main`. Antes de usar el guardado concurrente,
ejecuta el esquema actualizado de [Supabase](guia-supabase.md) en el proyecto.

## Decisiones técnicas del prototipo

- **Dinero en enteros** (unidad mínima: pesos en CLP, centavos en USD/BRL) para
  evitar errores de redondeo.
- **Sin framework** a propósito: cero build, abre en cualquier lado (servido por
  HTTP). La ruta a producción del plan (React + Vite + Tailwind) sigue válida; este
  prototipo valida la UX y la lógica primero.
- **`calc.js` es universal** (UMD): el mismo archivo lo usan la app (navegador) y
  las pruebas (Node).
