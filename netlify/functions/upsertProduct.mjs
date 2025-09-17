import { readJSON, writeJSON } from "./_shared.mjs";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const {
      op = "create",
      product,
      relatedProductIds = [],
    } = JSON.parse(event.body || "{}");
    if (!product) {
      return { statusCode: 400, body: "product object required" };
    }

    const {
      id,
      name,
      description = "",
      cost,
      currency = "UYU",
      soldCount = 0,
      image,
      images = [],
      categoryId,
      categoryName,
      // Campos adicionales
      featured = false,
      stock = 50,
      lowStock = false,
      flashSale = {
        active: false,
        price: null,
        startsAt: null,
        endsAt: null,
      },
      updatedAt = new Date().toISOString(),
    } = product;

    if (
      !id ||
      !name ||
      cost === undefined ||
      !image ||
      !categoryId ||
      !categoryName
    ) {
      return { statusCode: 400, body: "missing required product fields" };
    }

    console.log(
      `Processing product ${id} with related products:`,
      relatedProductIds
    );

    // 1. Resolver productos relacionados con datos completos
    const relatedProducts = await resolveRelatedProducts(relatedProductIds);
    console.log(
      `Resolved ${relatedProducts.length} related products for product ${id}`
    );

    // 2. Guardar detalle completo del producto
    const pPath = `products/${id}.json`;
    const curP = await readJSON(pPath);
    const detail = {
      id,
      name,
      description,
      cost,
      currency,
      soldCount,
      category: { id: categoryId, name: categoryName },
      images: images.length ? images : [image],
      relatedProducts,
      // Campos adicionales
      featured,
      stock,
      lowStock,
      flashSale,
      updatedAt,
    };

    await writeJSON(
      pPath,
      detail,
      curP.sha,
      `${op.toUpperCase()} product ${id}`
    );

    // 3. Actualizar resumen en cats_products
    const cpPath = `cats_products/${categoryId}.json`;
    const curCP = await readJSON(cpPath);
    const payload = curCP.json || {
      catID: categoryId,
      catName: categoryName,
      products: [],
    };
    const compact = { id, name, description, cost, currency, soldCount, image };
    const i = payload.products.findIndex((x) => x.id === id);

    if (i >= 0) payload.products[i] = compact;
    else payload.products.push(compact);

    await writeJSON(
      cpPath,
      payload,
      curCP.sha,
      `${op.toUpperCase()} product in category ${categoryId}`
    );

    // 4. Actualizar contador de categorías
    const cPath = "cats/cat.json";
    const curC = await readJSON(cPath);
    let cats = curC.json || [];
    const ci = cats.findIndex((c) => c.id === categoryId);

    if (ci >= 0) {
      cats[ci].name = categoryName;
      cats[ci].productCount = payload.products.length;
    } else {
      cats.push({
        id: categoryId,
        name: categoryName,
        description: "Categoría DIY",
        imgSrc: "",
        productCount: payload.products.length,
      });
    }

    await writeJSON(
      cPath,
      cats,
      curC.sha,
      `SYNC category ${categoryId} productCount`
    );

    // Generar índices derivados
    await generateDerivedIndices();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    console.error("Error in upsertProduct:", e);
    return { statusCode: 500, body: String(e) };
  }
}

// Función para resolver productos relacionados con datos completos
async function resolveRelatedProducts(relatedProductIds) {
  console.log("resolveRelatedProducts called with:", relatedProductIds);

  if (!Array.isArray(relatedProductIds) || relatedProductIds.length === 0) {
    console.log("No related products to resolve");
    return [];
  }

  const relatedProducts = [];

  for (const productId of relatedProductIds) {
    console.log(`Trying to resolve product ID: ${productId}`);
    try {
      const productResponse = await readJSON(`products/${productId}.json`);
      if (productResponse.json) {
        const product = productResponse.json;
        console.log(
          `Successfully resolved product ${productId}: ${product.name}`
        );
        relatedProducts.push({
          id: product.id,
          name: product.name,
          image: product.images?.[0] || product.image || "",
          cost: product.cost,
          currency: product.currency || "UYU",
          category: product.category?.name || product.category || "",
          featured: product.featured || false,
          stock: product.stock || 0,
          addedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn(
        `No se pudo resolver producto relacionado ${productId}:`,
        error.message
      );
      // Continuar con los demás productos relacionados
    }
  }

  console.log(`Final resolved products: ${relatedProducts.length}`);
  return relatedProducts;
}

// Función para generar featured.json y hot_sales.json
async function generateDerivedIndices() {
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
      "UPDATE featured products category"
    );

    const flashResponse = await readJSON("cats/hot_sales.json");
    await writeJSON(
      "cats/hot_sales.json",
      hotSalesCategory,
      flashResponse.sha,
      "UPDATE hot sales category"
    );
  } catch (e) {
    console.error("Error generating derived indices:", e);
    // No fallar la operación principal si los índices fallan
  }
}
