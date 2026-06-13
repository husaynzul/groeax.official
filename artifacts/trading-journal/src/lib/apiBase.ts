declare const __VITE_API_BASE__: string;

export function getApiBase(): string {
  if (typeof __VITE_API_BASE__ !== "undefined" && __VITE_API_BASE__) {
    return __VITE_API_BASE__;
  }
  return (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
}
