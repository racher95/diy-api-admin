import { Octokit } from "octokit";

const owner = process.env.DATA_OWNER;
const repo = process.env.DATA_REPO;
const branch = process.env.DATA_BRANCH || "main";
const token = process.env.GITHUB_TOKEN;

if (!owner || !repo) {
  throw new Error("DATA_OWNER and DATA_REPO environment variables are required");
}

if (!token) {
  throw new Error("GITHUB_TOKEN environment variable is required");
}

const octokit = new Octokit({ auth: token });

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

function normaliseContent(content) {
  if (content === undefined || content === null) return "";
  return typeof content === "string"
    ? content
    : JSON.stringify(content, null, 2);
}

async function pathExists(targetPath) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: targetPath,
      ref: branch,
    });
    const type = Array.isArray(data) ? "dir" : data.type;
    return { exists: true, type };
  } catch (error) {
    if (error.status === 404) {
      return { exists: false, type: null };
    }
    throw error;
  }
}

async function commitRepoChanges({ writes = [], deletes = [] }, message) {
  if (!writes.length && !deletes.length) {
    return { committed: false };
  }

  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const currentCommitSha = refData.object.sha;

  const { data: commitData } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: currentCommitSha,
  });

  const baseTreeSha = commitData.tree.sha;

  const uniqueWrites = Array.from(
    writes.reduce((map, entry) => map.set(entry.path, entry), new Map()).values()
  );

  const deleteSet = new Set(
    (deletes || []).filter(
      (path) => !uniqueWrites.some((entry) => entry.path === path)
    )
  );

  const treeItems = [
    ...uniqueWrites.map(({ path, content, mode = "100644", type = "blob" }) => ({
      path,
      mode,
      type,
      content: normaliseContent(content),
    })),
    ...Array.from(deleteSet).map((path) => ({
      path,
      mode: "100644",
      type: "blob",
      sha: null,
    })),
  ];

  const { data: tree } = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  if (tree.sha === baseTreeSha) {
    return { committed: false, sha: currentCommitSha };
  }

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.sha,
    parents: [currentCommitSha],
  });

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });

  return { committed: true, sha: newCommit.sha };
}

export {
  octokit,
  owner,
  repo,
  branch,
  pathExists,
  readJSON,
  writeJSON,
  writeFile,
  deletePath,
  deleteFile,
  listFiles,
  commitRepoChanges,
};
