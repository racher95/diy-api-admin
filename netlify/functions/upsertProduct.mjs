import { readJSON, writeJSON } from "./_shared.mjs";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { op = "create", product } = JSON.parse(event.body || "{}");
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

    // 1. Guardar detalle completo del producto
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
      relatedProducts: curP.json?.relatedProducts || [],
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

    // 2. Actualizar resumen en cats_products
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

    // 3. Actualizar contador de categorías
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

// Función para generar featured.json y flash_sales.json
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

        // Para cada producto, leer su detalle completo
        for (const product of catProducts) {
          try {
            const detailResponse = await readJSON(
              `products/${product.id}.json`
            );
            const detail = detailResponse.json;

            if (!detail) continue;

            // Agregar a featured si corresponde
            if (detail.featured) {
              allFeatured.push({
                id: detail.id,
                name: detail.name,
                description: detail.description,
                cost: detail.cost,
                currency: detail.currency,
                soldCount: detail.soldCount,
                image: detail.images?.[0] || detail.image || product.image,
                category: detail.category,
                stock: detail.stock,
                lowStock: detail.lowStock,
                updatedAt: detail.updatedAt,
              });
            }

            // Agregar a flash sales si corresponde
            if (detail.flashSale?.active) {
              allFlashSales.push({
                id: detail.id,
                name: detail.name,
                description: detail.description,
                originalPrice: detail.cost,
                flashPrice: detail.flashSale.price,
                savings: detail.cost - (detail.flashSale.price || 0),
                currency: detail.currency,
                soldCount: detail.soldCount,
                image: detail.images?.[0] || detail.image || product.image,
                category: detail.category,
                flashSale: detail.flashSale,
                stock: detail.stock,
                lowStock: detail.lowStock,
                updatedAt: detail.updatedAt,
              });
            }
          } catch (e) {
            console.warn(`Error reading product ${product.id}:`, e);
          }
        }
      } catch (e) {
        console.warn(`Error reading category ${cat.id}:`, e);
      }
    }

    // Escribir índices derivados
    const featuredResponse = await readJSON("products/featured.json");
    await writeJSON(
      "products/featured.json",
      allFeatured,
      featuredResponse.sha,
      "UPDATE featured products index"
    );

    const flashResponse = await readJSON("products/flash_sales.json");
    await writeJSON(
      "products/flash_sales.json",
      allFlashSales,
      flashResponse.sha,
      "UPDATE flash sales index"
    );
  } catch (e) {
    console.error("Error generating derived indices:", e);
    // No fallar la operación principal si los índices fallan
  }
}
