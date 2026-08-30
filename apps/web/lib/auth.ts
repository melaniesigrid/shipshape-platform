import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  db,
  loginTokens,
  memberships,
  sessions,
  tenants,
  users,
  type Tenant,
  type User,
} from "@shipshape/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Magic-link authentication.
 *
 * No passwords to leak and none to reset. The link is a 32-byte random token
 * emailed to the address; only its SHA-256 hash is stored, so a database dump
 * yields nothing anyone can sign in with.
 *
 * Sign-in is invite-only for now: a token is issued only for an address that
 * already has a user row. Self-serve signup is a deliberate later step, because
 * an open signup form on a product with no billing is a spam magnet.
 */

const SESSION_COOKIE = "shipshape_session";
const SESSION_DAYS = 30;
const TOKEN_MINUTES = 15;

function hashToken(token: string): string {
  // Peppered with SESSION_SECRET so a stolen database alone cannot be brute
  // forced offline against the (short) token space.
  const pepper = process.env.SESSION_SECRET ?? "";
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// Requesting a link
// ---------------------------------------------------------------------------

export type LoginRequestResult =
  | { ok: true; delivered: "email" | "console" }
  /** Deliberately vague to the caller; see the note in `requestLoginLink`. */
  | { ok: true; delivered: "none" };

/**
 * Issue a login link for an address.
 *
 * Always reports success, whether or not the address exists. An endpoint that
 * says "no such user" is an account-enumeration oracle, and this one is public.
 */
export async function requestLoginLink(rawEmail: string): Promise<LoginRequestResult> {
  const email = rawEmail.trim().toLowerCase();

  const [user] = await db().select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return { ok: true, delivered: "none" };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_MINUTES * 60_000);

  await db().insert(loginTokens).values({ email, tokenHash: hashToken(token), expiresAt });

  const url = `${appUrl()}/login/verify?token=${token}`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Development: the link goes to the server console. Never the browser —
    // that would hand a sign-in link to whoever is looking at the screen.
    console.log(`\n  Sign-in link for ${email} (valid ${TOKEN_MINUTES} minutes):\n  ${url}\n`);
    return { ok: true, delivered: "console" };
  }

  const { Resend } = await import("resend");
  await new Resend(apiKey).emails.send({
    from: process.env.SHIPSHAPE_FROM_EMAIL ?? "Shipshape <no-reply@example.com>",
    to: email,
    subject: "Your Shipshape sign-in link",
    text: `Sign in to Shipshape:\n\n${url}\n\nThe link works once and expires in ${TOKEN_MINUTES} minutes. If you did not ask for it, ignore this message.`,
  });

  return { ok: true, delivered: "email" };
}

// ---------------------------------------------------------------------------
// Consuming a link
// ---------------------------------------------------------------------------

/**
 * Exchange a token for a session cookie. Returns false for anything expired,
 * already used, or unrecognised — all with the same answer, so the failure mode
 * leaks nothing about which it was.
 */
export async function consumeLoginToken(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  const [row] = await db()
    .select()
    .from(loginTokens)
    .where(
      and(
        eq(loginTokens.tokenHash, tokenHash),
        isNull(loginTokens.consumedAt),
        gt(loginTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return false;

  // Constant-time even though the lookup above already matched: the comparison
  // costs nothing and keeps the habit in place if this is ever refactored.
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const [user] = await db().select().from(users).where(eq(users.email, row.email)).limit(1);
  if (!user) return false;

  const [membership] = await db()
    .select()
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);

  // Mark used before issuing the session, so a replayed request cannot mint a
  // second session off the same link.
  await db()
    .update(loginTokens)
    .set({ consumedAt: new Date() })
    .where(eq(loginTokens.id, row.id));

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const [session] = await db()
    .insert(sessions)
    .values({ userId: user.id, tenantId: membership?.tenantId ?? null, expiresAt })
    .returning({ id: sessions.id });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, session!.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return true;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  // Delete the row as well as the cookie: a session has to be revocable
  // server-side, or signing out is only a suggestion.
  if (id) await db().delete(sessions).where(eq(sessions.id, id));
  jar.delete(SESSION_COOKIE);
}

// ---------------------------------------------------------------------------
// Reading the session
// ---------------------------------------------------------------------------

export interface SessionContext {
  user: User;
  tenant: Tenant;
  role: string;
}

/**
 * The signed-in user and their current workspace, or null.
 *
 * Wrapped in React's `cache` so several server components on one page share a
 * single lookup instead of each hitting the database.
 */
export const currentSession = cache(async (): Promise<SessionContext | null> => {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const [row] = await db()
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;

  const [user] = await db().select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) return null;

  const [membership] = await db()
    .select()
    .from(memberships)
    .where(
      row.tenantId
        ? and(eq(memberships.userId, user.id), eq(memberships.tenantId, row.tenantId))
        : eq(memberships.userId, user.id),
    )
    .limit(1);
  if (!membership) return null;

  const [tenant] = await db()
    .select()
    .from(tenants)
    .where(eq(tenants.id, membership.tenantId))
    .limit(1);
  if (!tenant) return null;

  return { user, tenant, role: membership.role };
});

/**
 * The session, or a thrown redirect. Every page and action under `(app)` starts
 * with this — it is the single place tenant scope enters the request, and every
 * query downstream takes the `tenantId` it returns explicitly.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await currentSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return session;
}
