import { customAlphabet } from "nanoid";

const publicNano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const ulidNano = customAlphabet("0123456789ABCDEFGHJKMNPQRSTVWXYZ", 16);

export function publicId() {
  return publicNano();
}

export function makeUlid() {
  const t = Date.now().toString(32).toUpperCase().padStart(10, "0");
  return (t + ulidNano()).slice(0, 26);
}

export function slugify(value: string) {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "survey";
}
