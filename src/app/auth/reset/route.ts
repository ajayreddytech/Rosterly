import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs out this browser and clears its session cookies, then sends the
 * visitor back to the sign-in page with a message. Used when a signed-in
 * account cannot be loaded, so the visitor never sees a dead-end screen.
 * Scope "local" signs out only this browser; other devices stay signed in.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  const reason = request.nextUrl.searchParams.get("reason") === "profile" ? "profile" : "signedout";
  const target = new URL(`/login?error=${reason}`, request.nextUrl.origin);
  return NextResponse.redirect(target, { status: 303 });
}
