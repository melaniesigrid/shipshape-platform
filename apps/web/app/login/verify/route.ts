import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { consumeLoginToken } from "@/lib/auth";

/**
 * The other end of the magic link. A route handler rather than a page because
 * it sets a cookie and redirects — it has no UI of its own.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const ok = token ? await consumeLoginToken(token) : false;
  redirect(ok ? "/projects" : "/login?expired=1");
}
