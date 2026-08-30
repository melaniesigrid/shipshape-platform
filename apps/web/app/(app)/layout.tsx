import Link from "next/link";

import { requireSession } from "@/lib/auth";

import { signOutAction } from "./actions";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/rubrics", label: "Rubrics" },
];

/**
 * The signed-in shell. `requireSession` runs here so no page under this group
 * can render without a tenant, and it is `cache`d so the pages below reuse the
 * same lookup rather than repeating it.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-hair bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Link href="/projects" className="font-display text-[17px] tracking-tight">
            Shipshape
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-card px-2.5 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-sunk hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <span className="text-[13px] text-ink-faint">{session.tenant.name}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-[13px] text-ink-faint transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
