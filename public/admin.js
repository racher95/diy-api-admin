// DIY API Admin - JavaScript Functions
// Variables globales
const $ = (s) => document.querySelector(s);
const apiBaseInput = $("#apiBase");
const apiStatus = $("#apiStatus");
const apiDetected = $("#apiDetected");

// Variables para almacenar URLs de imágenes
let categoryImageUrl = "";
let productImageUrls = [];

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
  container.innerHTML = "";

  urls.forEach((url, index) => {
    const div = document.createElement("div");
    div.className = "image-item";
    div.innerHTML = `
      <img src="${url}" alt="Preview ${index + 1}">
      <button class="remove-btn" onclick="removeImage('${containerId}', ${index}, ${isProduct})" title="Eliminar">×</button>
    `;
    container.appendChild(div);
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
    $(containerId).innerHTML = "";
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
    } catch (e) {
      apiStatus.textContent = "No se pudo leer cats/cat.json (" + e + ")";
      apiDetected.textContent = "";
    }
  };

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

    const r = await fetch("/.netlify/functions/uploadImage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, filename, dataUrl }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok) {
      $("#uploadStatus").innerHTML = "OK → " + j.url;
      if (folder.includes("products")) $("#pImg").value = j.url;
      if (folder.includes("cats")) $("#catImg").value = j.url;
    } else {
      $("#uploadStatus").textContent = "Error: " + (j || (await r.text()));
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
      $(
        "#pStatus"
      ).innerHTML = `<span style="color: red;">❌ Errores:<br>• ${validationErrors.join(
        "<br>• "
      )}</span>`;
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
    };
    $("#pStatus").textContent = "Guardando…";
    const r = await fetch("/.netlify/functions/upsertProduct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    $("#pStatus").textContent = r.ok
      ? "OK"
      : "Error " + r.status + " " + (await r.text());
  };

  $("#deleteProd").onclick = async () => {
    const id = +$("#pId").value;
    const categoryId = +$("#pCatId").value || undefined;
    if (!id) {
      $("#pStatus").textContent = "Ingresa product ID";
      return;
    }
    if (!confirm(`¿Eliminar producto ${id}? Esta acción no se puede deshacer.`))
      return;
    $("#pStatus").textContent = "Eliminando…";
    const r = await fetch("/.netlify/functions/deleteProduct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, categoryId }),
    });
    $("#pStatus").textContent = r.ok
      ? "Producto eliminado"
      : "Error " + r.status + " " + (await r.text());
  };

  // Funcionalidad para toggle de flash sale
  $("#pFlashActive").onchange = function () {
    const flashFields = $("#flashSaleFields");
    if (this.checked) {
      flashFields.style.display = "block";
      flashFields.classList.add("show");
    } else {
      flashFields.style.display = "none";
      flashFields.classList.remove("show");
      // Limpiar campos cuando se desactiva
      $("#pFlashPrice").value = "";
      $("#pFlashStart").value = "";
      $("#pFlashEnd").value = "";
    }
  };

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
    $("#pStatus").innerHTML = "";

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
    $("#prodImagePreview").innerHTML = "";

    // Ocultar campos de flash sale
    toggleFlashSaleFields();
  }
});
