const structuredFiles = [
  {
    path: "cats/cat.json",
    type: "json",
    description: "Listado principal de categorías",
    defaultContent: [],
  },
  {
    path: "cats/featured.json",
    type: "json",
    description: "Categoría virtual para productos destacados",
    defaultContent: {
      catName: "Destacados",
      imgSrc: "images/cats/featured.jpg",
      description: "Nuestros productos más populares y recomendados",
      products: [],
    },
  },
  {
    path: "cats/hot_sales.json",
    type: "json",
    description: "Categoría virtual para promociones flash",
    defaultContent: {
      catName: "Hot Sales!",
      imgSrc: "images/cats/hot_sales.jpg",
      description: "Ofertas por tiempo limitado - ¡No te las pierdas!",
      products: [],
    },
  },
  {
    path: "README.md",
    type: "text",
    description: "Documentación básica del repositorio de datos",
    defaultContent: `# DIY API Data Repo\n\nEste repositorio almacena los archivos JSON e imágenes utilizados por el panel DIY API Admin.\n\n## Estructura inicial\n- cats/cat.json: listado de categorías.\n- cats/featured.json y cats/hot_sales.json: categorías derivadas generadas por el panel.\n- cats_products/: resumen de productos por categoría.\n- products/: detalle completo de cada producto.\n- products_comments/: comentarios de productos.\n- images/: imágenes subidas desde el panel.\n\n> Los archivos y carpetas adicionales se crearán automáticamente a medida que interactúes con el panel.\n`,
  },
];

const recommendedFolders = [
  "cats",
  "cats_products",
  "products",
  "products_comments",
  "images",
  "images/products",
  "images/cats",
];

export { structuredFiles, recommendedFolders };
