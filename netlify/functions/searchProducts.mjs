import { readJSON } from "./_shared.mjs";

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const params = new URLSearchParams(event.queryStringParameters || {});
    const query = params.get('q') || '';
    const excludeId = parseInt(params.get('exclude')) || null;
    const limit = parseInt(params.get('limit')) || 20;

    // Leer todas las categorías para obtener todos los productos
    const catsResponse = await readJSON("cats/cat.json");
    const categories = catsResponse.json || [];

    const allProducts = [];

    // Recopilar productos de todas las categorías
    for (const category of categories) {
      try {
        const catProductsResponse = await readJSON(`cats_products/${category.id}.json`);
        const catProducts = catProductsResponse.json?.products || [];

        catProducts.forEach(product => {
          // Excluir el producto actual si se especifica
          if (excludeId && product.id === excludeId) {
            return;
          }

          allProducts.push({
            id: product.id,
            name: product.name,
            description: product.description || "",
            cost: product.cost,
            currency: product.currency || "UYU",
            image: product.image,
            category: category.name,
            soldCount: product.soldCount || 0
          });
        });
      } catch (error) {
        console.warn(`Error reading category ${category.id}:`, error);
      }
    }

    // Filtrar productos por query de búsqueda
    let filteredProducts = allProducts;
    
    if (query.trim()) {
      const queryLower = query.toLowerCase();
      filteredProducts = allProducts.filter(product => 
        product.name.toLowerCase().includes(queryLower) ||
        product.description.toLowerCase().includes(queryLower) ||
        product.category.toLowerCase().includes(queryLower)
      );
    }

    // Ordenar por popularidad (soldCount) y limitar resultados
    const results = filteredProducts
      .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
      .slice(0, limit);

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        query,
        total: filteredProducts.length,
        limit,
        products: results
      })
    };

  } catch (error) {
    console.error("Error in searchProducts:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: "Error searching products",
        message: error.message 
      })
    };
  }
}