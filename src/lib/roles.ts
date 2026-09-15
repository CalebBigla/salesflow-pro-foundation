export type AppRole = "owner" | "manager" | "storekeeper" | "sales_rep";

export const roleLabels: Record<AppRole, string> = {
  owner: "Business Owner",
  manager: "Manager",
  storekeeper: "Storekeeper",
  sales_rep: "Sales Representative",
};

/** Each role has its own dashboard root — never a shared /dashboard. */
export const roleHome: Record<AppRole, string> = {
  owner: "/owner",
  manager: "/manager",
  storekeeper: "/storekeeper",
  sales_rep: "/sales-rep",
};

/** Highest role first, matching the PRD hierarchy. */
export const rolePriority: AppRole[] = ["owner", "manager", "storekeeper", "sales_rep"];

export function primaryRole(roles: AppRole[]): AppRole | null {
  return rolePriority.find((role) => roles.includes(role)) ?? null;
}

export function homeForRoles(roles: AppRole[]): string {
  const role = primaryRole(roles);
  return role ? roleHome[role] : "/no-access";
}
