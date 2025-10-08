// DIY API Admin - JavaScript Functions
// Variables globales
const $ = (s) => document.querySelector(s);
const apiBaseInput = $("#apiBase");
const apiStatus = $("#apiStatus");
const apiDetected = $("#apiDetected");
const repoStructureSection = $("#repoStructureSection");
const repoStructureSummary = $("#repoStructureSummary");
const repoMissingFilesList = $("#repoMissingFiles");
const repoMissingFoldersList = $("#repoMissingFolders");
const repoInvalidColumn = $("#repoInvalidColumn");
const repoInvalidFilesList = $("#repoInvalidFiles");
const initializeRepoBtn = $("#initializeRepo");
const initializeHint = $("#initializeHint");

function clearElement(element) {
  if (!element) return;
  element.replaceChildren();
}

function createElement(tag, { className, text, attrs = {}, children = [] } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child) {
      el.appendChild(child);
    }
  }
  return el;
}

function setText(element, text) {
  if (!element) return;
  element.textContent = text;
}

const FALLBACK_IMAGE_DATA =
  "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"60\" height=\"60\" viewBox=\"0 0 24 24\" fill=\"%23ddd\"><rect width=\"24\" height=\"24\" fill=\"%23f5f5f5\"/><text x=\"12\" y=\"12\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"10\" fill=\"%23999\">IMG</text></svg>";

function formatErrorMessage(message) {
  if (!message) return "Error desconocido";
  if (message === "internal_error") return "Error interno del servidor";
  if (message === "confirmation_required")
    return "Se requiere confirmación";
  if (message === "method_not_allowed") return "Método no permitido";
  return message;
}

function fillList(listElement, items, emptyLabel = "Sin elementos") {
  if (!listElement) return;
  clearElement(listElement);
  if (!items || items.length === 0) {
    listElement.appendChild(createElement("li", { text: emptyLabel }));
    return;
  }

  items.forEach((item) => {
    if (typeof item === "string") {
      listElement.appendChild(createElement("li", { text: item }));
      return;
    }

    const description = item.description
      ? ` – ${item.description}`
      : "";
    listElement.appendChild(
      createElement("li", { text: `${item.path || item} ${description}`.trim() })
    );
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`Respuesta inválida del servidor: ${error.message}`);
    }
  }
  if (!response.ok) {
    const message = payload?.error || `HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

// Variables para almacenar URLs de imágenes
let categoryImageUrl = "";
let productImageUrls = [];

// Variables para productos relacionados
let selectedRelatedProducts = [];
let searchTimeout = null;

// Funciones de utilidad
function getApi() {
  return (localStorage.getItem("DIY_API_BASE") || "").trim();
}

function setApi(v) {
  localStorage.setItem("DIY_API_BASE", v.trim());
}

async function readJSON(path) {
  const base = getApi();
  if (!base) throw new Error("Configura API Base");
  const url = new URL(path, base).toString();
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status + " " + url);
  return await r.json();
}

const readFileAsDataURL = (f) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

// Función para subir múltiples imágenes
async function uploadMultipleImages(files, folder = "images/products") {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const dataUrl = await readFileAsDataURL(file);
    const filename = `${Date.now()}-${i}-${file.name}`;

    try {
      const r = await fetch("/.netlify/functions/uploadImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, filename, dataUrl }),
      });

      if (!r.ok) {
        const errorText = await r.text();
        console.error(`Error HTTP ${r.status}:`, errorText);
        throw new Error(`HTTP ${r.status}: ${errorText}`);
      }

      const result = await r.json();
      if (result.ok) {
        results.push(result.url);
      } else {
        console.error("Upload failed for file:", filename, result);
        throw new Error(result.error || "Upload failed");
      }
    } catch (e) {
      console.error("Error uploading image:", filename, e);
      throw e; // Re-lanzar el error para que se maneje arriba
    }
  }
  return results;
}

// Función para mostrar preview de imágenes
function showImagePreview(urls, containerId, isProduct = false) {
  const container = $(containerId);
  if (!container) return;
  clearElement(container);

  urls.forEach((url, index) => {
    const wrapper = createElement("div", { className: "image-item" });
    const img = createElement("img", {
      attrs: { src: url, alt: `Preview ${index + 1}` },
    });
    img.addEventListener("error", () => {
      img.src = FALLBACK_IMAGE_DATA;
    });

    const removeBtn = createElement("button", {
      className: "remove-btn",
      text: "×",
      attrs: {
        type: "button",
        title: "Eliminar",
        "aria-label": "Eliminar imagen",
      },
    });
    removeBtn.addEventListener("click", () => {
      removeImage(containerId, index, isProduct);
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  });
}

// Función para eliminar imagen del preview
function removeImage(containerId, index, isProduct) {
  if (isProduct) {
    productImageUrls.splice(index, 1);
    showImagePreview(productImageUrls, containerId, true);
    updateProductUrlInputs();
  } else {
    categoryImageUrl = "";
    const container = $(containerId);
    if (container) clearElement(container);
    $("#catImg").value = "";
  }
}

// Función para actualizar los inputs de URL de productos
function updateProductUrlInputs() {
  if (productImageUrls.length > 0) {
    $("#pImg").value = productImageUrls[0] || "";
    $("#pImgs").value = productImageUrls.slice(1).join(", ");
  } else {
    $("#pImg").value = "";
    $("#pImgs").value = "";
  }
}

// === FUNCIONES PARA PRODUCTOS RELACIONADOS ===

// Buscar productos en la API
// Buscar productos relacionados
async function searchProducts(query) {
  console.log("Buscando productos con query:", query);

  // Detectar si es búsqueda por ID
  const isIdSearch = /^\d+$/.test(query.trim());
  const searchType = isIdSearch ? "ID" : "texto";
  console.log(`Tipo de búsqueda: ${searchType}`);

  try {
    const currentProductId = parseInt($("#pId").value) || 0;
    const excludeIds = [
      currentProductId,
      ...selectedRelatedProducts.map((p) => p.id),
    ];

    const response = await fetch("/.netlify/functions/searchProducts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query,
        exclude: excludeIds,
        limit: isIdSearch ? 5 : 10, // Menos resultados para búsqueda por ID
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Resultados de búsqueda:", result);

    if (result.success) {
      renderSearchResults(result.products, { query, isIdSearch });
    } else {
      console.error("Error en searchProducts:", result.error);
      renderSearchResults([]);
    }
  } catch (error) {
    console.error("Error buscando productos:", error);
    renderSearchResults([]);
  }
}

// Renderizar resultados de búsqueda
function renderSearchResults(products, searchInfo = {}) {
  console.log("Renderizando resultados:", products);
  const resultsContainer = $("#searchResults");

  if (!resultsContainer) {
    console.error("No se encontró el contenedor #searchResults");
    return;
  }

  clearElement(resultsContainer);

  if (products.length === 0) {
    const hintText = searchInfo.isIdSearch
      ? `No se encontró ningún producto con ID "${searchInfo.query}"`
      : `No se encontraron productos con "${searchInfo.query}"`;
    const noResults = createElement("div", {
      className: "search-no-results",
      text: hintText,
    });
    resultsContainer.appendChild(noResults);
    resultsContainer.classList.add("show");
    return;
  }

  if (searchInfo.isIdSearch && searchInfo.query) {
    const info = createElement("div", {
      className: "search-info",
      text: `🔍 Búsqueda por ID: ${searchInfo.query}`,
    });
    resultsContainer.appendChild(info);
  }

  products.forEach((product) => {
    const item = createElement("div", {
      className: "search-result-item",
      attrs: { "data-product-id": product.id },
    });

    const img = createElement("img", {
      className: "search-result-image",
      attrs: {
        src: product.image,
        alt: product.name,
      },
    });
    img.addEventListener("error", () => {
      img.src = FALLBACK_IMAGE_DATA;
    });

    const info = createElement("div", { className: "search-result-info" });
    const nameHeading = createElement("h4", { className: "search-result-name" });
    nameHeading.appendChild(document.createTextNode(product.name));
    const idBadge = createElement("span", {
      className: "product-id",
      text: `#${product.id}`,
    });
    nameHeading.appendChild(document.createTextNode(" "));
    nameHeading.appendChild(idBadge);

    const meta = createElement("p", { className: "search-result-meta" });
    meta.appendChild(document.createTextNode(`${product.category} • `));
    const price = createElement("span", {
      className: "search-result-price",
      text: `$${product.cost.toLocaleString()} ${product.currency}`,
    });
    meta.appendChild(price);

    info.appendChild(nameHeading);
    info.appendChild(meta);

    const addButton = createElement("button", {
      className: "search-result-add-btn",
      text: "➕ Agregar",
      attrs: { type: "button" },
    });
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      addRelatedProduct(product);
    });

    item.appendChild(img);
    item.appendChild(info);
    item.appendChild(addButton);
    resultsContainer.appendChild(item);
  });

  resultsContainer.classList.add("show");
}

// Agregar producto a la lista de relacionados
function addRelatedProduct(product) {
  // Verificar que no esté ya seleccionado
  if (selectedRelatedProducts.find((p) => p.id === product.id)) {
    alert("Este producto ya está en la lista de relacionados");
    return;
  }

  // Verificar que no sea el mismo producto que estamos editando
  const currentProductId = parseInt($("#pId").value);
  if (currentProductId && product.id === currentProductId) {
    alert("No puedes agregar el mismo producto como relacionado");
    return;
  }

  selectedRelatedProducts.push(product);
  renderSelectedRelatedProducts();

  // Limpiar búsqueda
  $("#relatedSearch").value = "";
  $("#searchResults").classList.remove("show");
}

// Remover producto de la lista de relacionados
function removeRelatedProduct(productId) {
  selectedRelatedProducts = selectedRelatedProducts.filter(
    (p) => p.id !== productId
  );
  renderSelectedRelatedProducts();
}

// Renderizar lista de productos relacionados seleccionados
function renderSelectedRelatedProducts() {
  const container = $("#selectedRelated");

  clearElement(container);

  if (selectedRelatedProducts.length === 0) {
    const empty = createElement("p", {
      className: "empty-state",
      text: "No hay productos relacionados seleccionados",
    });
    container.appendChild(empty);
    return;
  }

  const count = createElement("div", {
    className: "related-products-count",
    text: `${selectedRelatedProducts.length} producto(s) relacionado(s)`,
  });
  container.appendChild(count);

  selectedRelatedProducts.forEach((product) => {
    const item = createElement("div", { className: "related-product-item" });

    const img = createElement("img", {
      className: "related-product-image",
      attrs: { src: product.image, alt: product.name },
    });
    img.addEventListener("error", () => {
      img.src = FALLBACK_IMAGE_DATA;
    });

    const info = createElement("div", { className: "related-product-info" });
    const title = createElement("h4", {
      className: "related-product-name",
      text: product.name,
    });
    const meta = createElement("p", {
      className: "related-product-meta",
      text: `${product.category} • $${product.cost.toLocaleString()} ${product.currency}`,
    });
    info.appendChild(title);
    info.appendChild(meta);

    const removeBtn = createElement("button", {
      className: "remove-related-btn",
      text: "Remover",
      attrs: { type: "button" },
    });
    removeBtn.addEventListener("click", () => {
      removeRelatedProduct(product.id);
    });

    item.appendChild(img);
    item.appendChild(info);
    item.appendChild(removeBtn);

    container.appendChild(item);
  });
}


// Cargar productos relacionados desde datos existentes
function loadRelatedProducts(relatedProducts) {
  selectedRelatedProducts = relatedProducts || [];
  renderSelectedRelatedProducts();
}

const initializeButtonDefaultLabel = initializeRepoBtn?.textContent || "Crear estructura inicial";

async function refreshRepoStructure() {
  if (!repoStructureSection) return;

  repoStructureSection.hidden = false;
  setText(repoStructureSummary, "Revisando estructura…");
  fillList(repoMissingFilesList, []);
  fillList(repoMissingFoldersList, []);
  if (repoInvalidFilesList) fillList(repoInvalidFilesList, []);
  if (repoInvalidColumn) repoInvalidColumn.hidden = true;
  toggleInitializeButton({ disabled: true, hidden: true });
  if (initializeHint) initializeHint.hidden = true;

  try {
    const report = await fetchJson("/.netlify/functions/checkRepo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    renderRepoStructureReport(report);
  } catch (error) {
    renderRepoStructureError(
      formatErrorMessage(error.message) || "No se pudo verificar el repositorio"
    );
  }
}

function renderRepoStructureReport(report) {
  if (!repoStructureSection) return;
  if (!report?.success) {
    renderRepoStructureError("El servidor no devolvió un estado válido");
    return;
  }

  const missingFiles = report.files?.missing || [];
  const missingFolders = report.folders?.missing || [];
  const invalidFiles = report.files?.invalid || [];

  const initialized = Boolean(report.initialized);

  if (initialized) {
    setText(repoStructureSummary, "Estructura lista ✔");
    fillList(repoMissingFilesList, [], "Sin pendientes");
    fillList(repoMissingFoldersList, [], "Sin pendientes");
    if (invalidFiles.length > 0 && repoInvalidFilesList) {
      if (repoInvalidColumn) repoInvalidColumn.hidden = false;
      fillList(repoInvalidFilesList, invalidFiles, "Sin archivos inválidos");
    } else if (repoInvalidColumn) {
      repoInvalidColumn.hidden = true;
    }
    toggleInitializeButton({ hidden: true });
    if (initializeHint) initializeHint.hidden = true;
    return;
  }

  const missingSummary = [];
  if (missingFiles.length) {
    missingSummary.push(`${missingFiles.length} archivo(s)`);
  }
  if (missingFolders.length) {
    missingSummary.push(`${missingFolders.length} carpeta(s)`);
  }

  const summaryText =
    missingSummary.length > 0
      ? `Faltan ${missingSummary.join(" y ")}`
      : "Sin estructura detectada";

  setText(repoStructureSummary, `⚠️ ${summaryText}`);
  fillList(repoMissingFilesList, missingFiles, "Sin pendientes");
  fillList(repoMissingFoldersList, missingFolders, "Sin pendientes");

  if (invalidFiles.length > 0 && repoInvalidFilesList) {
    if (repoInvalidColumn) repoInvalidColumn.hidden = false;
    fillList(repoInvalidFilesList, invalidFiles, "Sin archivos inválidos");
  } else if (repoInvalidColumn) {
    repoInvalidColumn.hidden = true;
  }

  toggleInitializeButton({ disabled: false, hidden: false });
  if (initializeHint) initializeHint.hidden = false;
}

function renderRepoStructureError(message) {
  if (!repoStructureSection) return;
  repoStructureSection.hidden = false;
  setText(repoStructureSummary, `❌ ${formatErrorMessage(message)}`);
  fillList(repoMissingFilesList, [], "Sin información disponible");
  fillList(repoMissingFoldersList, [], "Sin información disponible");
  if (repoInvalidFilesList) fillList(repoInvalidFilesList, []);
  if (repoInvalidColumn) repoInvalidColumn.hidden = true;
  toggleInitializeButton({ disabled: true, hidden: false });
  if (initializeHint) initializeHint.hidden = false;
}

function toggleInitializeButton({ disabled = false, hidden = false }) {
  if (!initializeRepoBtn) return;
  initializeRepoBtn.disabled = disabled;
  initializeRepoBtn.hidden = hidden;
  if (!hidden && !disabled) {
    initializeRepoBtn.textContent = initializeButtonDefaultLabel;
  }
}

async function initializeRepositoryStructure() {
  if (!initializeRepoBtn) return;
  initializeRepoBtn.disabled = true;
  initializeRepoBtn.textContent = "Creando estructura…";
  setText(repoStructureSummary, "Creando estructura inicial…");

  try {
    const response = await fetchJson("/.netlify/functions/initializeRepo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });

    if (!response?.success) {
      throw new Error(response?.error || "No se pudo inicializar");
    }

    setText(
      repoStructureSummary,
      "Estructura creada. Verificando nuevamente…"
    );
    await refreshRepoStructure();
  } catch (error) {
    renderRepoStructureError(
      formatErrorMessage(error.message) || "Error al crear la estructura"
    );
  } finally {
    initializeRepoBtn.disabled = false;
    initializeRepoBtn.textContent = initializeButtonDefaultLabel;
  }
}

// Inicialización cuando se carga el DOM
document.addEventListener("DOMContentLoaded", function () {
  // Cargar API Base desde localStorage
  apiBaseInput.value = getApi();

  // Event listeners para API
  $("#testApi").onclick = async () => {
    const base = apiBaseInput.value.trim();
    if (!base) {
      apiStatus.textContent = "Ingresa la URL base";
      return;
    }

    apiStatus.textContent = "Probando…";
    if (repoStructureSection) {
      repoStructureSection.hidden = true;
    }
    try {
      const r = await fetch(new URL("cats/cat.json", base).toString(), {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(r.status);
      const cats = await r.json();
      setApi(base);
      apiStatus.textContent = "Conectado ✔";
      apiDetected.textContent = Array.isArray(cats)
        ? `${cats.length} categorías`
        : "OK";
      await refreshRepoStructure();
    } catch (e) {
      apiStatus.textContent = "No se pudo leer cats/cat.json (" + e + ")";
      apiDetected.textContent = "";
      if (repoStructureSection) {
        repoStructureSection.hidden = true;
      }
    }
  };

  if (initializeRepoBtn) {
    initializeRepoBtn.addEventListener("click", () => {
      initializeRepositoryStructure();
    });
  }

  // Event listeners para subida de imagen única
  $("#upload").onclick = async () => {
    const file = $("#file").files[0];
    if (!file) {
      $("#uploadStatus").textContent = "Elegí un archivo";
      return;
    }
    const dataUrl = await readFileAsDataURL(file);
    $("#preview").src = dataUrl;

    const folder = $("#folder").value.trim() || "images/products";
    const filename = $("#filename").value.trim() || file.name;
    $("#uploadStatus").textContent = "Subiendo…";

    try {
      const uploadResult = await fetchJson("/.netlify/functions/uploadImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, filename, dataUrl }),
      });

      if (uploadResult?.ok) {
        const statusEl = $("#uploadStatus");
        if (statusEl) {
          clearElement(statusEl);
          statusEl.appendChild(createElement("span", { text: "OK → " }));
          statusEl.appendChild(
            createElement("a", {
              text: uploadResult.url,
              attrs: {
                href: uploadResult.url,
                target: "_blank",
                rel: "noopener noreferrer",
              },
            })
          );
        }
        if (folder.includes("products")) $("#pImg").value = uploadResult.url;
        if (folder.includes("cats")) $("#catImg").value = uploadResult.url;
      } else {
        setText(
          $("#uploadStatus"),
          "Error: No se pudo subir la imagen"
        );
      }
    } catch (error) {
      setText(
        $("#uploadStatus"),
        `Error: ${formatErrorMessage(error.message)}`
      );
    }
  };

  // Event listeners para categorías
  $("#catUrlToggle").onclick = () => {
    const section = $("#catUrlSection");
    section.style.display = section.style.display === "none" ? "block" : "none";
  };

  $("#uploadCatImage").onclick = async () => {
    const file = $("#catImageFile").files[0];
    if (!file) {
      alert("Selecciona una imagen primero");
      return;
    }

    $("#catStatus").textContent = "Subiendo imagen...";

    try {
      const urls = await uploadMultipleImages([file], "images/cats");

      if (urls.length > 0) {
        categoryImageUrl = urls[0];
        $("#catImg").value = categoryImageUrl;
        showImagePreview([categoryImageUrl], "#catImagePreview", false);
        $("#catStatus").textContent = "Imagen subida correctamente";
      } else {
        $("#catStatus").textContent = "No se pudo subir la imagen";
      }
    } catch (error) {
      console.error("Error en uploadCatImage:", error);
      $("#catStatus").textContent = `Error al subir imagen: ${error.message}`;
    }
  };

  $("#loadCat").onclick = async () => {
    try {
      const id = +$("#catId").value;
      if (!id) {
        $("#catPreview").textContent = "Ingresa un ID";
        return;
      }
      const cats = await readJSON("cats/cat.json");
      const found = (cats || []).find((c) => c.id === id);
      if (found) {
        $("#catName").value = found.name || "";
        $("#catDesc").value = found.description || "";
        $("#catImg").value = found.imgSrc || "";
        $("#catPreview").textContent = `ID ${id} → ${found.name} (${
          found.productCount || 0
        } productos)`;

        // Mostrar imagen si existe
        if (found.imgSrc) {
          categoryImageUrl = found.imgSrc;
          showImagePreview([found.imgSrc], "#catImagePreview", false);
        }
      } else {
        $("#catPreview").textContent = "No existe esa categoría (se creará)";
      }
    } catch (e) {
      $("#catPreview").textContent = "Error leyendo cats/cat.json";
    }
  };

  $("#saveCat").onclick = async () => {
    // Usar la imagen cargada o la URL si está disponible
    const imageUrl = categoryImageUrl || $("#catImg").value.trim();

    const payload = {
      id: +$("#catId").value,
      name: $("#catName").value.trim(),
      description: $("#catDesc").value.trim(),
      imgSrc: imageUrl,
    };
    $("#catStatus").textContent = "Guardando…";
    const r = await fetch("/.netlify/functions/upsertCategory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    $("#catStatus").textContent = r.ok
      ? "OK"
      : "Error " + r.status + " " + (await r.text());
  };

  $("#deleteCat").onclick = async () => {
    const id = +$("#catId").value;
    const cascade = $("#cascadeCat").checked;
    if (!id) {
      $("#catStatus").textContent = "Ingresa ID";
      return;
    }
    if (
      !confirm(
        `¿Eliminar categoría ${id}${
          cascade ? " y todos sus productos" : ""
        }? Esta acción no se puede deshacer.`
      )
    )
      return;
    $("#catStatus").textContent = "Eliminando…";
    const r = await fetch("/.netlify/functions/deleteCategory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, cascade }),
    });
    $("#catStatus").textContent = r.ok
      ? "Categoría eliminada"
      : "Error " + r.status + " " + (await r.text());
  };

  // Event listeners para productos
  $("#prodUrlToggle").onclick = () => {
    const section = $("#prodUrlSection");
    section.style.display = section.style.display === "none" ? "block" : "none";
  };

  $("#uploadProdImages").onclick = async () => {
    const files = $("#pImageFiles").files;
    if (files.length === 0) {
      alert("Selecciona al menos una imagen");
      return;
    }

    $("#pStatus").textContent = `Subiendo ${files.length} imagen(es)...`;

    try {
      const urls = await uploadMultipleImages(files, "images/products");

      if (urls.length > 0) {
        productImageUrls = [...productImageUrls, ...urls];
        showImagePreview(productImageUrls, "#prodImagePreview", true);
        updateProductUrlInputs();
        $(
          "#pStatus"
        ).textContent = `${urls.length} imagen(es) subida(s) correctamente`;
      } else {
        $("#pStatus").textContent = "No se pudo subir ninguna imagen";
      }
    } catch (error) {
      console.error("Error en uploadProdImages:", error);
      $("#pStatus").textContent = `Error al subir imágenes: ${error.message}`;
    }
  };

  $("#loadProd").onclick = async () => {
    const pid = +$("#pId").value;
    const catId = +$("#pCatId").value;
    $("#prodPreview").textContent = "Leyendo…";

    try {
      if (pid) {
        try {
          const prod = await readJSON(`products/${pid}.json`);
          $("#pName").value = prod.name || "";
          $("#pDesc").value = prod.description || "";
          $("#pCost").value = prod.cost ?? "";
          $("#pSold").value = prod.soldCount ?? 0;
          $("#pCurr").value = prod.currency || "UYU";
          $("#pImg").value = (prod.images && prod.images[0]) || "";
          $("#pImgs").value = (prod.images || []).slice(1).join(", ");
          if (prod.category) {
            $("#pCatId").value = prod.category.id;
            $("#pCatName").value = prod.category.name || "";
          }

          // Cargar nuevos campos
          $("#pFeatured").checked = prod.featured || false;
          $("#pStock").value = prod.stock ?? 50;
          $("#pLowStock").checked = prod.lowStock || false;

          // Flash Sale
          if (prod.flashSale) {
            $("#pFlashActive").checked = prod.flashSale.active || false;
            $("#pFlashPrice").value = prod.flashSale.price || "";
            $("#pFlashStart").value = prod.flashSale.startsAt
              ? new Date(prod.flashSale.startsAt).toISOString().slice(0, 16)
              : "";
            $("#pFlashEnd").value = prod.flashSale.endsAt
              ? new Date(prod.flashSale.endsAt).toISOString().slice(0, 16)
              : "";

            // Mostrar/ocultar campos de flash sale
            const flashFields = $("#flashSaleFields");
            if (prod.flashSale.active) {
              flashFields.style.display = "block";
            }
          } else {
            $("#pFlashActive").checked = false;
            $("#pFlashPrice").value = "";
            $("#pFlashStart").value = "";
            $("#pFlashEnd").value = "";
            $("#flashSaleFields").style.display = "none";
          }

          $("#prodPreview").textContent = `Producto ${pid} → ${prod.name}`;

          // Mostrar imágenes si existen
          if (prod.images && prod.images.length > 0) {
            productImageUrls = [...prod.images];
            showImagePreview(productImageUrls, "#prodImagePreview", true);
          }

          // Cargar productos relacionados
          loadRelatedProducts(prod.relatedProducts || []);

          return;
        } catch (_e) {}
      }

      if (catId) {
        const catp = await readJSON(`cats_products/${catId}.json`);
        $("#pCatName").value = catp.catName || $("#pCatName").value;
        if (pid && Array.isArray(catp.products)) {
          const comp = catp.products.find((x) => x.id === pid);
          if (comp) {
            $("#pName").value = comp.name || "";
            $("#pDesc").value = comp.description || "";
            $("#pCost").value = comp.cost ?? "";
            $("#pSold").value = comp.soldCount ?? 0;
            $("#pCurr").value = comp.currency || "UYU";
            $("#pImg").value = comp.image || "";
            $(
              "#prodPreview"
            ).textContent = `Producto ${pid} (cat ${catId}) → ${comp.name}`;

            // Mostrar imagen si existe
            if (comp.image) {
              productImageUrls = [comp.image];
              showImagePreview(productImageUrls, "#prodImagePreview", true);
            }
            return;
          }
        }
        $(
          "#prodPreview"
        ).textContent = `Categoría ${catId} → ${catp.catName}. Producto nuevo.`;
      } else {
        $("#prodPreview").textContent =
          "Ingresa al menos ID de producto o categoría";
      }
    } catch (e) {
      $("#prodPreview").textContent = "No se pudo leer JSON (" + e + ")";
    }
  };

  $("#saveProd").onclick = async () => {
    // Usar las imágenes cargadas o las URLs si están disponibles
    const imageUrls =
      productImageUrls.length > 0
        ? productImageUrls
        : [
            $("#pImg").value.trim(),
            ...$("#pImgs")
              .value.split(",")
              .map((s) => s.trim()),
          ].filter(Boolean);
    const mainImage = imageUrls[0] || "";

    // Validaciones robustas
    const validationErrors = [];

    // Campos requeridos
    if (!$("#pId").value) validationErrors.push("ID de producto es requerido");
    if (!$("#pName").value.trim()) validationErrors.push("Nombre es requerido");
    if (!$("#pCost").value || +$("#pCost").value <= 0)
      validationErrors.push("Precio debe ser mayor a 0");
    if (!$("#pCatId").value)
      validationErrors.push("ID de categoría es requerido");
    if (!$("#pCatName").value.trim())
      validationErrors.push("Nombre de categoría es requerido");
    if (!mainImage) validationErrors.push("Al menos una imagen es requerida");

    // Validaciones de precios
    const cost = +$("#pCost").value;
    const flashPrice = $("#pFlashPrice").value
      ? +$("#pFlashPrice").value
      : null;

    if ($("#pFlashActive").checked) {
      if (!flashPrice || flashPrice <= 0) {
        validationErrors.push(
          "Precio de oferta flash es requerido cuando está activa"
        );
      } else if (flashPrice >= cost) {
        validationErrors.push(
          "Precio de oferta debe ser menor al precio principal"
        );
      }

      const startDate = $("#pFlashStart").value;
      const endDate = $("#pFlashEnd").value;

      if (!startDate || !endDate) {
        validationErrors.push(
          "Fechas de inicio y fin son requeridas para ofertas flash"
        );
      } else {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
          validationErrors.push(
            "Fecha de inicio debe ser anterior a fecha de fin"
          );
        }
        if (end <= new Date()) {
          validationErrors.push("Fecha de fin debe ser en el futuro");
        }
      }
    }

    // Validaciones de stock
    const stock = +$("#pStock").value;
    if (stock < 0) {
      validationErrors.push("Stock no puede ser negativo");
    }

    // Mostrar errores si los hay
    if (validationErrors.length > 0) {
      const statusEl = $("#pStatus");
      if (statusEl) {
        clearElement(statusEl);
        statusEl.appendChild(
          createElement("span", {
            className: "error-heading",
            text: "❌ Errores:",
          })
        );
        const list = createElement("ul", { className: "error-list" });
        validationErrors.forEach((err) => {
          list.appendChild(createElement("li", { text: err }));
        });
        statusEl.appendChild(list);
      }
      return;
    }

    const payload = {
      op: "upsert",
      product: {
        id: +$("#pId").value,
        name: $("#pName").value.trim(),
        description: $("#pDesc").value.trim(),
        cost: cost,
        currency: ($("#pCurr").value || "UYU").trim(),
        soldCount: +$("#pSold").value || 0,
        image: mainImage,
        images: imageUrls,
        categoryId: +$("#pCatId").value,
        categoryName: $("#pCatName").value.trim(),

        // Campos adicionales
        featured: $("#pFeatured").checked,
        stock: +$("#pStock").value || 50,
        lowStock: $("#pLowStock").checked,
        flashSale: {
          active: $("#pFlashActive").checked,
          price: $("#pFlashPrice").value ? +$("#pFlashPrice").value : null,
          startsAt: $("#pFlashStart").value
            ? new Date($("#pFlashStart").value).toISOString()
            : null,
          endsAt: $("#pFlashEnd").value
            ? new Date($("#pFlashEnd").value).toISOString()
            : null,
        },
        updatedAt: new Date().toISOString(),
      },
      relatedProductIds: selectedRelatedProducts.map((p) => p.id),
    };

    console.log("Enviando payload con productos relacionados:", {
      relatedProductIds: selectedRelatedProducts.map((p) => p.id),
      selectedProducts: selectedRelatedProducts.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    });

    setText($("#pStatus"), "Guardando…");
    try {
      await fetchJson("/.netlify/functions/upsertProduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setText($("#pStatus"), "OK");
    } catch (error) {
      setText(
        $("#pStatus"),
        `Error: ${formatErrorMessage(error.message)}`
      );
    }
  };

  const resetButton = $("#resetProd");
  if (resetButton) {
    resetButton.onclick = () => {
      resetForm();
      const preview = $("#prodPreview");
      if (preview) {
        preview.textContent = "Formulario listo para crear un nuevo producto.";
      }
    };
  }

  $("#deleteProd").onclick = async () => {
    const id = +$("#pId").value;
    const categoryId = +$("#pCatId").value || undefined;
    if (!id) {
      $("#pStatus").textContent = "Ingresa product ID";
      return;
    }
    if (!confirm(`¿Eliminar producto ${id}? Esta acción no se puede deshacer.`))
      return;
    setText($("#pStatus"), "Eliminando…");
    try {
      await fetchJson("/.netlify/functions/deleteProduct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, categoryId }),
      });
      setText($("#pStatus"), "Producto eliminado");
    } catch (error) {
      setText(
        $("#pStatus"),
        `Error: ${formatErrorMessage(error.message)}`
      );
    }
  };

  // Funcionalidad para toggle de flash sale
  function toggleFlashSaleFields() {
    const flashFields = $("#flashSaleFields");
    const toggle = $("#pFlashActive");
    if (!flashFields || !toggle) return;

    if (toggle.checked) {
      flashFields.style.display = "block";
      flashFields.classList.add("show");
    } else {
      flashFields.style.display = "none";
      flashFields.classList.remove("show");
      $("#pFlashPrice").value = "";
      $("#pFlashStart").value = "";
      $("#pFlashEnd").value = "";
    }
  }

  const flashToggle = $("#pFlashActive");
  if (flashToggle) {
    flashToggle.onchange = toggleFlashSaleFields;
  }

  toggleFlashSaleFields();

  // Funcionalidad para reset de formulario
function resetForm() {
    // Limpiar campos básicos
    $("#pId").value = "";
    $("#pName").value = "";
    $("#pDesc").value = "";
    $("#pCost").value = "";
    $("#pImg").value = "";
    $("#pImgs").value = "";
    $("#pCatId").value = "";
    $("#pCatName").value = "";
    clearElement($("#pStatus"));

    // Limpiar campos de promoción
    $("#pFeatured").checked = false;
    $("#pFlashActive").checked = false;
    $("#pFlashPrice").value = "";
    $("#pFlashStart").value = "";
    $("#pFlashEnd").value = "";
    $("#pStock").value = "";
    $("#pLowStock").checked = false;

    // Limpiar imágenes cargadas
    productImageUrls = [];
    const previewContainer = $("#prodImagePreview");
    if (previewContainer) clearElement(previewContainer);

    // Limpiar productos relacionados
    selectedRelatedProducts = [];
    renderSelectedRelatedProducts();

    // Ocultar campos de flash sale
    toggleFlashSaleFields();
}

function renderCleanupResults(result) {
  const resultsDiv = $("#cleanupResults");
  if (!resultsDiv) return;
  clearElement(resultsDiv);

  const summary = createElement("div", { className: "results-summary" });
  summary.appendChild(
    createElement("h3", {
      text: `📊 Resumen del ${result.dryRun ? "Escaneo" : "Limpieza"}`,
    })
  );

  const grid = createElement("div", { className: "summary-grid" });
  grid.appendChild(
    buildSummaryItem(result.summary.totalImagesInFolder, "Total de Imágenes")
  );
  grid.appendChild(
    buildSummaryItem(result.summary.imagesInUse, "En Uso", "#28a745")
  );
  grid.appendChild(
    buildSummaryItem(result.summary.unusedImages, "Sin Uso", "#ffc107")
  );
  if (!result.dryRun) {
    grid.appendChild(
      buildSummaryItem(result.summary.deletedImages, "Eliminadas", "#dc3545")
    );
  }
  summary.appendChild(grid);
  resultsDiv.appendChild(summary);

  const tabsContainer = createElement("div", { className: "results-tabs" });
  resultsDiv.appendChild(tabsContainer);

  const tabContents = new Map();

  function addTab(key, label, contentElement, isActive = false) {
    const button = createElement("button", {
      className: `tab-button${isActive ? " active" : ""}`,
      text: label,
      attrs: { type: "button", "data-tab": key },
    });
    tabsContainer.appendChild(button);

    const content = createElement("div", {
      className: `tab-content${isActive ? " active" : ""}`,
      attrs: { id: `tab-${key}` },
    });
    content.appendChild(contentElement);
    resultsDiv.appendChild(content);
    tabContents.set(key, content);

    button.addEventListener("click", () => {
      tabsContainer
        .querySelectorAll(".tab-button")
        .forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      tabContents.forEach((node, mapKey) => {
        if (mapKey === key) node.classList.add("active");
        else node.classList.remove("active");
      });
    });
  }

  addTab(
    "unused",
    `🗑️ Sin Uso (${result.details.unusedImages.length})`,
    buildUnusedImagesSection(result.details.unusedImages, result.dryRun),
    true
  );

  addTab(
    "used",
    `✅ En Uso (${result.details.usedImages.length})`,
    buildUsedImagesSection(result.details.usedImages)
  );

  if (result.details.errors.length > 0) {
    addTab(
      "errors",
      `❌ Errores (${result.details.errors.length})`,
      buildErrorsSection(result.details.errors)
    );
  }
}

function buildSummaryItem(value, label, color) {
  const item = createElement("div", { className: "summary-item" });
  const attrs = color ? { style: `color: ${color};` } : {};
  item.appendChild(
    createElement("span", {
      className: "number",
      text: String(value),
      attrs,
    })
  );
  item.appendChild(createElement("span", { className: "label", text: label }));
  return item;
}

function buildUnusedImagesSection(images, dryRun) {
  const container = createElement("div");
  if (images.length === 0) {
    container.appendChild(
      createElement("div", {
        className: "empty-state",
        text: "🎉 No hay imágenes sin uso. ¡Todo limpio!",
      })
    );
    return container;
  }

  const infoBox = createElement("div", { className: "info-box" });
  infoBox.setAttribute("style", "margin-bottom: 20px;");
  const paragraph = createElement("p");
  paragraph.appendChild(
    createElement("strong", {
      text: dryRun
        ? "Estas imágenes NO están siendo utilizadas"
        : "Las siguientes imágenes fueron eliminadas",
    })
  );
  paragraph.appendChild(
    document.createTextNode(
      dryRun
        ? ' por ningún producto o categoría. Haz clic en "Eliminar Imágenes No Utilizadas" para eliminarlas permanentemente.'
        : " exitosamente."
    )
  );
  infoBox.appendChild(paragraph);
  container.appendChild(infoBox);

  const list = createElement("ul", { className: "image-list" });
  images.forEach((imagePath) => {
    const item = createElement("li", { className: "image-item" });
    const info = createElement("div", { className: "image-info" });
    info.appendChild(
      createElement("div", { className: "image-path", text: imagePath })
    );
    const usage = createElement("div", { className: "image-usage" });
    usage.appendChild(
      createElement("span", {
        className: "usage-badge usage-badge-danger",
        text: "No utilizada",
      })
    );
    info.appendChild(usage);
    item.appendChild(info);
    list.appendChild(item);
  });
  container.appendChild(list);
  return container;
}

function buildUsedImagesSection(images) {
  const container = createElement("div");
  if (images.length === 0) {
    container.appendChild(
      createElement("div", {
        className: "empty-state",
        text: "No se encontraron imágenes en uso.",
      })
    );
    return container;
  }

  const infoBox = createElement("div", { className: "info-box" });
  infoBox.setAttribute("style", "margin-bottom: 20px;");
  const paragraph = createElement("p");
  paragraph.appendChild(
    createElement("strong", {
      text: "Estas imágenes están siendo utilizadas",
    })
  );
  paragraph.appendChild(document.createTextNode(" y no serán eliminadas."));
  infoBox.appendChild(paragraph);
  container.appendChild(infoBox);

  const list = createElement("ul", { className: "image-list" });
  images.forEach((img) => {
    const item = createElement("li", { className: "image-item" });
    const info = createElement("div", { className: "image-info" });
    info.appendChild(
      createElement("div", { className: "image-path", text: img.path })
    );

    const usage = createElement("div", { className: "image-usage" });
    usage.appendChild(
      createElement("span", {
        className: "usage-badge",
        text: `${img.usageCount} uso${img.usageCount > 1 ? "s" : ""}`,
      })
    );

    img.usedBy.slice(0, 3).forEach((use) => {
      usage.appendChild(
        createElement("span", {
          className: "usage-badge usage-badge-success",
          text: `${use.type === "product" ? "📦" : "📁"} ${
            use.name || use.id
          }`,
        })
      );
    });

    if (img.usageCount > 3) {
      usage.appendChild(
        createElement("span", {
          className: "usage-badge",
          text: `+${img.usageCount - 3} más`,
        })
      );
    }

    info.appendChild(usage);
    item.appendChild(info);
    list.appendChild(item);
  });
  container.appendChild(list);
  return container;
}

function buildErrorsSection(errors) {
  const container = createElement("div");

  const infoBox = createElement("div", { className: "info-box" });
  infoBox.setAttribute("style", "background: #f8d7da; border-left-color: #dc3545;");
  const paragraph = createElement("p");
  paragraph.appendChild(
    createElement("strong", {
      text: "Se encontraron errores durante la eliminación:",
    })
  );
  infoBox.appendChild(paragraph);
  container.appendChild(infoBox);

  const list = createElement("ul", { className: "image-list" });
  errors.forEach((error) => {
    const item = createElement("li", { className: "image-item" });
    const info = createElement("div", { className: "image-info" });
    info.appendChild(
      createElement("div", { className: "image-path", text: error.path })
    );
    const usage = createElement("div", { className: "image-usage" });
    usage.appendChild(
      createElement("span", {
        className: "usage-badge usage-badge-danger",
        text: `❌ ${error.error}`,
      })
    );
    info.appendChild(usage);
    item.appendChild(info);
    list.appendChild(item);
  });
  container.appendChild(list);
  return container;
}

  // Event listeners para productos relacionados
  const relatedSearchInput = $("#relatedSearch");
  if (relatedSearchInput) {
    relatedSearchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      // Permitir búsqueda si:
      // - Tiene 2+ caracteres (búsqueda de texto normal)
      // - Es un solo dígito (búsqueda por ID)
      const isIdSearch = /^\d+$/.test(query);
      const shouldSearch =
        query.length >= 2 || (query.length === 1 && isIdSearch);

      if (shouldSearch) {
        searchTimeout = setTimeout(() => {
          searchProducts(query);
        }, 300);
      } else {
    const searchContainer = $("#searchResults");
    if (searchContainer) clearElement(searchContainer);
      }
    });
  }

  // ==========================================
  // FUNCIONALIDAD DE LIMPIEZA DE IMÁGENES
  // ==========================================

  let lastScanResults = null;

  // Escanear imágenes en modo prueba
  $("#scanImages").onclick = async () => {
    await performImageCleanup(true); // dryRun = true
  };

  // Eliminar imágenes no utilizadas
  $("#cleanImages").onclick = async () => {
    if (
      !confirm(
        "⚠️ ¿Estás seguro de que deseas eliminar las imágenes no utilizadas?\n\nEsta acción NO se puede deshacer."
      )
    ) {
      return;
    }

    await performImageCleanup(false); // dryRun = false
  };

  async function performImageCleanup(dryRun) {
    const statusDiv = $("#cleanupStatus");
    const resultsDiv = $("#cleanupResults");
    const cleanButton = $("#cleanImages");

    // Mostrar estado de carga
    statusDiv.className = "cleanup-status loading";
    setText(
      statusDiv,
      dryRun
        ? "🔍 Escaneando imágenes y analizando uso..."
        : "🗑️ Eliminando imágenes no utilizadas..."
    );

    // Limpiar resultados previos
    clearElement(resultsDiv);

    // Deshabilitar botones durante el proceso
    $("#scanImages").disabled = true;
    cleanButton.disabled = true;

    try {
      const result = await fetchJson("/.netlify/functions/cleanUnusedImages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });

      if (result.success) {
        lastScanResults = result;

        // Mostrar estado de éxito
        statusDiv.className = "cleanup-status success";
        setText(
          statusDiv,
          dryRun
            ? `✅ Escaneo completado. Se encontraron ${result.summary.unusedImages} imágenes sin uso.`
            : `✅ Limpieza completada. Se eliminaron ${result.summary.deletedImages} imágenes.`
        );

        // Habilitar botón de eliminación si hay imágenes para eliminar
        if (dryRun && result.summary.unusedImages > 0) {
          cleanButton.disabled = false;
        }

        // Mostrar resultados detallados
        renderCleanupResults(result);
      } else {
        throw new Error(result.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error en limpieza de imágenes:", error);
      statusDiv.className = "cleanup-status error";

      // Si fue un modo de eliminación (no dryRun), mostrar advertencia especial
      clearElement(statusDiv);
      if (!dryRun) {
        statusDiv.appendChild(
          createElement("p", {
            className: "cleanup-error-text",
            text: `⚠️ Error de comunicación: ${formatErrorMessage(
              error.message
            )}`,
          })
        );
        statusDiv.appendChild(
          createElement("small", {
            className: "cleanup-warning",
            text: "IMPORTANTE: Las imágenes pueden haberse eliminado correctamente del repositorio, pero hubo un error al recibir la confirmación del servidor. Verifica tu repositorio en GitHub para confirmar.",
          })
        );
      } else {
        statusDiv.appendChild(
          createElement("span", {
            className: "cleanup-error-text",
            text: `❌ Error: ${formatErrorMessage(error.message)}`,
          })
        );
      }
    } finally {
      // Rehabilitar botón de escaneo
      $("#scanImages").disabled = false;
    }
  }

});
