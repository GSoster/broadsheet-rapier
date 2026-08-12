// Content authors write asset paths as absolute, root-relative strings
// (e.g. "/content/assets/images/items/rapier.jpg") — but this app is built
// with a non-root Vite `base` (`/broadsheet-rapier/`, for GitHub Pages), and
// static files under public/ are served at `${base}${path}`, not at the
// domain root. A literal `/content/...` src therefore 404s under any
// non-root base — invisible until now because every image asset was already
// showing the MISSING placeholder for an unrelated reason (no file existed).
// Every place an asset path becomes a real `src`/`Audio()` call must resolve
// it through this function first.
export function resolveAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\//, "")}`;
}
