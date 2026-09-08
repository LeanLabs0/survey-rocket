import { supabaseAdmin } from "./supabase-admin";

const BUCKET = "sr-public";
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

async function ensureBucket() {
  const admin = supabaseAdmin();
  const { data } = await admin.storage.getBucket(BUCKET);
  if (data) return;
  const created = await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
  if (created.error && !/already exists/i.test(created.error.message)) throw created.error;
}

export async function uploadPublicImage(path: string, file: File) {
  if (!TYPES.has(file.type)) throw new Error("Use a PNG, JPG, WebP, GIF, or SVG.");
  if (file.size > MAX_BYTES) throw new Error("Keep the file under 2 MB.");
  await ensureBucket();
  const admin = supabaseAdmin();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
