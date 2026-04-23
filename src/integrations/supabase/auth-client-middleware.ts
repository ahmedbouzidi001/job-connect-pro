import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/**
 * Client-side middleware that attaches the current Supabase session's
 * access token to the outgoing server function request as a Bearer header.
 * Pair this with `requireSupabaseAuth` on the server side.
 */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      sendContext: {},
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
);