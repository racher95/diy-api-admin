# 🧹 Limpieza de Imágenes No Utilizadas

## ¿Qué hace esta herramienta?

La herramienta de limpieza de imágenes escanea todos los productos y categorías de tu API para identificar qué imágenes están siendo utilizadas, luego compara con las imágenes almacenadas en la carpeta `/img` del repositorio y elimina las que no están siendo referenciadas por ningún producto o categoría.

## Características

✅ **Escaneo Completo**: Analiza todos los productos, categorías, categorías promocionales (Featured, Hot Sales) y productos relacionados.

✅ **Modo Prueba**: Primero puedes ejecutar un escaneo sin eliminar nada para ver qué imágenes serían eliminadas.

✅ **Reporte Detallado**: Muestra exactamente qué imágenes están en uso y cuáles no.

✅ **Tracking de Uso**: Indica qué productos/categorías están usando cada imagen.

## Cómo usar

### 1. Escanear Imágenes (Modo Prueba)

Primero, **siempre ejecuta un escaneo en modo prueba**:

1. Haz clic en el botón **"🔍 Escanear Imágenes (Modo Prueba)"**
2. Espera a que complete el escaneo (puede tomar unos segundos)
3. Revisa el reporte detallado:
   - **Total de Imágenes**: Cantidad total en la carpeta `/img`
   - **En Uso**: Imágenes que están siendo utilizadas
   - **Sin Uso**: Imágenes que no están siendo referenciadas

### 2. Revisar Resultados

El reporte incluye tres pestañas:

- **🗑️ Sin Uso**: Lista de imágenes que serían eliminadas
- **✅ En Uso**: Lista de imágenes que se conservarán (muestra dónde se usan)
- **❌ Errores**: Errores durante el proceso (si los hay)

### 3. Eliminar Imágenes No Utilizadas

Una vez revisado el reporte en modo prueba:

1. Haz clic en **"🗑️ Eliminar Imágenes No Utilizadas"**
2. Confirma la acción en el diálogo de confirmación
3. Espera a que complete la eliminación
4. Revisa el reporte final

⚠️ **IMPORTANTE**: La eliminación es **permanente** y **no se puede deshacer**.

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

## Casos de uso comunes

### 1. Limpieza después de reemplazar imágenes

Si subiste nuevas imágenes para reemplazar las antiguas:

1. Actualiza los productos con las nuevas URLs
2. Ejecuta el escaneo en modo prueba
3. Verifica que las imágenes antiguas aparezcan en "Sin Uso"
4. Ejecuta la limpieza para eliminarlas

### 2. Eliminación de productos/categorías

Después de eliminar productos o categorías:

1. Ejecuta el escaneo para identificar imágenes huérfanas
2. Revisa el reporte
3. Limpia las imágenes no utilizadas

### 3. Mantenimiento periódico

Recomendación: Ejecuta esta herramienta mensualmente para:

- Mantener el repositorio limpio
- Evitar acumulación de archivos innecesarios
- Optimizar el tamaño del repositorio

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
