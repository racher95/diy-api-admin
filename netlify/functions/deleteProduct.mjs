import { readJSON, commitRepoChanges, owner, repo } from "./_shared.mjs";
import { generateDerivedIndices } from "./upsertProduct.mjs";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { id, categoryId } = JSON.parse(event.body || "{}");
    if (!id) {
      return { statusCode: 400, body: "product id required" };
    }

    const writes = [];
    const deletes = new Set([`products/${id}.json`]);
    const pendingWrites = new Map();
    const deletedPaths = new Set([`products/${id}.json`]);
    const enqueueWrite = (path, content) => {
      writes.push({ path, content });
      pendingWrites.set(path, content);
    };
    const enqueueDelete = (path) => {
      deletes.add(path);
      deletedPaths.add(path);
    };

    const repoHost = `https://${owner}.github.io/${repo}/`;
    const resolveImagePath = (rawPath) => {
      if (typeof rawPath !== "string" || !rawPath.trim()) return null;
      const value = rawPath.trim();
      if (value.startsWith(repoHost)) {
        const relative = value.slice(repoHost.length);
        if (relative && !relative.includes("..")) {
          return relative.replace(/^\/+/, "");
        }
        return null;
      }

      if (!value.includes("://")) {
        const cleaned = value.replace(/^\/+/, "");
        if (cleaned.startsWith("images/")) {
          return cleaned;
        }
      }

      return null;
    };

    // Leer producto antes de eliminarlo para obtener imágenes
    const productResponse = await readJSON(`products/${id}.json`);
    const imageDeletes = new Set();
    const productDetail = productResponse.json || {};
    if (productDetail.image) {
      const resolved = resolveImagePath(productDetail.image);
      if (resolved) imageDeletes.add(resolved);
    }
    if (Array.isArray(productDetail.images)) {
      for (const imageUrl of productDetail.images) {
        const resolved = resolveImagePath(imageUrl);
        if (resolved) imageDeletes.add(resolved);
      }
    }

    // 4. ACTUALIZAR CATEGORÍA SI SE ESPECIFICA
    const effectiveCategoryId =
      categoryId || productDetail.category?.id || productDetail.categoryId;
    if (effectiveCategoryId) {
      const cpPath = `cats_products/${effectiveCategoryId}.json`;
      const curCP = await readJSON(cpPath);

      if (curCP.json) {
        const before = curCP.json.products.length;
        curCP.json.products = curCP.json.products.filter((p) => p.id !== id);

        if (curCP.json.products.length !== before) {
          enqueueWrite(cpPath, curCP.json);

          // Actualizar contador en cats/cat.json
          const cPath = "cats/cat.json";
          const curC = await readJSON(cPath);
          let cats = curC.json || [];
          const ci = cats.findIndex((c) => c.id === effectiveCategoryId);

          if (ci >= 0) {
            cats[ci].productCount = curCP.json.products.length;
            enqueueWrite(cPath, cats);
          }
        }
      }
    }

    // 5. ELIMINAR COMENTARIOS SI EXISTEN
    const commentsPath = `products_comments/${id}.json`;
    const existingComments = await readJSON(commentsPath);
    if (existingComments.sha) {
      enqueueDelete(commentsPath);
    }

    for (const path of imageDeletes) {
      enqueueDelete(path);
    }

    const derivedWrites = await generateDerivedIndices({
      pendingWrites,
      deletedPaths,
    });
    for (const entry of derivedWrites) {
      enqueueWrite(entry.path, entry.content);
    }

    await commitRepoChanges(
      { writes, deletes: Array.from(deletes) },
      `DELETE product ${id} and related data`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        deletedImages: imageDeletes.size,
      }),
    };
  } catch (e) {
    console.error("Error in deleteProduct:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "internal_error" }),
    };
  }
}

// Función para regenerar featured.json y hot_sales.json tras eliminar
