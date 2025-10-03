# DIY API Admin (v3)

Panel de administración para tu API estática en GitHub Pages. Incluye:
- 📤 Subida de imágenes al repo (`images/products`, `images/cats`)
- ✏️ Crear/editar categorías y productos (upsert)
- 🗑️ Eliminar producto/categoría (opción cascade)
- 🔗 Productos relacionados con búsqueda inteligente (por ID o texto)
- 🧹 **Limpieza de imágenes no utilizadas** (nuevo)
- ⚡ Funciones serverless (Netlify) que commitean con `GITHUB_TOKEN`

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

## Funcionalidades Destacadas

### 🧹 Limpieza de Imágenes No Utilizadas

Una herramienta completa para mantener tu repositorio limpio:

- **Escaneo Inteligente**: Analiza todos los productos, categorías y productos relacionados
- **Modo Prueba**: Visualiza qué imágenes serían eliminadas antes de confirmar
- **Reporte Detallado**: Muestra qué imágenes están en uso y dónde se usan
- **Eliminación Segura**: Confirma antes de eliminar permanentemente

Ver [CLEANUP_GUIDE.md](./CLEANUP_GUIDE.md) para documentación completa.

### 🔗 Productos Relacionados

- Búsqueda inteligente por ID (incluso de un solo dígito) o por texto
- Selección múltiple de productos
- Vista previa con imágenes y precios
- Datos completos almacenados para mejor rendimiento

## Desarrollo local
```bash
npm i -g netlify-cli
netlify dev
```

> Este repo es sólo del *panel*. La API de datos vive en otro repo (p. ej. `diy-emercado-api`).
