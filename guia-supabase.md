# Guía: montar Supabase para "Paga aí po!"

Tiempo estimado: ~15 minutos. No se necesita tarjeta de crédito.

## Resumen de lo que vas a hacer
1. Crear una cuenta y un proyecto en Supabase (gratis).
2. Pegar el esquema SQL (`esquema-supabase.sql`) y ejecutarlo.
3. Verificar las tablas y el login por correo.
4. Copiar tus 2 llaves (Project URL + anon key).
5. Pasármelas para cablear la app (o yo la dejo con *placeholders*).

---

## Paso 1 — Crear cuenta y proyecto
1. Entra a <https://supabase.com> → **Start your project** / **Sign in**. Puedes entrar con tu cuenta de **GitHub**.
2. **New project**:
   - **Name**: `paga-ai-po` (o el que quieras).
   - **Database Password**: genera una fuerte y **guárdala** (la necesitarías para conexión directa; para la app no, pero no la pierdas).
   - **Region**: elige la más cercana. Desde Chile, **South America (São Paulo)** da menos latencia.
   - **Plan**: **Free**.
3. Dale a **Create new project** y espera ~2 minutos a que se aprovisione.

## Paso 2 — Crear las tablas (el esquema SQL)
1. En el menú izquierdo: **SQL Editor** → **New query**.
2. Abre el archivo `esquema-supabase.sql` de este proyecto, copia **todo** y pégalo.
3. Presiona **Run** (o Ctrl/Cmd + Enter).
4. Debe decir *Success*. Esto crea las 4 tablas del plan + `evento_miembro`, la seguridad (RLS), el realtime y la función para unirse por código.

Si el proyecto Supabase ya estaba creado, vuelve a ejecutar el esquema actualizado antes de publicar la nueva app. La migración agrega `evento.version` y la función `guardar_evento_snapshot`, que hace el guardado en una transacción y rechaza snapshots basados en una versión antigua.

## Paso 3 — Verificar
1. **Table Editor**: deberías ver `evento`, `evento_miembro`, `participante`, `gasto`, `gasto_participante`.
2. **Authentication** → **Providers**: confirma que **Email** está habilitado (viene por defecto).
   - Para probar rápido, en **Authentication → Providers → Email**, puedes desactivar "Confirm email" (así no tienes que confirmar el correo al registrarte en pruebas). En producción, déjalo activado.

## Paso 4 — Copiar tus llaves
1. **Project Settings** (engranaje) → **API**.
2. Copia estos dos valores:
   - **Project URL** → algo como `https://xxxxxxxx.supabase.co`
   - **anon public** (Project API Keys) → una cadena larga que empieza con `eyJ...`
3. Estas dos **sí** van en el código del cliente. La **anon key es pública a propósito**; la seguridad la hace la RLS. (La llave **`service_role` es secreta: NO la uses en el front.**)

## Paso 5 — Avísame
Pásame la **Project URL** y la **anon key** (o pégalas en un archivo `config.js`) y cableo la app:
- Login por correo (magic link).
- Guardar/leer eventos, participantes y gastos en la nube.
- **Realtime**: cuando un amigo agrega un gasto, aparece en tu pantalla al instante.
- Compartir evento por **código** (función `unirse_a_evento` ya creada).

---

## Notas del plan gratis
- El proyecto **se pausa tras 7 días sin uso**; se reactiva con 1 clic desde el dashboard.
- Sin backups automáticos (irrelevante para validar la idea).
- Límites: 500 MB de base, 2 proyectos activos, 50.000 usuarios/mes. De sobra para empezar.

## Cómo funciona la seguridad (RLS), en corto
- Cada tabla tiene **Row Level Security** activa: una consulta solo devuelve filas de eventos donde **eres miembro** (`evento_miembro`).
- Al **crear** un evento, un *trigger* te agrega como `owner`.
- Para **compartir**, le pasas el **código** del evento a un amigo; su app llama a `unirse_a_evento('ABC123')` y queda como `editor`.
- Así, aunque la anon key sea pública, nadie ve eventos ajenos.
