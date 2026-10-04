# Guía: publicar "Paga aí po!" en GitHub Pages (link público para WhatsApp)

El proyecto ya está listo como repositorio git (ya hice `git init` y el primer commit).
Solo falta crear el repo en GitHub y subirlo. ~5 minutos.

## Paso 1 — Crear el repositorio en GitHub
1. Entra a <https://github.com/new>.
2. **Repository name**: `paga-ai-po`
3. Déjalo **Public**.
4. **NO** marques "Add a README / .gitignore / license" (el repo debe quedar vacío).
5. **Create repository**.

GitHub te mostrará una URL como `https://github.com/TU_USUARIO/paga-ai-po.git`.

## Paso 2 — Subir el proyecto
En una terminal, dentro de la carpeta `Desktop\App`, ejecuta (reemplaza TU_USUARIO):

```bash
git remote add origin https://github.com/TU_USUARIO/paga-ai-po.git
git push -u origin main
```

Si te pide iniciar sesión en GitHub, sigue el flujo que aparezca (navegador o token).

## Paso 3 — Activar GitHub Pages
1. En el repo: **Settings** → **Pages**.
2. En **Source**, elige **Deploy from a branch**.
3. **Branch**: `main` · carpeta `/ (root)` → **Save**.
4. Espera 1–2 minutos. Arriba aparecerá:
   **"Your site is live at https://TU_USUARIO.github.io/paga-ai-po/"**

¡Ese es tu link público para compartir por WhatsApp! 🎉

## Notas
- La app funciona bajo esa subcarpeta sin cambios (usa rutas relativas).
- El login (correo + contraseña) y la nube funcionan igual desde GitHub Pages:
  Supabase acepta peticiones desde cualquier origen.
- `config.js` lleva la **publishable key**, que es **pública a propósito** (la
  seguridad la hacen las políticas RLS). Por eso no hay problema en un repo público.
- Para actualizar el sitio en el futuro: edita, luego
  `git add -A && git commit -m "cambios" && git push`.
