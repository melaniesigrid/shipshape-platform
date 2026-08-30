"use client";

import { Button, Panel } from "@shipshape/ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { sendLink, type LoginState } from "./actions";

const INITIAL: LoginState = { sent: false };

function LoginForm() {
  const params = useSearchParams();
  const expired = params.get("expired") === "1";
  const [state, action, pending] = useActionState(sendLink, INITIAL);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8">
        <h1 className="font-display text-[28px] leading-tight">Shipshape</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
          One standard, every project.
        </p>
      </div>

      <Panel className="p-6">
        {state.sent ? (
          <div>
            <h2 className="text-[16px]">Check your email</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              If that address has an account, a sign-in link is on its way. It works once and
              expires in fifteen minutes.
            </p>
            {state.console ? (
              <p className="mt-3 rounded-card bg-at-risk-soft px-3 py-2 font-mono text-[12px] leading-relaxed text-at-risk">
                No RESEND_API_KEY is set, so the link was printed to the server console instead.
              </p>
            ) : null}
          </div>
        ) : (
          <form action={action}>
            <label htmlFor="email" className="block text-[13px] font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="you@studio.com"
              className="mt-1.5 w-full rounded-card bg-raised px-3 py-2 text-[14px] ring-1 ring-hair placeholder:text-ink-faint focus:ring-sea"
            />

            {expired ? (
              <p className="mt-3 text-[13px] text-blocked">
                That link has expired or was already used. Request another.
              </p>
            ) : null}
            {state.error ? <p className="mt-3 text-[13px] text-blocked">{state.error}</p> : null}

            <Button type="submit" disabled={pending} className="mt-4 w-full">
              {pending ? "Sending…" : "Send sign-in link"}
            </Button>

            <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
              No password to forget. Sign-in is invite-only while Shipshape is in development.
            </p>
          </form>
        )}
      </Panel>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary or the whole route opts out of
  // static rendering.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
