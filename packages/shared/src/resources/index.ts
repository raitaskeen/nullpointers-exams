import type { ResourceDef } from "../resource";
// GENERATOR:IMPORTS (bun run gen adds imports above this line - keep it)

export const resources = {
  // GENERATOR:ENTRIES (bun run gen adds entries above this line - keep it)
} satisfies Record<string, ResourceDef>;

export type ResourceName = keyof typeof resources;

/** Look up by the resource's URL/permission name (kebab-case, e.g. "order-items"). */
export function getResource(name: string): ResourceDef | undefined {
  return allResources().find((r) => r.name === name);
}

export function allResources(): ResourceDef[] {
  return Object.values(resources as Record<string, ResourceDef>);
}
