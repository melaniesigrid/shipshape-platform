import { redirect } from "next/navigation";

import { currentSession } from "@/lib/auth";

/** The root is a signpost, not a page. Signed in goes to work; signed out signs in. */
export default async function Home() {
  const session = await currentSession();
  redirect(session ? "/projects" : "/login");
}
