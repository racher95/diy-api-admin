import { readJSON, writeJSON, deleteFile, listFiles } from "./_shared.mjs";

export async function handler(event) {
  console.log("=== cleanUnusedImages function called ===");
  
  try {
    if (event.httpMethod !== "POST") {
      console.log("Wrong HTTP method:", event.httpMethod);
      return { 
        statusCode: 405, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Method Not Allowed" })
      };
    }

    const { dryRun = true } = JSON.parse(event.body || "{}");
    console.log(`Starting image cleanup (dryRun: ${dryRun})`);

    // 1. Recopilar todas las imágenes en uso
    const imagesInUse = new Set();
    const imageUsage = {}; // Para tracking detallado

    // 1.1. Imágenes de categorías
    try {
      const catsResponse = await readJSON("cats/cat.json");
      const categories = catsResponse.json || [];

      for (const cat of categories) {
        if (cat.imgSrc) {
          const imagePath = extractImagePath(cat.imgSrc);
          if (imagePath) {
            imagesInUse.add(imagePath);
            if (!imageUsage[imagePath]) imageUsage[imagePath] = [];
            imageUsage[imagePath].push({
              type: "category",
              id: cat.id,
              name: cat.name,
            });
          }
        }
      }
      console.log(`Found ${categories.length} categories`);
    } catch (error) {
      console.warn("Error reading categories:", error.message);
    }

    // 1.2. Imágenes de categorías promocionales (featured, hot_sales)
    try {
      const promotionalCategories = [
        "cats/featured.json",
        "cats/hot_sales.json",
      ];
      for (const catPath of promotionalCategories) {
        try {
          const catResponse = await readJSON(catPath);
          const catData = catResponse.json;
          if (catData?.imgSrc) {
            const imagePath = extractImagePath(catData.imgSrc);
            if (imagePath) {
              imagesInUse.add(imagePath);
              if (!imageUsage[imagePath]) imageUsage[imagePath] = [];
              imageUsage[imagePath].push({
                type: "promotional_category",
                name: catData.catName,
                file: catPath,
              });
            }
          }
        } catch (error) {
          console.warn(`Error reading ${catPath}:`, error.message);
        }
      }
    } catch (error) {
      console.warn("Error reading promotional categories:", error.message);
    }

    // 1.3. Imágenes de productos
    let totalProducts = 0;
    try {
      const catsResponse = await readJSON("cats/cat.json");
      const categories = catsResponse.json || [];

      for (const cat of categories) {
        try {
          const catProductsResponse = await readJSON(
            `cats_products/${cat.id}.json`
          );
          const products = catProductsResponse.json?.products || [];

          for (const product of products) {
            totalProducts++;

            // Imagen principal
            if (product.image) {
              const imagePath = extractImagePath(product.image);
              if (imagePath) {
                imagesInUse.add(imagePath);
                if (!imageUsage[imagePath]) imageUsage[imagePath] = [];
                imageUsage[imagePath].push({
                  type: "product",
                  id: product.id,
                  name: product.name,
                  field: "main",
                });
              }
            }

            // Galería de imágenes (si existe en el resumen)
            if (product.images && Array.isArray(product.images)) {
              product.images.forEach((img, index) => {
                const imagePath = extractImagePath(img);
                if (imagePath) {
                  imagesInUse.add(imagePath);
                  if (!imageUsage[imagePath]) imageUsage[imagePath] = [];
                  imageUsage[imagePath].push({
                    type: "product",
                    id: product.id,
                    name: product.name,
                    field: `gallery_${index}`,
                  });
                }
              });
            }

            // Leer detalle completo del producto para obtener todas las imágenes
            try {
              const productDetailResponse = await readJSON(
                `products/${product.id}.json`
              );
              const productDetail = productDetailResponse.json;

              if (
                productDetail?.images &&
                Array.isArray(productDetail.images)
              ) {
                productDetail.images.forEach((img, index) => {
                  const imagePath = extractImagePath(img);
                  if (imagePath) {
                    imagesInUse.add(imagePath);
                    if (!imageUsage[imagePath]) imageUsage[imagePath] = [];
                    imageUsage[imagePath].push({
                      type: "product_detail",
                      id: product.id,
                      name: product.name,
                      field: `image_${index}`,
                    });
                  }
                });
              }

              // Imágenes de productos relacionados
              if (
                productDetail?.relatedProducts &&
                Array.isArray(productDetail.relatedProducts)
              ) {
                productDetail.relatedProducts.forEach((relProd) => {
                  if (relProd.image) {
                    const imagePath = extractImagePath(relProd.image);
                    if (imagePath) {
                      imagesInUse.add(imagePath);
                      if (!imageUsage[imagePath]) imageUsage[imagePath] = [];
                      imageUsage[imagePath].push({
                        type: "related_product",
                        id: product.id,
                        name: product.name,
                        relatedTo: relProd.name,
                      });
                    }
                  }
                });
              }
            } catch (error) {
              console.warn(
                `Error reading product detail ${product.id}:`,
                error.message
              );
            }
          }
        } catch (error) {
          console.warn(
            `Error reading category products ${cat.id}:`,
            error.message
          );
        }
      }
      console.log(`Found ${totalProducts} products`);
    } catch (error) {
      console.warn("Error scanning products:", error.message);
    }

    console.log(`Total images in use: ${imagesInUse.size}`);

    // 2. Listar todas las imágenes en las carpetas images/products e images/cats
    let allImages = [];
    let productsImages = [];
    let catsImages = [];
    
    try {
      console.log("Listing images from images/products...");
      const productsImagesResponse = await listFiles("images/products");
      productsImages = productsImagesResponse.files || [];
      console.log(`  - Products: ${productsImages.length} images`);
    } catch (error) {
      console.error("Error listing products images:", error.message);
      console.error("Error details:", error);
      // Continuar aunque falle esta carpeta
    }
    
    try {
      console.log("Listing images from images/cats...");
      const catsImagesResponse = await listFiles("images/cats");
      catsImages = catsImagesResponse.files || [];
      console.log(`  - Categories: ${catsImages.length} images`);
    } catch (error) {
      console.error("Error listing category images:", error.message);
      console.error("Error details:", error);
      // Continuar aunque falle esta carpeta
    }
    
    allImages = [...productsImages, ...catsImages];
    console.log(`  - Total: ${allImages.length} images`);
    
    // Si no hay imágenes, puede ser un problema de configuración
    if (allImages.length === 0) {
      console.warn("⚠️  No images found in repository. Check folder structure.");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          dryRun,
          timestamp: new Date().toISOString(),
          summary: {
            totalImagesInFolder: 0,
            imagesInUse: 0,
            unusedImages: 0,
            deletedImages: 0,
            errors: 0,
          },
          details: {
            usedImages: [],
            unusedImages: [],
            deletedImages: [],
            errors: [],
          },
          warning: "No images found in images/products or images/cats folders"
        }),
      };
    }

    // 3. Identificar imágenes no utilizadas
    const unusedImages = [];
    const usedImages = [];

    for (const imagePath of allImages) {
      // Extraer solo el nombre del archivo del path completo (por si viene como img/archivo.jpg)
      const fileName = imagePath.includes("/") 
        ? imagePath.split("/").pop() 
        : imagePath;

      if (imagesInUse.has(fileName)) {
        usedImages.push({
          path: imagePath,
          fileName: fileName,
          usedBy: imageUsage[fileName] || [],
        });
      } else {
        unusedImages.push(imagePath);
      }
    }

    console.log(`Images to delete: ${unusedImages.length}`);
    console.log(`Images in use: ${usedImages.length}`);

    // 4. Eliminar imágenes no utilizadas (solo si no es dryRun)
    const deletedImages = [];
    const deletionErrors = [];

    if (!dryRun && unusedImages.length > 0) {
      console.log("Starting deletion of unused images...");

      for (const imagePath of unusedImages) {
        try {
          await deleteFile(imagePath);
          deletedImages.push(imagePath);
          console.log(`Deleted: ${imagePath}`);
        } catch (error) {
          console.error(`Error deleting ${imagePath}:`, error.message);
          deletionErrors.push({
            path: imagePath,
            error: error.message,
          });
        }
      }
    }

    // 5. Generar reporte (optimizado para evitar respuestas muy grandes)
    console.log("Generating report...");
    
    const report = {
      success: true,
      dryRun,
      timestamp: new Date().toISOString(),
      summary: {
        totalImagesInFolder: allImages.length,
        imagesInUse: usedImages.length,
        unusedImages: unusedImages.length,
        deletedImages: dryRun ? 0 : deletedImages.length,
        errors: deletionErrors.length,
      },
      details: {
        // Solo incluir info básica de imágenes en uso (sin detalles completos de uso)
        usedImages: usedImages.map((img) => ({
          path: img.path,
          usageCount: img.usedBy.length,
          // Solo incluir los primeros 3 usos para evitar respuestas muy grandes
          usedBy: img.usedBy.slice(0, 3),
          hasMoreUsages: img.usedBy.length > 3
        })),
        unusedImages: unusedImages,
        deletedImages: dryRun ? [] : deletedImages,
        errors: deletionErrors,
      },
    };

    console.log("Report generated successfully");
    console.log(`Response size estimate: ${JSON.stringify(report).length} bytes`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    };
  } catch (error) {
    console.error("Error in cleanUnusedImages:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
}

// Función helper para extraer el nombre de archivo de imagen desde URLs completas
function extractImagePath(imageUrl) {
  if (!imageUrl) return null;

  try {
    // Si es una URL completa, extraer el nombre del archivo
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const url = new URL(imageUrl);
      const pathname = url.pathname;
      
      // Extraer solo el nombre del archivo (última parte después del último /)
      const parts = pathname.split("/");
      const fileName = parts[parts.length - 1];
      
      if (fileName) {
        return fileName;
      }
    }

    // Si ya es solo un nombre de archivo (sin protocolo ni barras)
    if (!imageUrl.includes("/")) {
      return imageUrl;
    }

    // Si es una ruta relativa (contiene / pero no es URL completa)
    const parts = imageUrl.split("/");
    return parts[parts.length - 1];
    
  } catch (error) {
    console.warn(`Error parsing image URL: ${imageUrl}`, error.message);
    return null;
  }
}
