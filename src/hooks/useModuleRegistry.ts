import { useEffect, useState } from "react";
import { registryApi, type ModuleRegistryGroup } from "@/lib/api";

/**
 * Phase 1 (v2 Architecture Freeze) — reads the backend Module Registry.
 * Not wired into AppSidebar yet; that happens in the Dynamic Sidebar
 * milestone, behind a feature flag. See docs/v2-master/11-Architecture-Freeze.md §6.
 */
export function useModuleRegistry() {
  const [groups, setGroups] = useState<ModuleRegistryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    registryApi
      .get()
      .then((res) => { if (!cancelled) setGroups(res.groups); })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load module registry"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { groups, loading, error };
}
