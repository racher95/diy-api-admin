import { readJSON, writeJSON, deletePath } from "./_shared.mjs";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { id, categoryId } = JSON.parse(event.body || "{}");
    if (!id) {
      return { statusCode: 400, body: "product id required" };
    }

    // Leer producto antes de eliminarlo para obtener imágenes
    let productImages = [];
    try {
      const productResponse = await readJSON(`products/${id}.json`);
      if (productResponse.json?.images) {
        productImages = productResponse.json.images.filter((img) =>
          // Solo eliminar imágenes que están en nuestro repo
          img.includes("racher95.github.io/diy-emercado-api/images/")
        );
      }
    } catch (e) {
      console.warn(`Could not read product ${id} for image cleanup:`, e);
    }

    // 2. ELIMINAR EL ARCHIVO DEL PRODUCTO
    await deletePath(`products/${id}.json`, `DELETE product ${id}`);

    // Eliminar imágenes del repo si corresponde
    for (const imageUrl of productImages) {
      try {
        // Extraer path desde URL
        // https://racher95.github.io/diy-emercado-api/images/products/file.jpg
        // → images/products/file.jpg
        const urlParts = imageUrl.split("/diy-emercado-api/");
        if (urlParts.length > 1) {
          const imagePath = urlParts[1];
          await deletePath(imagePath, `DELETE orphaned image ${imagePath}`);
        }
      } catch (e) {
        console.warn(`Could not delete image ${imageUrl}:`, e);
        // No fallar la operación principal si no se puede eliminar una imagen
      }
    }

    // 4. ACTUALIZAR CATEGORÍA SI SE ESPECIFICA
    if (categoryId) {
      const cpPath = `cats_products/${categoryId}.json`;
      const curCP = await readJSON(cpPath);

      if (curCP.json) {
        const before = curCP.json.products.length;
        curCP.json.products = curCP.json.products.filter((p) => p.id !== id);

        if (curCP.json.products.length !== before) {
          await writeJSON(
            cpPath,
            curCP.json,
            curCP.sha,
            `REMOVE product ${id} from category ${categoryId}`
          );

          // Actualizar contador en cats/cat.json
          const cPath = "cats/cat.json";
          const curC = await readJSON(cPath);
          let cats = curC.json || [];
          const ci = cats.findIndex((c) => c.id === categoryId);

          if (ci >= 0) {
            cats[ci].productCount = curCP.json.products.length;
            await writeJSON(
              cPath,
              cats,
              curC.sha,
              `SYNC category ${categoryId} productCount`
            );
          }
        }
      }
    }

    // 5. ELIMINAR COMENTARIOS SI EXISTEN
    try {
      await deletePath(
        `products_comments/${id}.json`,
        `DELETE comments for product ${id}`
      );
    } catch (e) {
      // Ignorar si no existen comentarios
    }

    // Regenerar índices derivados
    await regenerateDerivedIndices();

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        deletedImages: productImages.length,
      }),
    };
  } catch (e) {
    console.error("Error in deleteProduct:", e);
    return { statusCode: 500, body: String(e) };
  }
}

// Función para regenerar featured.json y hot_sales.json tras eliminar
async function regenerateDerivedIndices() {
  try {
    // Leer todas las categorías para obtener todos los productos
    const catsResponse = await readJSON("cats/cat.json");
    const categories = catsResponse.json || [];

    const allFeatured = [];
    const allFlashSales = [];

    // Procesar cada categoría
    for (const cat of categories) {
      try {
        const catProductsResponse = await readJSON(
          `cats_products/${cat.id}.json`
        );
        const catProducts = catProductsResponse.json?.products || [];

        // Para cada producto, leer su detalle completo para garantizar consistencia
        for (const product of catProducts) {
          try {
            const detailResponse = await readJSON(
              `products/${product.id}.json`
            );
            const detail = detailResponse.json;

            if (!detail) continue;

            // Crear objeto con datos completos para garantizar consistencia
            const fullProductData = {
              id: detail.id,
              name: detail.name,
              description: detail.description,
              cost: detail.cost,
              currency: detail.currency,
              soldCount: detail.soldCount,
              image: detail.images?.[0] || detail.image || product.image,
              category: detail.category,
              // Incluir TODOS los datos especiales para consistencia total
              featured: detail.featured || false,
              stock: detail.stock || 50,
              lowStock: detail.lowStock || false,
              flashSale: detail.flashSale || { active: false },
              updatedAt: detail.updatedAt,
            };

            // Agregar a featured si corresponde
            if (detail.featured) {
              allFeatured.push(fullProductData);
            }

            // Agregar a flash sales si está activo y no ha expirado
            if (detail.flashSale?.active) {
              const now = new Date();
              const startDate = new Date(detail.flashSale.startsAt);
              const endDate = new Date(detail.flashSale.endsAt);

              if (now >= startDate && now <= endDate) {
                // Añadir datos específicos de flash sale
                const flashSaleData = {
                  ...fullProductData,
                  flashPrice: detail.flashSale.price,
                  discount: Math.round(
                    ((detail.cost - detail.flashSale.price) / detail.cost) * 100
                  ),
                };
                allFlashSales.push(flashSaleData);
              }
            }
          } catch (productError) {
            console.error(`Error reading product ${product.id}:`, productError);
          }
        }
      } catch (catError) {
        console.error(`Error reading category ${cat.id}:`, catError);
      }
    }

    // Crear estructura de categoría para Destacados
    const featuredCategory = {
      catName: "Destacados",
      imgSrc: "images/cats/featured.jpg",
      description: "Nuestros productos más populares y recomendados",
      products: allFeatured,
    };

    // Crear estructura de categoría para Hot Sales
    const hotSalesCategory = {
      catName: "Hot Sales!",
      imgSrc: "images/cats/hot_sales.jpg",
      description: "Ofertas por tiempo limitado - ¡No te las pierdas!",
      products: allFlashSales,
    };

    // Guardar en nueva ubicación: /cats/ en lugar de /products/
    const featuredResponse = await readJSON("cats/featured.json");
    await writeJSON(
      "cats/featured.json",
      featuredCategory,
      featuredResponse.sha,
      "UPDATE featured products category after deletion"
    );

    const flashResponse = await readJSON("cats/hot_sales.json");
    await writeJSON(
      "cats/hot_sales.json",
      hotSalesCategory,
      flashResponse.sha,
      "UPDATE hot sales category after deletion"
    );
  } catch (e) {
    console.error("Error regenerating derived indices:", e);
    // No fallar la operación principal si los índices fallan
  }
}
