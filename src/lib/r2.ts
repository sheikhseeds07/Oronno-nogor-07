import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function env(name: string, fallbackName?: string): string {
  const value = process.env[name]?.trim() || (fallbackName ? process.env[fallbackName]?.trim() : "");
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!normalized || normalized.split("/").some((part) => part === "..")) {
    throw new Error("Invalid R2 object key");
  }
  return normalized;
}

function publicBaseUrl(): string {
  return env("R2_PUBLIC_URL").replace(/\/+$/, "");
}

function client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID", "R2_ACCESS_KEY"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY", "R2_SECRET_KEY"),
    },
  });
}

export function r2PublicUrl(key: string): string {
  const cleanKey = normalizeKey(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${publicBaseUrl()}/${cleanKey}`;
}

export async function uploadToR2(
  file: Buffer,
  key: string,
  contentType = "application/octet-stream",
): Promise<string> {
  const cleanKey = normalizeKey(key);
  await client().send(new PutObjectCommand({
    Bucket: env("R2_BUCKET"),
    Key: cleanKey,
    Body: file,
    ContentType: contentType,
    CacheControl: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
  }));
  return r2PublicUrl(cleanKey);
}

export async function deleteFromR2(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({
    Bucket: env("R2_BUCKET"),
    Key: normalizeKey(key),
  }));
}
