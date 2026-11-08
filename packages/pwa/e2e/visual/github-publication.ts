import { setTimeout } from "node:timers/promises";
import { commentMarker, reportBranch, type ReportImage } from "./pr-report.ts";

export interface GitHub {
  request<T>(method: string, route: string, body?: string): Promise<T>;
}

export class GitHubError extends Error {
  status: number;

  constructor(status: number, route: string) {
    super(`GitHub request failed (${status}): ${route}`);
    this.status = status;
  }
}

export function githubClient(repository: string, token: string, transport = fetch): GitHub {
  return {
    async request<T>(method: string, route: string, body?: string): Promise<T> {
      const response = await transport(`https://api.github.com/repos/${repository}/${route}`, {
        method,
        body,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          "x-github-api-version": "2022-11-28",
        },
      });

      if (!response.ok) throw new GitHubError(response.status, route);

      if (response.status === 204) return JSON.parse("null");

      return response.json();
    },
  };
}

interface GitObject {
  sha: string;
}

interface GitRef {
  object: GitObject;
}

interface GitCommit {
  tree: GitObject;
}

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
}

export async function publishImages(api: GitHub, repository: string, images: ReportImage[]) {
  const entries: TreeEntry[] = [];

  for (const image of images) {
    const blob = await api.request<GitObject>(
      "POST",
      "git/blobs",
      JSON.stringify({
        content: image.bytes.toString("base64"),
        encoding: "base64",
      }),
    );

    entries.push({ path: `images/${blob.sha}.png`, mode: "100644", type: "blob", sha: blob.sha });
  }

  const tree = [...new Map(entries.map((entry) => [entry.path, entry])).values()];
  let commit: GitObject | undefined;

  // Different PR publishers can race on the shared image branch. Rebase the
  // data-only tree on the current tip and retry a non-fast-forward write.
  for (let attempt = 0; attempt < 3; attempt++) {
    let parent: string | undefined;
    let baseTree: string | undefined;

    try {
      parent = (await api.request<GitRef>("GET", `git/ref/heads/${reportBranch}`)).object.sha;
      baseTree = (await api.request<GitCommit>("GET", `git/commits/${parent}`)).tree.sha;
    } catch (error) {
      if (!(error instanceof GitHubError) || error.status !== 404) throw error;
    }

    const createdTree = await api.request<GitObject>(
      "POST",
      "git/trees",
      JSON.stringify({
        base_tree: baseTree,
        tree,
      }),
    );

    commit = await api.request<GitObject>(
      "POST",
      "git/commits",
      JSON.stringify({
        message: "Publish visual regression images",
        tree: createdTree.sha,
        parents: parent ? [parent] : [],
      }),
    );

    try {
      if (parent) {
        await api.request(
          "PATCH",
          `git/refs/heads/${reportBranch}`,
          JSON.stringify({ sha: commit.sha, force: false }),
        );
      } else {
        await api.request(
          "POST",
          "git/refs",
          JSON.stringify({ ref: `refs/heads/${reportBranch}`, sha: commit.sha }),
        );
      }

      break;
    } catch (error) {
      if (!(error instanceof GitHubError) || ![409, 422].includes(error.status) || attempt === 2)
        throw error;
    }
  }

  if (!commit) throw new Error("No image commit created");

  return images.map((image, index) => ({
    ...image,
    url: `https://raw.githubusercontent.com/${repository}/${commit.sha}/${entries[index].path}`,
  }));
}

export interface PublishedImage extends ReportImage {
  url: string;
}

export async function verifyImages(images: PublishedImage[], transport = fetch) {
  for (const image of images) {
    let verified = false;

    // Raw CDN visibility can lag the Git write. Never send credentials to the CDN.
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await transport(image.url);

      if (
        response.ok &&
        response.headers.get("content-type")?.startsWith("image/png") &&
        Buffer.from(await response.arrayBuffer()).equals(image.bytes)
      ) {
        verified = true;
        break;
      }

      if (attempt < 3) await setTimeout(1000 * (attempt + 1));
    }

    if (!verified) throw new Error("Published PNG is not publicly readable");
  }
}

interface IssueComment {
  id: number;
  body: string;
  user: { login: string; type: string };
}

export async function upsertComment(api: GitHub, number: number, body: string) {
  const comments: IssueComment[] = [];

  for (let page = 1; ; page++) {
    const batch = await api.request<IssueComment[]>(
      "GET",
      `issues/${number}/comments?per_page=100&page=${page}`,
    );

    comments.push(...batch);

    if (batch.length < 100) break;
  }

  const own = comments.filter(
    (comment) =>
      comment.user.login === "github-actions[bot]" &&
      comment.user.type === "Bot" &&
      comment.body.startsWith(commentMarker),
  );

  if (own.length) {
    await api.request("PATCH", `issues/comments/${own[0].id}`, JSON.stringify({ body }));

    for (const duplicate of own.slice(1))
      await api.request("DELETE", `issues/comments/${duplicate.id}`);
  } else {
    await api.request("POST", `issues/${number}/comments`, JSON.stringify({ body }));
  }
}
