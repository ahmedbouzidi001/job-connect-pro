import { createFileRoute } from "@tanstack/react-router";

/**
 * Tâche quotidienne (8h heure de Tunis / 7h UTC) : lance la candidature
 * automatique pour tous les utilisateurs qui l'ont activée avec le lancement
 * quotidien. Appelée par pg_cron avec la clé publique du backend.
 */
export const Route = createFileRoute("/api/public/hooks/auto-apply-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace("Bearer ", "");
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runAutoApplyForUser } = await import("@/lib/api/auto-apply.server");

        const today = new Date().toISOString().slice(0, 10);
        const { data: rows, error } = await supabaseAdmin
          .from("auto_apply_settings")
          .select("user_id, last_daily_run_date")
          .eq("is_active", true)
          .eq("daily_enabled", true)
          .limit(500);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const targets = (rows ?? []).filter((r) => r.last_daily_run_date !== today);
        let totalApplied = 0;
        let users = 0;
        for (const row of targets) {
          try {
            const res = await runAutoApplyForUser(supabaseAdmin, row.user_id);
            totalApplied += res.applied;
            users++;
          } catch (e) {
            await supabaseAdmin.from("error_log").insert([{
              user_id: row.user_id, level: "warn", source: "auto_apply_daily",
              message: (e as Error).message,
            }]);
          }
          await supabaseAdmin.from("auto_apply_settings")
            .update({ last_daily_run_date: today })
            .eq("user_id", row.user_id);
        }

        return Response.json({ ok: true, users, applied: totalApplied, scheduled: targets.length });
      },
    },
  },
});
