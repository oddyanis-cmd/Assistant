/**
 * RoleManager — client component for the Roles & Positions admin page.
 * Left: role list (system badge + permission count + "New role").
 * Right: editor — name (locked for system roles), description, grouped
 * permission checkboxes (per-module select-all), Save + Delete.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import type { Permission, Role } from "@/lib/supabase/types";
import { upsertRoleAction, deleteRoleAction } from "@/app/[locale]/admin/roles/actions";

interface Props {
  roles: Role[];
  permissions: Permission[];
  /** roleId -> permission keys currently assigned to that role */
  rolePermKeys: Record<string, string[]>;
  locale: string;
  supabaseReady: boolean;
}

interface Draft {
  /** null = creating a new role */
  id: string | null;
  name: string;
  description: string;
  permissions: Set<string>;
  isSystem: boolean;
}

function emptyDraft(): Draft {
  return { id: null, name: "", description: "", permissions: new Set<string>(), isSystem: false };
}

function draftFromRole(role: Role, rolePermKeys: Record<string, string[]>): Draft {
  return {
    id: role.id,
    name: role.name,
    description: role.description ?? "",
    permissions: new Set(rolePermKeys[role.id] ?? []),
    isSystem: role.is_system,
  };
}

export function RoleManager({ roles, permissions, rolePermKeys, locale, supabaseReady }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Group permissions by module (already ordered by module, key from the server query)
  const permsByModule: Record<string, Permission[]> = {};
  for (const p of permissions) {
    if (!permsByModule[p.module]) permsByModule[p.module] = [];
    permsByModule[p.module].push(p);
  }

  function selectRole(role: Role) {
    setMessage(null);
    setDraft(draftFromRole(role, rolePermKeys));
  }

  function selectNew() {
    setMessage(null);
    setDraft(emptyDraft());
  }

  function togglePermission(key: string) {
    setDraft((prev) => {
      const next = new Set(prev.permissions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, permissions: next };
    });
  }

  function toggleModule(keys: string[], selectAll: boolean) {
    setDraft((prev) => {
      const next = new Set(prev.permissions);
      for (const key of keys) {
        if (selectAll) next.add(key);
        else next.delete(key);
      }
      return { ...prev, permissions: next };
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setMessage({ ok: false, text: "Role name is required." });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await upsertRoleAction(
        {
          id: draft.id,
          name: draft.name,
          description: draft.description,
          permissions: Array.from(draft.permissions),
        },
        locale
      );
      if (result.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({ ok: true, text: draft.id ? "Role updated." : "Role created." });
      if (!draft.id && result.id) {
        const newId = result.id;
        setDraft((prev) => ({ ...prev, id: newId }));
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!draft.id || draft.isSystem) return;
    if (!window.confirm(`Delete the "${draft.name}" role? This cannot be undone.`)) return;
    const roleId = draft.id;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteRoleAction(roleId, locale);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      selectNew();
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ---- Role list ---- */}
      <div className="lg:col-span-1 space-y-3">
        <button
          type="button"
          onClick={selectNew}
          disabled={!supabaseReady}
          className="btn-primary text-sm w-full"
        >
          + New role
        </button>

        <div className="space-y-2">
          {roles.map((role) => {
            const count = rolePermKeys[role.id]?.length ?? 0;
            const isSelected = role.id === draft.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role)}
                className={`w-full text-start p-4 rounded-xl border transition-all ${
                  isSelected
                    ? "border-rose-400 bg-rose-50"
                    : "border-nude-200 bg-white hover:border-rose-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-charcoal-800 truncate">{role.name}</p>
                  {role.is_system && (
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-nude-100 text-nude-700 font-medium">
                      System
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="text-xs text-charcoal-400 truncate mt-1">{role.description}</p>
                )}
                <p className="text-[10px] text-charcoal-400 mt-1.5">
                  {count} permission{count === 1 ? "" : "s"}
                </p>
              </button>
            );
          })}
          {roles.length === 0 && (
            <p className="text-sm text-charcoal-400 italic py-8 text-center card">
              No roles yet. Create the first one.
            </p>
          )}
        </div>
      </div>

      {/* ---- Editor ---- */}
      <div className="lg:col-span-2">
        <form onSubmit={handleSave} className="card sticky top-24 space-y-6">
          {message && (
            <div
              className={`rounded-xl px-4 py-3 text-sm border ${
                message.ok
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-charcoal-800 mb-1">
              {draft.id ? "Edit role" : "New role"}
            </h2>
            {draft.isSystem && (
              <p className="text-xs text-charcoal-400">
                Built-in system role — the name is fixed, but the description and permissions can
                still be edited.
              </p>
            )}
          </div>

          <div>
            <label className="field-label">Role name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              required
              disabled={isPending || draft.isSystem || !supabaseReady}
              className="field-input"
              placeholder="e.g. Front Desk Coordinator"
            />
          </div>

          <div>
            <label className="field-label">Description</label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              disabled={isPending || !supabaseReady}
              className="field-input resize-none"
              placeholder="What does this role do?"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-charcoal-700">Permissions</p>
              <span className="text-xs text-charcoal-400">{draft.permissions.size} selected</span>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto pe-1">
              {Object.entries(permsByModule).map(([mod, perms]) => {
                const keys = perms.map((p) => p.key);
                const allSelected = keys.every((k) => draft.permissions.has(k));
                return (
                  <div key={mod}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold text-charcoal-400 uppercase tracking-widest">
                        {mod}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleModule(keys, !allSelected)}
                        disabled={isPending || !supabaseReady}
                        className="text-[10px] text-rose-600 hover:underline"
                      >
                        {allSelected ? "Clear all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {perms.map((p) => {
                        const checked = draft.permissions.has(p.key);
                        return (
                          <label
                            key={p.id}
                            title={p.description ?? p.key}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer border ${
                              checked
                                ? "bg-green-50 border-green-200"
                                : "bg-nude-50 border-nude-100 hover:border-rose-200"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(p.key)}
                              disabled={isPending || !supabaseReady}
                              className="h-3.5 w-3.5 rounded border-nude-300 text-rose-500"
                            />
                            <span className="font-mono text-charcoal-700 truncate">{p.key}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {permissions.length === 0 && (
                <p className="text-xs text-charcoal-400 italic">No permissions found.</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-nude-100">
            <button type="submit" disabled={isPending || !supabaseReady} className="btn-primary text-sm">
              {isPending ? "Saving…" : "Save role"}
            </button>
            {draft.id && !draft.isSystem && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending || !supabaseReady}
                className="text-xs text-charcoal-400 hover:text-red-600"
              >
                Delete role
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
