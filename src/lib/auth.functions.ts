import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "./roles";

export type SessionProfile = {
  profileId: string;
  tenantId: string;
  tenantName: string;
  email: string;
  fullName: string | null;
  roles: AppRole[];
};

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "tenant"}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Idempotently resolves the signed-in account to a tenant profile.
 * First call after sign-up creates the tenant (owner) or joins an invited
 * tenant. Authorization for everything else lives in RLS policies.
 */
export const resolveSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionProfile> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const load = async (): Promise<SessionProfile | null> => {
      const { data } = await supabaseAdmin
        .from("users")
        .select("id, tenant_id, email, full_name, tenants(name)")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (!data) return null;
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.id);
      return {
        profileId: data.id,
        tenantId: data.tenant_id,
        tenantName: (data.tenants as { name: string } | null)?.name ?? "",
        email: data.email,
        fullName: data.full_name,
        roles: (roleRows ?? []).map((r) => r.role as AppRole),
      };
    };

    const existing = await load();
    if (existing) return existing;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authUser.user) throw new Error("Account not found");

    const meta = (authUser.user.user_metadata ?? {}) as Record<string, unknown>;
    const email = authUser.user.email ?? "";
    const fullName = typeof meta["full_name"] === "string" ? (meta["full_name"] as string) : null;
    const inviteToken =
      typeof meta["invite_token"] === "string" ? (meta["invite_token"] as string) : "";
    const businessName =
      typeof meta["business_name"] === "string" ? (meta["business_name"] as string) : "";

    let tenantId: string;
    let role: AppRole;
    let invitationId: string | null = null;

    if (inviteToken) {
      const { data: invite } = await supabaseAdmin
        .from("invitations")
        .select("id, tenant_id, role, email, expires_at, accepted_at")
        .eq("token", inviteToken)
        .maybeSingle();
      if (!invite) throw new Error("This invitation link is not valid.");
      if (invite.accepted_at) throw new Error("This invitation has already been used.");
      if (new Date(invite.expires_at) < new Date()) throw new Error("This invitation has expired.");
      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error("This invitation was issued to a different email address.");
      }
      tenantId = invite.tenant_id;
      role = invite.role as AppRole;
      invitationId = invite.id;
    } else if (businessName) {
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({ name: businessName, slug: slugify(businessName) })
        .select("id")
        .single();
      if (tenantError || !tenant) throw new Error("Could not create the business workspace.");
      tenantId = tenant.id;
      role = "owner";
    } else {
      throw new Error("No business or invitation is linked to this account.");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .insert({ tenant_id: tenantId, auth_user_id: userId, email, full_name: fullName })
      .select("id")
      .single();
    if (profileError || !profile) throw new Error("Could not create your profile.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ tenant_id: tenantId, user_id: profile.id, role });
    if (roleError) throw new Error("Could not assign your role.");

    if (invitationId) {
      await supabaseAdmin
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitationId);
    }

    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: tenantId,
      actor_id: profile.id,
      action: invitationId ? "user.joined_by_invite" : "tenant.created",
      entity_type: "users",
      entity_id: profile.id,
      metadata: { role },
    });

    const created = await load();
    if (!created) throw new Error("Could not load your profile.");
    return created;
  });

/**
 * Creates an invitation. Which roles the caller may invite is decided by the
 * RLS policy on `invitations`, not by this code.
 */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; role: AppRole }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
    const role = input?.role;
    if (!["manager", "storekeeper", "sales_rep"].includes(role)) {
      throw new Error("Choose a role to invite.");
    }
    return { email, role };
  })
  .handler(async ({ data, context }) => {
    const { data: me, error: meError } = await context.supabase
      .from("users")
      .select("id, tenant_id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (meError || !me) throw new Error("Your profile is not set up yet.");

    const token = crypto.randomUUID().replace(/-/g, "");

    const { data: invite, error } = await context.supabase
      .from("invitations")
      .insert({
        tenant_id: me.tenant_id,
        email: data.email,
        role: data.role,
        token,
        invited_by: me.id,
      })
      .select("id, email, role, token, expires_at")
      .single();

    if (error || !invite) {
      throw new Error("You are not allowed to invite this role, or the invite already exists.");
    }

    return invite;
  });

export const listTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: members } = await context.supabase
      .from("users")
      .select("id, email, full_name, status, created_at")
      .order("created_at", { ascending: true });
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const { data: invites } = await context.supabase
      .from("invitations")
      .select("id, email, role, token, expires_at, accepted_at")
      .order("created_at", { ascending: false });

    return {
      members: (members ?? []).map((m) => ({
        ...m,
        roles: (roles ?? []).filter((r) => r.user_id === m.id).map((r) => r.role as AppRole),
      })),
      invites: invites ?? [],
    };
  });
