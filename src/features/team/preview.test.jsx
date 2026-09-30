/* Adding somebody to the team, as the page actually draws it.

   Same arrangement as the menu and inventory previews —
   renderToStaticMarkup with the hooks mocked — because the admin's login
   cannot be passed in a test.

   What is worth looking at here is the role field. Creating a login and
   then promoting it was two steps with a wrong-powers state in between,
   and the form now asks up front; the assertions below are that both
   roles are offered, that staff is the default, and that the page says
   the new person can sign in immediately — which is the promise the
   server route exists to keep.
*/

/* eslint-env node */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServerStyleSheet, ThemeProvider } from "styled-components";

const TEAM = [
  {
    id: "a1",
    role: "admin",
    full_name: "Mike Lack",
    email: "mike@lack.com",
    is_active: true,
  },
  {
    id: "s1",
    role: "staff",
    full_name: "Konan",
    email: "konan@example.com",
    is_active: true,
  },
  {
    id: "s2",
    role: "staff",
    full_name: "Former Receptionist",
    email: "gone@example.com",
    is_active: false,
  },
];

vi.mock("./useTeam", () => ({
  useTeam: () => ({ team: TEAM, isLoading: false, error: null }),
  useSetRole: () => ({ setRole: () => {}, isSettingRole: false }),
  useSetActive: () => ({ setActive: () => {}, isSettingActive: false }),
}));

vi.mock("../authentication/useUser", () => ({
  useUser: () => ({ user: { id: "a1" }, isLoading: false }),
}));

vi.mock("../authentication/useSignup", () => ({
  useSignup: () => ({ signUp: () => {}, isSigningUp: false }),
}));

import Users from "../../pages/Users";

function render(node) {
  const sheet = new ServerStyleSheet();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  try {
    const html = renderToStaticMarkup(
      sheet.collectStyles(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <ThemeProvider theme={{}}>{node}</ThemeProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    return { html, css: sheet.getStyleTags() };
  } finally {
    sheet.seal();
  }
}

describe("team page preview", () => {
  let html = "";

  beforeAll(() => {
    const rendered = render(<Users />);
    html = rendered.html;

    /* Opt-in picture, same as the other previews:

         PREVIEW_OUT=public/preview-team.html npx vitest run \
           src/features/team/preview.test.jsx
    */
    if (!process.env.PREVIEW_OUT) return;

    const out = resolve(process.env.PREVIEW_OUT);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `<!doctype html><meta charset="utf-8"><title>Team preview</title>
${rendered.css}
<style>
  :root{--color-grey-0:#fff;--color-grey-50:#f9fafb;--color-grey-100:#f3f4f6;--color-grey-200:#e5e7eb;--color-grey-300:#d1d5db;--color-grey-400:#9ca3af;--color-grey-500:#6b7280;--color-grey-600:#4b5563;--color-grey-700:#374151;--color-grey-800:#1f2937;--color-brand-50:#eef2ff;--color-brand-100:#e0e7ff;--color-brand-600:#4f46e5;--color-brand-700:#4338ca;--color-green-100:#dcfce7;--color-green-700:#15803d;--color-blue-100:#e0f2fe;--color-blue-700:#0369a1;--color-yellow-100:#fef9c3;--color-yellow-700:#a16207;--color-red-100:#fee2e2;--color-red-700:#b91c1c;--color-red-800:#991b1b;--color-silver-100:#e5e7eb;--color-silver-700:#374151;--color-coral-100:#ffe4df;--color-coral-700:#c23a28;
    --border-radius-sm:5px;--border-radius-md:7px;--border-radius-lg:9px;
    --shadow-sm:0 1px 2px rgba(0,0,0,.04);--shadow-md:0 .6rem 2.4rem rgba(0,0,0,.06);--shadow-lg:0 2.4rem 3.2rem rgba(0,0,0,.12);
    --backdrop-color:rgba(255,255,255,.1);--image-grayscale:0;--image-opacity:100%;}
  html{font-size:62.5%}
  body{font-family:system-ui,sans-serif;font-size:1.6rem;background:#f3f4f6;color:var(--color-grey-700);margin:0;padding:3.2rem;display:grid;gap:2.4rem}
</style>
<body>${html}</body>`,
    );
    console.log("PREVIEW:", out);
  });

  it("offers both roles when creating the login", () => {
    expect(html).toContain('id="role"');
    expect(html).toContain('value="staff"');
    expect(html).toContain('value="admin"');
  });

  /* Staff is the cautious default and has to stay the one that is
     selected, so that a slip of the hand does not hand somebody the
     prices. */
  it("defaults to staff", () => {
    const select = html.slice(html.indexOf('id="role"'));
    const staffAt = select.indexOf('value="staff"');
    const adminAt = select.indexOf('value="admin"');
    expect(staffAt).toBeGreaterThan(-1);
    expect(staffAt).toBeLessThan(adminAt);
  });

  /* The promise this whole change is about. If the copy stops saying it,
     either the server route went away or somebody is about to be told to
     go and look for a confirmation email that never arrives. */
  it("says the new person can sign in straight away", () => {
    expect(html).toContain("already");
    expect(html).toContain("sign in straight");
  });

  it("still lists the team, with roles and revoked access", () => {
    expect(html).toContain("Mike Lack");
    expect(html).toContain("Admin");
    expect(html).toContain("Staff");
    expect(html).toContain("Revoked");
  });
});
