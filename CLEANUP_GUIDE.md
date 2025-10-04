# 🧹 Limpieza de Imágenes No Utilizadas

## ¿Qué hace esta herramienta?

La herramienta de limpieza de imágenes escanea todos los productos y categorías de tu API para identificar qué imágenes están siendo utilizadas, luego compara con las imágenes almacenadas en la carpeta `/img` del repositorio y elimina las que no están siendo referenciadas por ningún producto o categoría.

## Características

✅ **Escaneo Completo**: Analiza todos los productos, categorías, categorías promocionales (Featured, Hot Sales) y productos relacionados.

✅ **Modo Prueba**: Primero puedes ejecutar un escaneo sin eliminar nada para ver qué imágenes serían eliminadas.

✅ **Reporte Detallado**: Muestra exactamente qué imágenes están en uso y cuáles no.

✅ **Tracking de Uso**: Indica qué productos/categorías están usando cada imagen.

## 🔍 Cómo Funciona

### Escaneo de Imágenes

1. **Recopila todas las imágenes en uso**:
   - Lee todas las categorías (`cats/cat.json`)
   - Lee categorías promocionales (`cats/featured.json`, `cats/hot_sales.json`)
   - Lee todos los productos de cada categoría (`cats_products/{id}.json`)
   - Lee detalles completos de cada producto (`products/{id}.json`)
   - Incluye imágenes de productos relacionados
   - **Extrae nombres de archivo con extensión** desde URLs completas
     - Ejemplo: `https://racher95.github.io/diy-emercado-api/images/products/imagen.webp` → `imagen.webp`
     - Soporta todos los formatos: `.webp`, `.jpg`, `.jpeg`, `.png`, `.gif`, etc.

2. **Lista todos los archivos en las carpetas de imágenes**:
   - Escanea `images/products/` - Imágenes de productos
   - Escanea `images/cats/` - Imágenes de categorías
   - Usa la API de GitHub para obtener la lista completa

3. **Compara y genera reporte**:
   - Compara **nombres de archivo completos** (incluyendo extensión)
   - Identifica qué imágenes están en uso
   - Identifica qué imágenes no tienen referencias (duplicadas, huérfanas)
   - Muestra dónde se usa cada imagen

## Qué imágenes se consideran "en uso"

La herramienta considera que una imagen está en uso si aparece en:

### Productos
- ✅ Imagen principal (`product.image`)
- ✅ Galería de imágenes (`product.images[]`)
- ✅ Imágenes en productos relacionados (`product.relatedProducts[].image`)

### Categorías
- ✅ Imagen de categoría (`category.imgSrc`)
- ✅ Imágenes de categorías promocionales (Featured, Hot Sales)

### Ubicaciones escaneadas
- `/products/{id}.json` - Detalle completo de productos
- `/cats_products/{id}.json` - Resumen de productos por categoría
- `/cats/cat.json` - Lista de categorías
- `/cats/featured.json` - Categoría de productos destacados
- `/cats/hot_sales.json` - Categoría de ofertas flash

## Ejemplo de uso

```javascript
// La herramienta detecta URLs en diferentes formatos:

// ✅ URLs completas
"https://tu-usuario.github.io/repo/img/products/phone.jpg"

// ✅ Rutas relativas
"img/products/phone.jpg"

// ✅ Rutas absolutas
"/img/categories/electronics.jpg"

// Todas se normalizan para comparación
```

## 📁 Estructura del Repositorio

El sistema escanea las siguientes carpetas en tu repositorio de API:

```
diy-emercado-api/
├── images/
│   ├── products/        ← Imágenes de productos
│   │   ├── imagen1.webp
│   │   ├── imagen2.jpg
│   │   └── ...
│   └── cats/           ← Imágenes de categorías
│       ├── categoria1.png
│       ├── categoria2.webp
│       └── ...
```

### Formatos Soportados

El sistema detecta y maneja **todos los formatos de imagen**:
- ✅ `.webp` - WebP (moderno, optimizado)
- ✅ `.jpg` / `.jpeg` - JPEG (común)
- ✅ `.png` - PNG (transparencias)
- ✅ `.gif` - GIF (animaciones)
- ✅ Cualquier otro formato que uses

La comparación se hace por **nombre completo del archivo**, incluyendo la extensión, por lo que:
- `imagen.webp` ≠ `imagen.jpg` (son archivos diferentes)
- Detecta duplicados exactos por nombre

## 🎯 Casos de Uso

### 1. Limpieza Regular
Ejecuta el escaneo periódicamente para mantener el repositorio limpio.

### 2. Antes de Deployment
Asegúrate de no tener imágenes innecesarias que aumenten el tamaño del repo.

### 3. Después de Eliminar Productos
Cuando eliminas productos, sus imágenes pueden quedar huérfanas. Esta herramienta las detecta.

### 4. Detección de Duplicados
Si subiste la misma imagen dos veces con nombres diferentes, el reporte te lo mostrará.

## Seguridad y respaldo

### Antes de usar:

✅ **Haz un respaldo**: Clona tu repositorio o crea un branch de respaldo

✅ **Usa modo prueba primero**: Siempre ejecuta el escaneo antes de eliminar

✅ **Revisa el reporte**: Verifica que las imágenes marcadas como "sin uso" realmente no se necesitan

### Durante el proceso:

- La herramienta usa la API de GitHub para eliminar archivos
- Cada eliminación se registra en el historial de commits
- El mensaje de commit indica qué archivo se eliminó

### Después de la limpieza:

- Verifica que tu sitio funcione correctamente
- Revisa que no haya imágenes rotas
- Si hay problemas, puedes revertir usando Git

## Solución de problemas

### "No se encontraron imágenes en /img"

**Causa**: La carpeta `/img` no existe o está vacía.

**Solución**: Verifica la estructura de tu repositorio.

### "Error al listar imágenes"

**Causa**: Problemas de permisos o configuración del token de GitHub.

**Solución**: Verifica tus variables de entorno en Netlify.

### "Error al eliminar imagen"

**Causa**: El archivo puede haber sido eliminado previamente o tener problemas de permisos.

**Solución**: Revisa el reporte de errores y ejecuta el escaneo nuevamente.

## Limitaciones

- Solo analiza archivos en la carpeta `/img`
- No detecta imágenes usadas en código HTML/CSS personalizado
- Requiere conexión a GitHub para funcionar
- El escaneo puede tardar si hay muchos productos

## Consideraciones técnicas

### Performance

- **Escaneo**: ~1-2 segundos por cada 100 productos
- **Eliminación**: ~0.5 segundos por imagen
- Las operaciones son secuenciales para evitar rate limits

### Rate Limits

GitHub API tiene límites:
- 5000 requests/hora para cuentas autenticadas
- Si tienes muchas imágenes, puede tomar tiempo

### Estructura esperada

```
repo/
├── img/
│   ├── products/
│   │   ├── phone1.jpg
│   │   └── phone2.jpg
│   └── categories/
│       └── electronics.jpg
├── products/
│   └── 1.json
├── cats_products/
│   └── 1.json
└── cats/
    ├── cat.json
    ├── featured.json
    └── hot_sales.json
```

## Mejores prácticas

1. **Ejecuta en modo prueba primero**: Siempre.
2. **Revisa el reporte completo**: Antes de eliminar.
3. **Haz respaldos regulares**: Del repositorio completo.
4. **Documenta cambios**: Especialmente eliminaciones masivas.
5. **Verifica después**: Que el sitio funcione correctamente.

## Preguntas frecuentes

**¿Puedo deshacer una eliminación?**

Sí, usando Git. Las eliminaciones quedan en el historial de commits y puedes revertirlas.

**¿Qué pasa si elimino una imagen por error?**

Deberás revertir el commit de eliminación o volver a subir la imagen manualmente.

**¿Funciona con imágenes externas?**

No, solo analiza y elimina imágenes en tu repositorio. Las URLs externas se ignoran.

**¿Afecta a imágenes en caché?**

No, la limpieza solo afecta los archivos en el repositorio. Los navegadores pueden mantener imágenes en caché temporalmente.

---

**Desarrollado para DIY API Admin v3**
Mantén tu API limpia y organizada 🧹✨
