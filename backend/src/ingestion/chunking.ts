import type { CleanedPage, DocumentChunk, ParsedDocument } from "./types.js";

export interface RecursiveChunkOptions {
  maxCharacters: number;
  overlapCharacters: number;
}

export interface FixedSizeChunkOptions {
  maxCharacters: number;
  overlapCharacters: number;
}

export interface StructureAwareChunkOptions {
  maxCharacters: number;
  overlapCharacters: number;
}

export interface ParentChildChunkOptions {
  parentMaxCharacters: number;
  childMaxCharacters: number;
  childOverlapCharacters: number;
}

export type ChunkingStrategy =
  | "fixed-size"
  | "recursive-text"
  | "structure-aware"
  | "parent-child-parent"
  | "parent-child-child";

export interface ChunkStrategyComparison {
  strategy: ChunkingStrategy;
  chunkCount: number;
  averageCharacters: number;
  chunks: DocumentChunk[];
}

export interface ParentChildChunkSet {
  parents: DocumentChunk[];
  children: DocumentChunk[];
}

export function chunkCleanedPages(
  pages: CleanedPage[],
  parser: ParsedDocument["parser"],
  options: RecursiveChunkOptions
): DocumentChunk[] {
  validateChunkOptions(options);

  const chunks: DocumentChunk[] = [];
  for (const page of pages) {
    for (const content of splitRecursive(page.text, options)) {
      chunks.push(createChunk(chunks.length, page.pageNumber, content, parser, "recursive-text"));
    }
  }
  return chunks;
}

export function chunkFixedSizePages(
  pages: CleanedPage[],
  parser: ParsedDocument["parser"],
  options: FixedSizeChunkOptions
): DocumentChunk[] {
  validateChunkOptions(options);

  const chunks: DocumentChunk[] = [];
  for (const page of pages) {
    let start = 0;
    while (start < page.text.length) {
      const content = page.text.slice(start, start + options.maxCharacters).trim();
      if (content.length > 0) {
        chunks.push(createChunk(chunks.length, page.pageNumber, content, parser, "fixed-size"));
      }

      if (start + options.maxCharacters >= page.text.length) {
        break;
      }
      start += options.maxCharacters - options.overlapCharacters;
    }
  }

  return chunks;
}

export function chunkStructureAwarePages(
  pages: CleanedPage[],
  parser: ParsedDocument["parser"],
  options: StructureAwareChunkOptions
): DocumentChunk[] {
  validateChunkOptions(options);

  const chunks: DocumentChunk[] = [];
  for (const page of pages) {
    for (const section of splitMarkdownSections(page.text)) {
      for (const content of splitRecursive(section.content, options)) {
        chunks.push(
          createChunk(
            chunks.length,
            page.pageNumber,
            content,
            parser,
            "structure-aware",
            section.title
          )
        );
      }
    }
  }

  return chunks;
}

export function compareChunkingStrategies(
  pages: CleanedPage[],
  parser: ParsedDocument["parser"],
  options: RecursiveChunkOptions
): ChunkStrategyComparison[] {
  const strategies: Array<[ChunkingStrategy, DocumentChunk[]]> = [
    ["fixed-size", chunkFixedSizePages(pages, parser, options)],
    ["recursive-text", chunkCleanedPages(pages, parser, options)],
    ["structure-aware", chunkStructureAwarePages(pages, parser, options)]
  ];

  return strategies.map(([strategy, chunks]) => ({
    strategy,
    chunkCount: chunks.length,
    averageCharacters:
      chunks.length === 0
        ? 0
        : Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length),
    chunks
  }));
}

export function createParentChildChunks(
  pages: CleanedPage[],
  parser: ParsedDocument["parser"],
  options: ParentChildChunkOptions
): ParentChildChunkSet {
  validateChunkOptions({
    maxCharacters: options.parentMaxCharacters,
    overlapCharacters: 0
  });
  validateChunkOptions({
    maxCharacters: options.childMaxCharacters,
    overlapCharacters: options.childOverlapCharacters
  });

  const parents = chunkStructureAwarePages(pages, parser, {
    maxCharacters: options.parentMaxCharacters,
    overlapCharacters: 0
  }).map((chunk, index) =>
    createChunk(
      index,
      chunk.pageNumber,
      chunk.content,
      parser,
      "parent-child-parent",
      chunk.metadata.sectionTitle
    )
  );

  const children: DocumentChunk[] = [];
  for (const parent of parents) {
    for (const content of splitRecursive(parent.content, {
      maxCharacters: options.childMaxCharacters,
      overlapCharacters: options.childOverlapCharacters
    })) {
      children.push(
        createChunk(
          children.length,
          parent.pageNumber,
          content,
          parser,
          "parent-child-child",
          parent.metadata.sectionTitle,
          {
            parentChunkIndex: parent.chunkIndex,
            parentSectionTitle: parent.metadata.sectionTitle,
            childOverlapCharacters: options.childOverlapCharacters
          }
        )
      );
    }
  }

  return { parents, children };
}

function splitRecursive(text: string, options: RecursiveChunkOptions): string[] {
  if (text.length <= options.maxCharacters) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > options.maxCharacters) {
    const splitAt = chooseSplitIndex(remaining, options.maxCharacters);
    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    const nextStart = Math.max(0, splitAt - options.overlapCharacters);
    remaining = remaining.slice(nextStart).trimStart();
  }

  if (remaining.trim().length > 0) {
    chunks.push(remaining.trim());
  }

  return chunks;
}

function chooseSplitIndex(text: string, maxCharacters: number): number {
  const candidates = ["\n\n", "\n", ". ", " "];
  const window = text.slice(0, maxCharacters + 1);

  for (const separator of candidates) {
    const index = window.lastIndexOf(separator);
    if (index >= Math.floor(maxCharacters * 0.45)) {
      return index + separator.length;
    }
  }

  return maxCharacters;
}

function validateChunkOptions(options: RecursiveChunkOptions): void {
  if (options.maxCharacters <= 0) {
    throw new Error("maxCharacters must be positive");
  }
  if (options.overlapCharacters < 0 || options.overlapCharacters >= options.maxCharacters) {
    throw new Error("overlapCharacters must be smaller than maxCharacters");
  }
}

interface TextSection {
  title?: string;
  content: string;
}

function splitMarkdownSections(text: string): TextSection[] {
  const lines = text.split("\n");
  const sections: TextSection[] = [];
  let currentTitle: string | undefined;
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (heading && currentLines.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentLines.join("\n").trim()
      });
      currentLines = [];
    }

    if (heading) {
      currentTitle = heading[2]!.trim();
    }
    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentLines.join("\n").trim()
    });
  }

  return sections.filter((section) => section.content.length > 0);
}

function createChunk(
  chunkIndex: number,
  pageNumber: number,
  content: string,
  parser: ParsedDocument["parser"],
  chunking: ChunkingStrategy,
  sectionTitle?: string,
  extraMetadata?: {
    parentChunkIndex?: number;
    parentSectionTitle?: string;
    childOverlapCharacters?: number;
  }
): DocumentChunk {
  return {
    chunkIndex,
    pageNumber,
    content,
    metadata: {
      page: pageNumber,
      parser,
      chunking,
      ...(sectionTitle ? { sectionTitle } : {}),
      ...removeUndefinedValues(extraMetadata ?? {}),
      tokenEstimate: estimateTokens(content)
    }
  };
}

function removeUndefinedValues<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
