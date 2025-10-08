import { pathExists, readJSON } from "./_shared.mjs";
import { structuredFiles, recommendedFolders } from "./repoSchema.mjs";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  try {
    const foldersReport = await evaluateFolders();
    const filesReport = await evaluateFiles();

    const initialized =
      filesReport.missing.length === 0 && foldersReport.missing.length === 0;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        initialized,
        folders: foldersReport,
        files: filesReport,
      }),
    };
  } catch (error) {
    console.error("Error in checkRepo:", error);
    return internalError();
  }
}

function methodNotAllowed() {
  return {
    statusCode: 405,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: false, error: "method_not_allowed" }),
  };
}

function internalError() {
  return {
    statusCode: 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: false, error: "internal_error" }),
  };
}

async function evaluateFolders() {
  const existing = [];
  const missing = [];

  for (const folder of recommendedFolders) {
    const { exists } = await pathExists(folder);
    if (exists) existing.push(folder);
    else missing.push(folder);
  }

  return { existing, missing };
}

async function evaluateFiles() {
  const existing = [];
  const missing = [];
  const invalid = [];

  for (const entry of structuredFiles) {
    const { exists } = await pathExists(entry.path);
    if (!exists) {
      missing.push({ path: entry.path, description: entry.description });
      continue;
    }

    if (entry.type === "json") {
      try {
        await readJSON(entry.path);
      } catch (error) {
        console.warn(`Invalid JSON detected in ${entry.path}:`, error.message);
        invalid.push({ path: entry.path, description: entry.description });
        continue;
      }
    }

    existing.push(entry.path);
  }

  return { existing, missing, invalid };
}
