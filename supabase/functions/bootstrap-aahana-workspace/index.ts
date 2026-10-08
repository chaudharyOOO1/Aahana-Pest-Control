import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "admin@aahanapestcontrol.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "POST required" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+$/i.test(authHeader)) return reply(401, { error: "Authentication required" });
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return reply(500, { error: "Server configuration incomplete" });

    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const authClient = createClient(url, anonKey, options);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return reply(401, { error: "Invalid authentication" });
    if (user.email?.toLowerCase() !== ADMIN_EMAIL || !user.email_confirmed_at) {
      return reply(403, { error: "Only the confirmed Aahana admin can create a workspace" });
    }

    const admin = createClient(url, serviceKey, options);
    const { data: memberships, error: lookupError } = await admin
      .from("organization_members").select("organization_id,role").eq("user_id", user.id).limit(2);
    if (lookupError) throw lookupError;
    if ((memberships?.length ?? 0) > 1) return reply(409, { error: "Multiple workspaces found. Review admin membership before continuing." });
    if (memberships?.length && memberships[0].role !== "owner") {
      return reply(403, { error: "Owner membership required" });
    }

    let organizationId = memberships?.[0]?.organization_id;
    const existing = Boolean(organizationId);
    if (!organizationId) {
      const { data: org, error: orgError } = await admin
        .from("organizations").insert({ name: "Aahana Pest Control" }).select("id").single();
      if (orgError) throw orgError;
      organizationId = org.id;
      const { error: memberError } = await admin.from("organization_members")
        .insert({ organization_id: organizationId, user_id: user.id, role: "owner" });
      if (memberError) throw memberError;
    }

    // The documented schema has UNIQUE (organization_id, name) on accounts.
    // Preserve existing balances and repair missing defaults after a partial failure.
    const { error: accountError } = await admin.from("accounts").upsert([
      { organization_id: organizationId, name: "Cash", type: "Cash", opening: 0 },
      { organization_id: organizationId, name: "Bank", type: "Bank", opening: 0 },
      { organization_id: organizationId, name: "UPI / Wallet", type: "UPI", opening: 0 },
      { organization_id: organizationId, name: "Petty Cash", type: "Petty Cash", opening: 0 },
    ], { onConflict: "organization_id,name", ignoreDuplicates: true });
    if (accountError) throw accountError;
    return reply(200, { organization_id: organizationId, existing });
  } catch (error) {
    console.error("Workspace bootstrap failed", error instanceof Error ? error.message : "Database operation failed");
    return reply(500, { error: "Workspace setup failed. Check the function logs before retrying." });
  }
});
