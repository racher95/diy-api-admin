// Test para verificar la extracción de nombres de archivo desde URLs

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

// Tests con URLs reales de tu proyecto
const testUrls = [
  "https://racher95.github.io/diy-emercado-api/images/products/1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp",
  "https://example.com/samsung.jpg",
  "img/producto.jpg",
  "producto.jpg",
  "/images/producto.png",
  null,
  ""
];

console.log("=== TEST DE EXTRACCIÓN DE NOMBRES DE ARCHIVO ===\n");

testUrls.forEach((url, index) => {
  const result = extractImagePath(url);
  console.log(`Test ${index + 1}:`);
  console.log(`  Input:  "${url}"`);
  console.log(`  Output: "${result}"`);
  console.log("");
});

// Test específico con tu formato
console.log("=== TESTS ESPECÍFICOS PARA TU FORMATO ===\n");

const realExamples = [
  "https://racher95.github.io/diy-emercado-api/images/products/1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp",
  "https://racher95.github.io/diy-emercado-api/images/categories/categoria1.jpg",
];

realExamples.forEach((url) => {
  const extracted = extractImagePath(url);
  console.log(`URL Original:`);
  console.log(`  ${url}`);
  console.log(`Nombre Extraído:`);
  console.log(`  ${extracted}`);
  console.log(`Este nombre se comparará con los archivos en /img`);
  console.log("");
});

console.log("=== SIMULACIÓN DE COMPARACIÓN ===\n");

// Simular archivos en el repositorio
const filesInRepo = [
  "img/1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp",
  "img/samsung.jpg",
  "img/producto-viejo.jpg",
  "img/categoria1.jpg"
];

// Simular URLs en los JSON
const urlsInJson = [
  "https://racher95.github.io/diy-emercado-api/images/products/1758495432199-0-D_NQ_NP_2X_967917-MLU71371144527_082023-F.webp",
  "https://example.com/samsung.jpg"
];

console.log("Archivos en el repositorio:");
filesInRepo.forEach(f => console.log(`  - ${f}`));
console.log("");

console.log("URLs encontradas en JSONs:");
urlsInJson.forEach(u => console.log(`  - ${u}`));
console.log("");

// Extraer nombres de las URLs
const extractedNames = new Set(
  urlsInJson.map(url => extractImagePath(url)).filter(Boolean)
);

console.log("Nombres extraídos de URLs:");
extractedNames.forEach(n => console.log(`  - ${n}`));
console.log("");

// Identificar cuáles están en uso y cuáles no
console.log("Resultado de comparación:");
filesInRepo.forEach(filePath => {
  const fileName = filePath.split("/").pop();
  const inUse = extractedNames.has(fileName);
  console.log(`  ${fileName}: ${inUse ? "✅ EN USO" : "❌ SIN USO"}`);
});
