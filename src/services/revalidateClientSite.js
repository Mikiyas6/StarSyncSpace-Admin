// Tells the public Client site to bust its cache for the given paths right
// now, instead of waiting out its time-based revalidate window. Best-effort:
// if the site is unreachable or misconfigured, we swallow the error so it
// never blocks or fails an Admin mutation — the site's own safety-net
// revalidate window still catches it eventually.
export async function revalidateClientSite(paths) {
  const baseUrl = import.meta.env.VITE_CLIENT_SITE_URL;
  const secret = import.meta.env.VITE_REVALIDATE_SECRET;
  if (!baseUrl || !secret) return;

  try {
    await fetch(`${baseUrl}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ paths }),
    });
  } catch {
    // Ignored — see comment above.
  }
}
