# 🔧 Fix: Corrección de Lógica de Comparación de Imágenes

## Problema Identificado

El sistema de limpieza de imágenes no estaba encontrando ninguna imagen porque:

- **En los JSON**: Las imágenes están como URLs completas
  ```json
  "image": "https://racher95.github.io/diy-emercado-api/images/products/1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp"
  ```

- **En el repositorio**: Las imágenes están guardadas solo con el nombre del archivo
  ```
  img/1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp
  ```

- **El código anterior**: Buscaba rutas como `img/archivo.jpg` en lugar de solo `archivo.jpg`

## Solución Implementada

### 1. Función `extractImagePath()` Actualizada

**Antes:**
```javascript
// Buscaba rutas como "img/samsung.jpg"
if (imageUrl.startsWith("img/")) {
  return imageUrl;
}
```

**Ahora:**
```javascript
// Extrae SOLO el nombre del archivo desde URLs completas
if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
  const url = new URL(imageUrl);
  const pathname = url.pathname;
  const parts = pathname.split("/");
  const fileName = parts[parts.length - 1]; // Obtiene última parte
  return fileName;
}
```

### 2. Comparación Actualizada

**Antes:**
```javascript
// Comparaba rutas completas
const normalizedPath = imagePath.startsWith("img/")
  ? imagePath
  : `img/${imagePath}`;

if (imagesInUse.has(normalizedPath)) { ... }
```

**Ahora:**
```javascript
// Compara SOLO nombres de archivo
const fileName = imagePath.includes("/") 
  ? imagePath.split("/").pop() 
  : imagePath;

if (imagesInUse.has(fileName)) { ... }
```

## Resultados

### Test Exitoso

```
URL Original:
  https://racher95.github.io/diy-emercado-api/images/products/1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp

Nombre Extraído:
  1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp

✅ Se compara correctamente con archivos del repositorio
```

### Ejemplo de Comparación

```
Archivos en repositorio:
  - img/1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp
  - img/samsung.jpg
  - img/producto-viejo.jpg

URLs en JSONs:
  - https://racher95.github.io/.../1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp
  - https://example.com/samsung.jpg

Resultado:
  1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp: ✅ EN USO
  samsung.jpg: ✅ EN USO
  producto-viejo.jpg: ❌ SIN USO (se puede eliminar)
```

## Archivos Modificados

1. ✅ `netlify/functions/cleanUnusedImages.mjs`
   - Función `extractImagePath()` reescrita
   - Lógica de comparación actualizada

2. ✅ `CLEANUP_GUIDE.md`
   - Documentación actualizada con el nuevo comportamiento

3. ✅ `test_image_extraction.js` (nuevo)
   - Test unitario para verificar la extracción de nombres

## Qué Hace Ahora

1. **Lee todas las URLs de imágenes** desde productos, categorías, etc.
2. **Extrae el nombre del archivo** de cada URL (última parte después del último `/`)
3. **Lista todos los archivos** en la carpeta `/img` del repositorio
4. **Compara nombres de archivo** (no rutas completas)
5. **Identifica imágenes sin uso** que pueden ser eliminadas

## Validación

✅ Test ejecutado exitosamente
✅ Extracción de nombres funciona con URLs reales de tu proyecto
✅ Comparación identifica correctamente imágenes en uso vs sin uso
✅ Documentación actualizada

## Próximo Paso

🚀 **Desplegar** los cambios a Netlify y probar con tu repositorio real:

1. Commit y push de los cambios
2. Esperar deployment de Netlify
3. Abrir el admin panel
4. Hacer clic en "Escanear Imágenes"
5. Verificar que ahora sí encuentra imágenes en uso y sin uso

---

**Fecha**: 3 de octubre de 2025
**Estado**: ✅ Corregido y listo para deployment
