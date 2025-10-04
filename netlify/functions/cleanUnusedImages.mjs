import { readJSON, writeJSON, deleteFile, listFiles } from "./_shared.mjs";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
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
    try {
      // Listar imágenes de productos
      const productsImagesResponse = await listFiles("images/products");
      const productsImages = productsImagesResponse.files || [];
      
      // Listar imágenes de categorías
      const catsImagesResponse = await listFiles("images/cats");
      const catsImages = catsImagesResponse.files || [];
      
      allImages = [...productsImages, ...catsImages];
      console.log(`Total images found:`);
      console.log(`  - Products: ${productsImages.length}`);
      console.log(`  - Categories: ${catsImages.length}`);
      console.log(`  - Total: ${allImages.length}`);
    } catch (error) {
      console.error("Error listing images:", error.message);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Could not list images from repository",
          message: error.message,
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

    // 5. Generar reporte
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
        usedImages: usedImages.map((img) => ({
          path: img.path,
          usageCount: img.usedBy.length,
          usedBy: img.usedBy,
        })),
        unusedImages: unusedImages,
        deletedImages: dryRun ? [] : deletedImages,
        errors: deletionErrors,
      },
    };

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
