import { writeFile, owner, repo } from "./_shared.mjs";

const ALLOWED_FOLDERS = new Set(["images/products", "images/cats"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { folder = "images/products", filename, dataUrl } = JSON.parse(
      event.body || "{}"
    );

    if (!filename || !dataUrl) {
      return { statusCode: 400, body: "filename and dataUrl are required" };
    }

    if (!ALLOWED_FOLDERS.has(folder)) {
      return {
        statusCode: 400,
        body: `Folder not allowed. Use one of: ${[...ALLOWED_FOLDERS].join(", ")}`,
      };
    }

    const extension = extractExtension(filename);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return {
        statusCode: 400,
        body: `Unsupported extension ${extension}. Allowed: ${[...
          ALLOWED_EXTENSIONS
        ].join(", ")}`,
      };
    }

    if (filename.includes("/") || filename.includes("..")) {
      return { statusCode: 400, body: "Invalid filename" };
    }

    const base64Payload = getBase64Payload(dataUrl);
    if (!base64Payload) {
      return { statusCode: 400, body: "Invalid dataUrl payload" };
    }

    const buffer = Buffer.from(base64Payload, "base64");
    if (!buffer.length) {
      return { statusCode: 400, body: "Empty file payload" };
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return { statusCode: 400, body: "File exceeds 5MB limit" };
    }

    const path = `${folder}/${filename}`;

    await writeFile(
      path,
      buffer.toString("base64"),
      `UPLOAD image ${path}`
    );

    const publicUrl = `https://${owner}.github.io/${repo}/${path}`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, url: publicUrl, path }),
    };
  } catch (e) {
    console.error("Error uploading image", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "internal_error" }),
    };
  }
}

function extractExtension(filename) {
  const normalised = filename.trim().toLowerCase();
  const idx = normalised.lastIndexOf(".");
  if (idx === -1) return "";
  return normalised.slice(idx);
}

function getBase64Payload(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.trim()) return null;
  const value = dataUrl.trim();
  const parts = value.split(",");
  const payload = parts.length > 1 ? parts[1] : parts[0];
  try {
    const decoded = Buffer.from(payload, "base64");
    if (!decoded.length) {
      return null;
    }
    const normalised = decoded.toString("base64");
    const left = normalised.replace(/=+$/, "");
    const right = payload.replace(/=+$/, "");
    return left === right ? payload : null;
  } catch {
    return null;
  }
}
