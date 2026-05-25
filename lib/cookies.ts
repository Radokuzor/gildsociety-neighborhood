const NEIGHBORHOOD_COOKIE = "gs_neighborhood";
const FULL_ACCESS_COOKIE = "gs_full_access";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function setCookie(name: string, value: string, maxAgeMs: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + maxAgeMs).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export function setNeighborhoodCookie(slug: string) {
  setCookie(NEIGHBORHOOD_COOKIE, slug, ONE_YEAR_MS);
}

export function getNeighborhoodCookie(): string | null {
  return getCookie(NEIGHBORHOOD_COOKIE);
}

export function setFullAccessCookie() {
  setCookie(FULL_ACCESS_COOKIE, "1", ONE_YEAR_MS);
}

export function getFullAccessCookie(): boolean {
  return getCookie(FULL_ACCESS_COOKIE) === "1";
}
