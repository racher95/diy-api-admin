# DIY API Admin (v3)

Panel de administración para tu API estática en GitHub Pages. Incluye:
- Subida de imágenes al repo (`images/products`, `images/cats`)
- Crear/editar categorías y productos (upsert)
- Eliminar producto/categoría (opción cascade)
- Funciones serverless (Netlify) que commitean con `GITHUB_TOKEN`

## Deploy (Netlify + GitHub)
1. Sube estos archivos a un repo, p. ej. `diy-api-admin`.
2. En Netlify: **Import from Git** → elige el repo.
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
3. Variables de entorno:
   - `GITHUB_TOKEN` (Contents: Read & Write sobre tu repo de API)
   - `DATA_OWNER` = tu usuario (ej. `racher95`)
   - `DATA_REPO` = repo de la API (ej. `diy-emercado-api`)
   - `DATA_BRANCH` = `main`
4. Deploy y abrir el panel.

## Conectar con tu API
Pega la **API Base URL** (GitHub Pages), ej.:
```
https://racher95.github.io/diy-emercado-api/
```
y presiona **Probar conexión**.

## Desarrollo local
```
npm i -g netlify-cli
netlify dev
```

> Este repo es sólo del *panel*. La API de datos vive en otro repo (p. ej. `diy-emercado-api`).
