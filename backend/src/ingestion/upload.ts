import { z } from "zod";

import type { SourceDocument } from "./types.js";

const supportedMimeTypes = ["text/plain", "application/pdf"] as const;

export interface UploadValidationOptions {
  maxFileBytes: number;
}

export interface ValidatedUpload {
  fileName: string;
  sizeBytes: number;
  source: SourceDocument;
}

export function validateIngestionUpload(
  body: unknown,
  options: UploadValidationOptions
): ValidatedUpload {
  const uploadSchema = z
    .object({
      tenantId: z.string().min(1).max(128),
      ownerUserId: z.string().min(1).max(128),
      title: z.string().min(1).max(256),
      sourceUri: z.string().min(1).max(1_000),
      fileName: z.string().min(1).max(255),
      mimeType: z.enum(supportedMimeTypes),
      contentEncoding: z.enum(["utf8", "base64"]).default("utf8"),
      content: z.string().min(1)
    })
    .superRefine((value, context) => {
      let sizeBytes = 0;
      try {
        sizeBytes = measureContentBytes(value.content, value.contentEncoding);
      } catch (error) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: error instanceof Error ? error.message : "Invalid content"
        });
        return;
      }

      if (value.mimeType === "text/plain" && value.contentEncoding !== "utf8") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contentEncoding"],
          message: "text/plain uploads must use utf8 contentEncoding"
        });
      }

      if (value.mimeType === "application/pdf" && value.contentEncoding === "utf8") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contentEncoding"],
          message: "application/pdf uploads must use base64 contentEncoding for binary PDFs"
        });
      }

      if (sizeBytes > options.maxFileBytes) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: `File is too large: ${sizeBytes} bytes > ${options.maxFileBytes} bytes`
        });
      }
    });

  const parsed = uploadSchema.parse(body);
  const sizeBytes = measureContentBytes(parsed.content, parsed.contentEncoding);
  return {
    fileName: parsed.fileName,
    sizeBytes,
    source: {
      tenantId: parsed.tenantId,
      ownerUserId: parsed.ownerUserId,
      title: parsed.title,
      sourceUri: parsed.sourceUri,
      mimeType: parsed.mimeType,
      contentEncoding: parsed.contentEncoding,
      content: parsed.content
    }
  };
}

export function supportedIngestionMimeTypes(): readonly string[] {
  return supportedMimeTypes;
}

function measureContentBytes(content: string, encoding: "utf8" | "base64"): number {
  if (encoding === "utf8") {
    return Buffer.byteLength(content, "utf8");
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content) || content.length % 4 !== 0) {
    throw new Error("base64 content is not valid");
  }
  return Buffer.from(content, "base64").byteLength;
}
