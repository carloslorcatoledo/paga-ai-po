# GitHub Pages

El repositorio [carloslorcatoledo/paga-ai-po](https://github.com/carloslorcatoledo/paga-ai-po)
publica esta app desde la rama `main`. La URL pública es
[carloslorcatoledo.github.io/paga-ai-po](https://carloslorcatoledo.github.io/paga-ai-po/).

## Publicar cambios

Desde la carpeta del proyecto, guarda los cambios en Git y súbelos a `main`:

```bash
git add README.md stack-tecnologico.md guia-github-pages.md guia-supabase.md admin.html admin.js app.js cloud.js esquema-supabase.sql sw.js index.html
git commit -m "Actualiza documentación del proyecto"
git push origin main
```

GitHub Pages actualizará el sitio después del push. El estado del despliegue se
puede consultar en **Actions** del repositorio. La configuración de publicación
está en **Settings → Pages**.

## Configuración y seguridad

- Pages sirve los archivos estáticos desde la raíz de `main`; no hay un paso de
  compilación.
- La app usa rutas relativas, por lo que funciona en la subruta del repositorio.
- `config.js` contiene una clave publishable de Supabase, diseñada para uso en el
  cliente. La protección de los datos depende de las políticas RLS; nunca se debe
  incluir una clave `service_role` o `sb_secret` en el repositorio.
- Los enlaces de recuperación de contraseña requieren autorizar la URL publicada
  en **Supabase → Authentication → URL Configuration → Redirect URLs**.
- El panel privado queda en
  <https://carloslorcatoledo.github.io/paga-ai-po/admin.html>. Ejecuta primero el
  esquema actualizado en Supabase; el acceso a sus métricas se valida mediante
  una RPC y está limitado a `lorcarlos@gmail.com` con correo confirmado.
- Para activar la prueba cloud y sus restricciones, aplica también el esquema
  actualizado antes de desplegar. Cuentas existentes reciben 30 días desde la
  activación del esquema; las nuevas, desde su alta. Las escrituras se validan
  en Supabase; el modo local no puede bloquearse desde GitHub Pages.
