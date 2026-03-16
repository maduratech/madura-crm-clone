/**
 * Default avatar URL when user/customer has no profile image.
 * Uses UI Avatars (reliable, no external dependency on iran.liara.run).
 */
export function getDefaultAvatarUrl(name: string, size = 128): string {
  const displayName = (name || "?").trim();
  const initials =
    displayName.length >= 2
      ? displayName
          .split(/\s+/)
          .map((s) => s[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : displayName.slice(0, 2).toUpperCase() || "?";
  const params = new URLSearchParams({
    name: initials,
    size: String(size),
    background: "6366f1",
    color: "fff",
    bold: "true",
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}
