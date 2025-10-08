import {
  commitRepoChanges,
  pathExists,
} from "./_shared.mjs";
import { structuredFiles, recommendedFolders } from "./repoSchema.mjs";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  try {
    const request = JSON.parse(event.body || "{}") || {};
    const { confirm = false } = request;
    if (!confirm) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "confirmation_required" }),
      };
    }

    const writes = [];
    const created = [];
    const skipped = [];

    for (const folder of recommendedFolders) {
      const { exists } = await pathExists(folder);
      if (exists) {
        skipped.push({ path: folder, reason: "exists" });
        continue;
      }
      const placeholderPath = `${folder}/.gitkeep`;
      writes.push({ path: placeholderPath, content: "placeholder" });
      created.push(placeholderPath);
    }

    for (const entry of structuredFiles) {
      const { exists } = await pathExists(entry.path);
      if (exists) {
        skipped.push({ path: entry.path, reason: "exists" });
        continue;
      }

      const content = entry.type === "json"
        ? entry.defaultContent
        : entry.defaultContent;

      writes.push({ path: entry.path, content });
      created.push(entry.path);
    }

    if (writes.length === 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          message: "Structure already initialized",
          created,
          skipped,
          committed: false,
        }),
      };
    }

    const result = await commitRepoChanges(
      { writes },
      "chore: bootstrap DIY API data structure"
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        created,
        skipped,
        committed: result.committed,
        commitSha: result.sha || null,
      }),
    };
  } catch (error) {
    console.error("Error in initializeRepo:", error);
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
