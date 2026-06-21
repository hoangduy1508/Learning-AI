import { promises as fs } from "node:fs";
import path from "node:path";

export interface FileToolConfig {
  allowedRoots: string[];
  allowWrite: boolean;
  allowDelete: boolean;
  maxFileBytes: number;
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
}

export interface SearchMatch {
  path: string;
  line: number;
  preview: string;
}

export class FileToolError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = "FileToolError";
  }
}

export class FileSystemToolService {
  private readonly roots: string[];

  constructor(private readonly config: FileToolConfig) {
    this.roots = config.allowedRoots.map((root) => path.resolve(root));
  }

  listRoots(): string[] {
    return [...this.roots];
  }

  async list(root: string | undefined, relativePath = "."): Promise<FileEntry[]> {
    const target = await this.resolveExistingPath(root, relativePath);
    const stats = await fs.stat(target);
    if (!stats.isDirectory()) {
      throw new FileToolError("Target path is not a directory", 400);
    }

    const entries = await fs.readdir(target, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(target, entry.name);
        const entryStats = await fs.stat(absolutePath);
        return {
          name: entry.name,
          path: this.toDisplayPath(absolutePath),
          type: entry.isDirectory() ? "directory" : "file",
          size: entry.isFile() ? entryStats.size : undefined
        } satisfies FileEntry;
      })
    );

    return results.sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`));
  }

  async read(root: string | undefined, relativePath: string): Promise<{ path: string; content: string }> {
    const target = await this.resolveExistingPath(root, relativePath);
    const stats = await fs.stat(target);
    if (!stats.isFile()) {
      throw new FileToolError("Target path is not a file", 400);
    }
    if (stats.size > this.config.maxFileBytes) {
      throw new FileToolError(`File is larger than ${this.config.maxFileBytes} bytes`, 413);
    }

    return {
      path: this.toDisplayPath(target),
      content: await fs.readFile(target, "utf8")
    };
  }

  async search(
    root: string | undefined,
    query: string,
    options: { relativePath?: string; limit?: number } = {}
  ): Promise<SearchMatch[]> {
    const base = await this.resolveExistingPath(root, options.relativePath ?? ".");
    const limit = options.limit ?? 50;
    const matches: SearchMatch[] = [];

    await this.walkFiles(base, async (filePath) => {
      if (matches.length >= limit) {
        return;
      }

      const stats = await fs.stat(filePath);
      if (stats.size > this.config.maxFileBytes) {
        return;
      }

      let content: string;
      try {
        content = await fs.readFile(filePath, "utf8");
      } catch {
        return;
      }

      const lines = content.split(/\r?\n/u);
      for (const [index, line] of lines.entries()) {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          matches.push({
            path: this.toDisplayPath(filePath),
            line: index + 1,
            preview: line.trim().slice(0, 240)
          });
          if (matches.length >= limit) {
            break;
          }
        }
      }
    });

    return matches;
  }

  async write(
    root: string | undefined,
    relativePath: string,
    content: string,
    options: { createDirs?: boolean } = {}
  ): Promise<{ path: string; bytes: number }> {
    if (!this.config.allowWrite) {
      throw new FileToolError("File write is disabled. Set FILE_TOOL_ALLOW_WRITE=true.", 403);
    }
    if (Buffer.byteLength(content, "utf8") > this.config.maxFileBytes) {
      throw new FileToolError(`Content is larger than ${this.config.maxFileBytes} bytes`, 413);
    }

    const target = this.resolveCandidatePath(root, relativePath);
    if (options.createDirs) {
      await fs.mkdir(path.dirname(target), { recursive: true });
    }
    await this.assertParentInsideAllowedRoot(target);
    await fs.writeFile(target, content, "utf8");

    return {
      path: this.toDisplayPath(target),
      bytes: Buffer.byteLength(content, "utf8")
    };
  }

  async delete(
    root: string | undefined,
    relativePath: string,
    options: { recursive?: boolean; confirmation?: string } = {}
  ): Promise<{ path: string; deleted: true }> {
    if (!this.config.allowDelete) {
      throw new FileToolError("File delete is disabled. Set FILE_TOOL_ALLOW_DELETE=true.", 403);
    }
    if (options.confirmation !== "DELETE") {
      throw new FileToolError('Delete requires confirmation: "DELETE"', 400);
    }

    const target = await this.resolveExistingPath(root, relativePath);
    if (this.roots.includes(target)) {
      throw new FileToolError("Deleting an allowed root is not permitted", 403);
    }

    await fs.rm(target, { recursive: options.recursive ?? false, force: false });
    return { path: this.toDisplayPath(target), deleted: true };
  }

  private async walkFiles(directory: string, visit: (filePath: string) => Promise<void>): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".venv") {
        continue;
      }

      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.walkFiles(absolutePath, visit);
      } else if (entry.isFile()) {
        await visit(absolutePath);
      }
    }
  }

  private async resolveExistingPath(root: string | undefined, relativePath: string): Promise<string> {
    const candidate = this.resolveCandidatePath(root, relativePath);
    this.assertInsideAllowedRoot(candidate);
    let realPath: string;
    try {
      realPath = await fs.realpath(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FileToolError("Path does not exist", 404);
      }
      throw error;
    }
    this.assertInsideAllowedRoot(realPath);
    return realPath;
  }

  private resolveCandidatePath(root: string | undefined, relativePath: string): string {
    if (this.roots.length === 0) {
      throw new FileToolError("No allowed filesystem roots configured", 403);
    }

    const selectedRoot = root ? path.resolve(root) : this.roots[0];
    this.assertInsideAllowedRoot(selectedRoot);
    return path.resolve(selectedRoot, relativePath);
  }

  private async assertParentInsideAllowedRoot(target: string): Promise<void> {
    const parent = path.dirname(target);
    await fs.mkdir(parent, { recursive: true });
    const parentRealPath = await fs.realpath(parent);
    this.assertInsideAllowedRoot(parentRealPath);
    this.assertInsideAllowedRoot(target);
  }

  private assertInsideAllowedRoot(candidate: string): void {
    const resolved = path.resolve(candidate);
    const isAllowed = this.roots.some(
      (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)
    );
    if (!isAllowed) {
      throw new FileToolError("Path is outside configured allowed roots", 403);
    }
  }

  private toDisplayPath(absolutePath: string): string {
    return path.resolve(absolutePath);
  }
}

export function parseAllowedRoots(value: string): string[] {
  return value
    .split(";")
    .map((root) => root.trim())
    .filter(Boolean);
}
