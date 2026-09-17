import path from "path";

export function resolveSafeUploadRestoreDest(
  relativePath: string,
  cwd = process.cwd()
): string | null {
  if (!relativePath || relativePath.includes("\0")) return null;
  const posix = relativePath.replace(/\\/g, "/");
  if (!posix.startsWith("uploads/")) return null;
  const normalized = path.posix.normalize(posix);
  if (normalized !== "uploads" && !normalized.startsWith("uploads/")) return null;
  if (normalized.split("/").includes("..")) return null;
  const dest = path.resolve(cwd, "public", ...normalized.split("/"));
  const root = path.resolve(cwd, "public", "uploads");
  if (dest !== root && !dest.startsWith(root + path.sep)) return null;
  return dest;
}
