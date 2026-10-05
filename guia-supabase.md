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
4. Debe decir *Success*. Esto crea las tablas de eventos, perfiles, actividad y pagos, las políticas RLS, Realtime y las funciones para guardar, compartir y actualizar pagos.
Si el proyecto Supabase ya estaba creado, vuelve a ejecutar el esquema actualizado antes de publicar la nueva app. La versión incluye las claves estables de participantes, las huellas financieras y la tabla `transferencia_pago`; completa la huella de eventos cloud existentes, que comienzan pendientes. El creador autenticado puede marcar transferencias pagadas o pendientes y guardar el monto abonado acumulado; los demás miembros solo consultan. Un cambio financiero reinicia esos estados. No publiques el frontend nuevo hasta que el SQL termine con *Success*.

El script también agrega el perfil con nombre y correo, crea el log de actividad, completa perfiles de usuarios existentes y define `asegurar_perfil_usuario()`. Esta RPC solo puede ejecutarse con una sesión autenticada y repara únicamente el perfil asociado a `auth.uid()`. También configura el registro automático de altas, inicios y cierres de sesión, y eventos a los que se une o pertenece el usuario.

Si el proyecto Supabase ya estaba creado, vuelve a ejecutar el esquema actualizado antes de publicar la nueva app. El script es idempotente: agrega el perfil con nombre y correo, crea el log de actividad, completa perfiles de usuarios existentes y define `asegurar_perfil_usuario()`. Esta RPC solo puede ejecutarse con una sesión autenticada y repara únicamente el perfil asociado a `auth.uid()`. También configura el registro automático de altas, inicios y cierres de sesión, y eventos a los que se une o pertenece el usuario.

## Paso 3 — Verificar
1. **Table Editor**: deberías ver `evento`, `evento_miembro`, `participante`, `gasto`, `gasto_participante`, `transferencia_pago`, `perfil_usuario` y `registro_actividad`.
2. **Authentication** → **Providers**: confirma que **Email** está habilitado (viene por defecto).
   - Para probar rápido, en **Authentication → Providers → Email**, puedes desactivar "Confirm email" (así no tienes que confirmar el correo al registrarte en pruebas). En producción, déjalo activado.
3. Una persona puede probar la app sin sesión; sus eventos quedan locales. Para las funciones de nube debe entrar con su cuenta. Después del login, la app crea o repara su propio perfil; una dirección de correo por sí sola no concede acceso.
4. En **Authentication → URL Configuration**, agrega a **Redirect URLs** la URL publicada `https://carloslorcatoledo.github.io/paga-ai-po/`. Para desarrollo local, agrega también `http://localhost:8123/**`. El enlace de recuperación vuelve a esa URL para permitir elegir la contraseña nueva.

## Paso 4 — Copiar la configuración de API
1. **Project Settings** (engranaje) → **API**.
2. Copia estos dos valores:
   - **Project URL** → algo como `https://xxxxxxxx.supabase.co`
   - **Publishable key** (Project API Keys) → una clave pública que suele comenzar
     con `sb_publishable_`. En proyectos antiguos también puede aparecer como `anon`.
3. Estos valores se configuran en `config.js` como `url` y `publishableKey`. La
   clave publishable/anon está diseñada para uso en el cliente; la seguridad la
   aplican las políticas RLS. Nunca uses una clave secreta (`sb_secret_` o
   `service_role`) en el front ni la publiques en el repositorio.

## Paso 5 — Configurar y verificar la app
Guarda la **Project URL** y la **publishable key** en `config.js` localmente. No compartas claves secretas ni las incluyas en el cliente. La app permite:
- Probar cálculos, historial local y compartir resúmenes sin iniciar sesión.
- Entrar con correo y contraseña para usar funciones de nube; el nombre se solicita al crear la cuenta.
- Crear o reparar el perfil propio después de autenticar, mediante `asegurar_perfil_usuario()`.
- Recuperar la contraseña por correo; requiere tener autorizada la URL de retorno en **Authentication → URL Configuration**.
- Guardar/leer eventos, participantes y gastos en la nube.
- Ver eventos propios y compartidos donde la cuenta es miembro.
- Auditar altas, accesos, cierres de sesión y membresías en `registro_actividad`.
- **Realtime**: cuando un amigo agrega un gasto, aparece en tu pantalla al instante.
- Compartir evento por **código** (función `unirse_a_evento` ya creada).

Antes de publicar una versión que use `asegurar_perfil_usuario()`, ejecuta el
esquema actualizado en SQL Editor y confirma que terminó con *Success*.

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
