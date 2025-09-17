import { readJSON } from "./_shared.mjs";

export async function handler(event) {
  try {
    let query = '';
    let excludeIds = [];
    let limit = 20;

    // Manejar tanto GET como POST
    if (event.httpMethod === "GET") {
      const params = new URLSearchParams(event.queryStringParameters || {});
      query = params.get('q') || '';
      const excludeParam = params.get('exclude');
      excludeIds = excludeParam ? [parseInt(excludeParam)] : [];
      limit = parseInt(params.get('limit')) || 20;
    } else if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || '{}');
      query = body.query || '';
      excludeIds = body.exclude || [];
      limit = body.limit || 20;
    } else {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

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
          // Excluir productos especificados
          if (excludeIds.includes(product.id)) {
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
      const queryAsNumber = parseInt(query);
      const isNumericQuery = !isNaN(queryAsNumber) && queryAsNumber.toString() === query.trim();
      
      filteredProducts = allProducts.filter(product => {
        // Búsqueda por ID (exacta)
        if (isNumericQuery && product.id === queryAsNumber) {
          return true;
        }
        
        // Búsqueda por texto en nombre, descripción o categoría
        return product.name.toLowerCase().includes(queryLower) ||
               product.description.toLowerCase().includes(queryLower) ||
               product.category.toLowerCase().includes(queryLower);
      });
      
      // Si es búsqueda por ID, priorizar el resultado exacto
      if (isNumericQuery) {
        filteredProducts.sort((a, b) => {
          if (a.id === queryAsNumber) return -1;
          if (b.id === queryAsNumber) return 1;
          return (b.soldCount || 0) - (a.soldCount || 0);
        });
      }
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
        success: true,
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
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        success: false,
        error: "Error searching products",
        message: error.message 
      })
    };
  }
}