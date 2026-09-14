import { createServerFn } from "@tanstack/react-start";

export type BackendHealth = {
  reachable: boolean;
  checkedAt: string;
  detail: string;
};

/**
 * Phase 0 connectivity probe: confirms the app can reach the backend auth
 * endpoint. No tables exist yet, so nothing is queried.
 */
export const checkBackendHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<BackendHealth> => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const checkedAt = new Date().toISOString();

    if (!url || !key) {
      return { reachable: false, checkedAt, detail: "Backend config missing" };
    }

    try {
      const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
      return response.ok
        ? { reachable: true, checkedAt, detail: "Auth service responding" }
        : { reachable: false, checkedAt, detail: `Auth service returned ${response.status}` };
    } catch {
      return { reachable: false, checkedAt, detail: "Could not reach the backend" };
    }
  },
);
