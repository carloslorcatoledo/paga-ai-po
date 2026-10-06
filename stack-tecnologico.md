# Stack tecnológico

## Aplicación

- **HTML5**: estructura de la interfaz y metadatos de instalación.
- **CSS3**: estilos y diseño adaptable, incluidos directamente en `index.html`.
- **JavaScript vanilla**: lógica de la app, interfaz y cálculos en archivos separados; no usa framework ni proceso de compilación.
- **Panel de uso**: `admin.html`/`admin.js` reutilizan el cliente Supabase y consultan solo estadísticas agregadas mediante una RPC protegida.
- **PWA**: `manifest.json` define la instalación y `sw.js` implementa el service worker y la caché de recursos para uso sin conexión.
- **Almacenamiento local**: `localStorage` conserva borradores, preferencias e historial local en el dispositivo.

## Backend y nube

- **Supabase**: PostgreSQL, autenticación por correo, Realtime y funciones RPC.
- **Supabase JS v2**: cliente cargado desde jsDelivr en `index.html` mediante `@supabase/supabase-js@2`.
- **Seguridad de datos**: Row Level Security (RLS) y funciones SQL definidas en `esquema-supabase.sql`.
- **Acceso cloud**: prueba de 30 días y autorización de escrituras aplicadas en RPC/RLS; activación pagada manual mientras no exista integración de cobro.
- **Configuración del cliente**: `config.js` contiene la URL del proyecto y la clave publishable pública. No debe contener claves secretas.

## Pruebas y publicación

- **Node.js con `node:test`**: pruebas de la lógica pura de `calc.js`, ejecutadas con `node --test` (el README documenta Node 18 o superior).
- **Pruebas en navegador**: `test.html` ejecuta los casos de cálculo sin instalar dependencias.
- **GitHub Pages**: publica los archivos estáticos desde la rama `main` y la raíz del repositorio; no hay paso de build ni dependencias npm que instalar.

## Estructura principal

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Interfaz, estilos, CSP y carga de scripts. |
| `app.js` | Interacción, estado local, calendario e integración de la interfaz con la nube. |
| `cloud.js` | Autenticación y operaciones de Supabase. |
| `admin.html` / `admin.js` | Panel administrativo estático, solo lectura y con autorización en Supabase. |
| `calc.js` | Cálculos de división de gastos, sin dependencias externas. |
| `calc.test.js` / `test.html` | Pruebas de cálculo para Node.js y navegador. |
| `config.js` | URL y clave publishable de Supabase. |
| `sw.js` / `manifest.json` | Caché offline e instalación como PWA. |
| `esquema-supabase.sql` | Esquema, políticas RLS y funciones de base de datos. |