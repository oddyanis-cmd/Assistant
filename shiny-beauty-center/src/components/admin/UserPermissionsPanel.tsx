/**
 * UserPermissionsPanel — client component for managing a single user's roles +
 * per-permission overrides. Uses server actions for mutations.
 */
"use client";

import { useState, useTransition } from "react";
import type { Role, Permission } from "@/lib/supabase/types";
import type { UserWithRoles } from "@/lib/metrics";
import {
  assignRoleAction,
  removeRoleAction,
  setPermissionAction,
  clearPermissionAction,
} from "@/app/[locale]/admin/users/actions";

interface PermissionOverride {
  permissionId: string;
  granted: boolean;
}

interface Props {
  user: UserWithRoles;
  allRoles: Role[];
  allPermissions: Permission[];
  userOverrides: PermissionOverride[];
  userEffectivePerms: string[];
  locale: string;
  labels: {
    roles_section: string;
    permissions_section: string;
    permissions_note: string;
    grant: string;
    revoke: string;
    clear: string;
    assign_role: string;
    remove_role: string;
    effective_perms: string;
    invite_stub: string;
  };
  canManagePerms: boolean;
  canAssignRoles: boolean;
}

export function UserPermissionsPanel({
  user,
  allRoles,
  allPermissions,
  userOverrides,
  userEffectivePerms,
  locale,
  labels,
  canManagePerms,
  canAssignRoles,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localRoles, setLocalRoles] = useState<Array<{ id: string; name: string }>>(user.roles);
  const [localOverrides, setLocalOverrides] = useState<PermissionOverride[]>(userOverrides);
  const [expandPerms, setExpandPerms] = useState(false);

  // Compute effective permissions locally for display
  const rolePermKeys = new Set<string>(); // We can't compute this client-side without role→perm map; show server value
  const overrideMap = new Map<string, boolean>(localOverrides.map((o) => [o.permissionId, o.granted]));

  function handleAssignRole(roleId: string) {
    const role = allRoles.find((r) => r.id === roleId);
    if (!role || localRoles.some((r) => r.id === roleId)) return;
    startTransition(async () => {
      setError(null);
      const res = await assignRoleAction(user.userId, roleId, locale);
      if (res.error) { setError(res.error); return; }
      setLocalRoles((prev) => [...prev, { id: role.id, name: role.name }]);
    });
  }

  function handleRemoveRole(roleId: string) {
    startTransition(async () => {
      setError(null);
      const res = await removeRoleAction(user.userId, roleId, locale);
      if (res.error) { setError(res.error); return; }
      setLocalRoles((prev) => prev.filter((r) => r.id !== roleId));
    });
  }

  function handleSetPermission(permId: string, granted: boolean) {
    startTransition(async () => {
      setError(null);
      const res = await setPermissionAction(user.userId, permId, granted, locale);
      if (res.error) { setError(res.error); return; }
      setLocalOverrides((prev) => {
        const without = prev.filter((o) => o.permissionId !== permId);
        return [...without, { permissionId: permId, granted }];
      });
    });
  }

  function handleClearPermission(permId: string) {
    startTransition(async () => {
      setError(null);
      const res = await clearPermissionAction(user.userId, permId, locale);
      if (res.error) { setError(res.error); return; }
      setLocalOverrides((prev) => prev.filter((o) => o.permissionId !== permId));
    });
  }

  const unassignedRoles = allRoles.filter((r) => !localRoles.some((lr) => lr.id === r.id));

  // Group permissions by module
  const permsByModule: Record<string, Permission[]> = {};
  for (const p of allPermissions) {
    if (!permsByModule[p.module]) permsByModule[p.module] = [];
    permsByModule[p.module].push(p);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Roles section */}
      {canAssignRoles && (
        <div>
          <h3 className="text-sm font-semibold text-charcoal-700 mb-2">{labels.roles_section}</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {localRoles.map((r) => (
              <span
                key={r.id}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-medium"
              >
                {r.name}
                <button
                  onClick={() => handleRemoveRole(r.id)}
                  disabled={isPending}
                  className="text-rose-400 hover:text-rose-700 font-bold leading-none"
                  title={labels.remove_role}
                >
                  ×
                </button>
              </span>
            ))}
            {localRoles.length === 0 && (
              <span className="text-xs text-charcoal-400 italic">No roles assigned</span>
            )}
          </div>

          {unassignedRoles.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className="field-input text-sm w-auto"
                onChange={(e) => { if (e.target.value) { handleAssignRole(e.target.value); e.target.value = ""; } }}
                defaultValue=""
                disabled={isPending}
              >
                <option value="" disabled>{labels.assign_role}</option>
                {unassignedRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Permission overrides */}
      {canManagePerms && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-charcoal-700">{labels.permissions_section}</h3>
            <button
              onClick={() => setExpandPerms((v) => !v)}
              className="text-xs text-rose-600 hover:underline"
            >
              {expandPerms ? "Collapse" : "Expand all"}
            </button>
          </div>
          <p className="text-xs text-charcoal-400 mb-3">{labels.permissions_note}</p>

          <div className="space-y-4 max-h-80 overflow-y-auto pe-1">
            {Object.entries(permsByModule).map(([module, perms]) => (
              <div key={module}>
                <p className="text-[10px] font-bold text-charcoal-400 uppercase tracking-widest mb-1.5">
                  {module}
                </p>
                <div className="space-y-1">
                  {perms.map((p) => {
                    const override = overrideMap.get(p.id);
                    const isGranted  = override === true;
                    const isRevoked  = override === false;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs gap-2 ${
                          isGranted ? "bg-green-50 border border-green-200" :
                          isRevoked ? "bg-red-50 border border-red-200" :
                          "bg-nude-50 border border-nude-100"
                        }`}
                      >
                        <span className="font-mono text-charcoal-700 truncate">{p.key}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleSetPermission(p.id, true)}
                            disabled={isPending || isGranted}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                              isGranted
                                ? "bg-green-500 text-white cursor-default"
                                : "bg-nude-100 text-charcoal-600 hover:bg-green-100 hover:text-green-700"
                            }`}
                            title={labels.grant}
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleSetPermission(p.id, false)}
                            disabled={isPending || isRevoked}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                              isRevoked
                                ? "bg-red-500 text-white cursor-default"
                                : "bg-nude-100 text-charcoal-600 hover:bg-red-100 hover:text-red-700"
                            }`}
                            title={labels.revoke}
                          >
                            −
                          </button>
                          {override !== undefined && (
                            <button
                              onClick={() => handleClearPermission(p.id)}
                              disabled={isPending}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-nude-100 text-charcoal-500 hover:bg-charcoal-100 transition-colors"
                              title={labels.clear}
                            >
                              ○
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Effective permissions (display) */}
      <div>
        <h3 className="text-sm font-semibold text-charcoal-700 mb-2">{labels.effective_perms}</h3>
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
          {userEffectivePerms.map((perm) => (
            <span
              key={perm}
              className="text-[10px] px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-mono"
            >
              {perm}
            </span>
          ))}
          {userEffectivePerms.length === 0 && (
            <span className="text-xs text-charcoal-400 italic">No permissions</span>
          )}
        </div>
      </div>

      {isPending && (
        <div className="text-xs text-charcoal-400 animate-pulse">Saving…</div>
      )}
    </div>
  );
}
