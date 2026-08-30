"use server";

import { requestLoginLink } from "@/lib/auth";

export interface LoginState {
  sent: boolean;
  error?: string;
  /** True when there is no mail provider configured and the link went to the console. */
  console?: boolean;
}

export async function sendLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { sent: false, error: "That does not look like an email address." };

  try {
    const result = await requestLoginLink(email);
    // Reports sent whatever happened, including for an address with no account.
    // Anything else turns this form into an account-enumeration oracle.
    return { sent: true, console: result.delivered === "console" };
  } catch (error) {
    console.error("login link failed", error);
    return { sent: false, error: "Could not send the link. Try again in a moment." };
  }
}
