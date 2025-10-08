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

Si el repositorio de datos aún no tiene la estructura mínima, el panel mostrará
un asistente para crearla. Con el botón **Crear estructura inicial** se genera
un commit automático con los archivos base (`cats/cat.json`, categorías
derivadas y README) y marcadores para las carpetas principales (`cats_products/`,
`products/`, `images/`, etc.).

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

## Flujo de publicación en Git

- Trabaja siempre sobre la rama `main`, que es la consumida por Netlify y GitHub Pages.
- Si clonaste este repositorio desde cero, añade tu remoto (solo la primera vez):

  ```bash
  git remote add origin git@github.com:<tu-usuario>/<tu-repo>.git
  git remote -v           # verifica que apunte al repo correcto
  ```

- Trae los cambios más recientes del remoto y asegúrate de trabajar sobre `main`:

  ```bash
  git fetch origin
  git checkout main
  git pull origin main
  ```

- Realiza tus modificaciones, crea un commit y súbelo a GitHub:

  ```bash
  git status              # revisa los archivos modificados
  git add <archivos>
  git commit -m "feat: descripcion corta"
  git push origin main
  ```

- Verifica en GitHub que el commit aparezca en `main` y que Netlify dispare un nuevo deploy preview o deploy de producción según corresponda.
- Si necesitas subir una rama diferente (por ejemplo para PR), reemplaza `main` por el nombre de tu rama tanto al crearla como al hacer `push`.
