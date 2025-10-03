import { Octokit } from "octokit";
const owner = process.env.DATA_OWNER;
const repo = process.env.DATA_REPO;
const branch = process.env.DATA_BRANCH || "main";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
async function readFile(path) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    const content = Buffer.from(data.content, "base64").toString("utf8");
    return { content, sha: data.sha };
  } catch (e) {
    if (e.status === 404) return { content: null, sha: null };
    throw e;
  }
}
async function readJSON(path) {
  const f = await readFile(path);
  return { json: f.content ? JSON.parse(f.content) : null, sha: f.sha };
}
async function writeJSON(path, obj, sha, msg) {
  const content = Buffer.from(JSON.stringify(obj, null, 2)).toString("base64");
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    branch,
    path,
    content,
    message: msg,
    sha: sha || undefined,
  });
}
async function writeFile(path, base64, msg, sha) {
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    branch,
    path,
    content: base64,
    message: msg,
    sha: sha || undefined,
  });
}
async function deletePath(path, msg, sha) {
  const s = sha || (await readFile(path)).sha;
  if (!s) return;
  await octokit.rest.repos.deleteFile({
    owner,
    repo,
    branch,
    path,
    message: msg,
    sha: s,
  });
}
async function deleteFile(path, msg) {
  const { sha } = await readFile(path);
  if (!sha) throw new Error(`File not found: ${path}`);
  await octokit.rest.repos.deleteFile({
    owner,
    repo,
    branch,
    path,
    message: msg || `DELETE ${path}`,
    sha,
  });
}
async function listFiles(folderPath) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: folderPath,
      ref: branch,
    });
    if (!Array.isArray(data)) return { files: [] };
    const files = data
      .filter((item) => item.type === "file")
      .map((item) => item.path);
    return { files };
  } catch (e) {
    if (e.status === 404) return { files: [] };
    throw e;
  }
}
export {
  octokit,
  owner,
  repo,
  branch,
  readJSON,
  writeJSON,
  writeFile,
  deletePath,
  deleteFile,
  listFiles,
};
