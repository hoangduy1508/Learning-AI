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
      content: z.string().min(1)
    })
    .superRefine((value, context) => {
      const sizeBytes = Buffer.byteLength(value.content, "utf8");
      if (sizeBytes > options.maxFileBytes) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: `File is too large: ${sizeBytes} bytes > ${options.maxFileBytes} bytes`
        });
      }
    });

  const parsed = uploadSchema.parse(body);
  return {
    fileName: parsed.fileName,
    sizeBytes: Buffer.byteLength(parsed.content, "utf8"),
    source: {
      tenantId: parsed.tenantId,
      ownerUserId: parsed.ownerUserId,
      title: parsed.title,
      sourceUri: parsed.sourceUri,
      mimeType: parsed.mimeType,
      content: parsed.content
    }
  };
}

export function supportedIngestionMimeTypes(): readonly string[] {
  return supportedMimeTypes;
}
