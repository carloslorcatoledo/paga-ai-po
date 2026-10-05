# GitHub Pages

El repositorio [carloslorcatoledo/paga-ai-po](https://github.com/carloslorcatoledo/paga-ai-po)
publica esta app desde la rama `main`. La URL pública es
[carloslorcatoledo.github.io/paga-ai-po](https://carloslorcatoledo.github.io/paga-ai-po/).

## Publicar cambios

Desde la carpeta del proyecto, guarda los cambios en Git y súbelos a `main`:

```bash
git add README.md stack-tecnologico.md guia-github-pages.md guia-supabase.md
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
