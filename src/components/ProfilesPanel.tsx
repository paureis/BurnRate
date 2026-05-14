"use client";

import { useState } from "react";
import { Users, Trash2, Pencil, Plus } from "lucide-react";
import {
  buildProfile,
  defaultProfile,
  normalizeProfiles,
  reassignOnProfileDelete,
  type Profile,
} from "@/lib/profiles";
import type { Subscription } from "@/lib/burnrate";

interface ProfilesPanelProps {
  profiles: Profile[];
  subscriptions: Subscription[];
  onProfilesChange: (next: Profile[]) => void;
  onSubsChange: (next: Subscription[]) => void;
}

const COLORS = ["#ff5a3d", "#37f29b", "#ffd166", "#b388ff", "#7cc7ff", "#f970a8", "#6ee7f9", "#ff9f1c"];

export function ProfilesPanel({ profiles, subscriptions, onProfilesChange, onSubsChange }: ProfilesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(COLORS[1]);
  const [adding, setAdding] = useState(false);

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setDraftName(profile.name);
    setDraftColor(profile.avatarColor);
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraftName("");
    setDraftColor(COLORS[1]);
  }

  function commit() {
    if (!draftName.trim()) return;
    if (adding) {
      const created = buildProfile({ name: draftName, avatarColor: draftColor });
      onProfilesChange(normalizeProfiles([...profiles, created]));
      setAdding(false);
      return;
    }
    if (editingId) {
      onProfilesChange(
        profiles.map((p) =>
          p.id === editingId ? { ...p, name: draftName.trim(), avatarColor: draftColor } : p,
        ),
      );
      setEditingId(null);
    }
  }

  function remove(profile: Profile) {
    if (profile.isDefault) return;
    const fallback = profiles.find((p) => p.isDefault) ?? profiles[0];
    if (!fallback || fallback.id === profile.id) return;
    onSubsChange(reassignOnProfileDelete(subscriptions, profile.id, fallback.id));
    onProfilesChange(profiles.filter((p) => p.id !== profile.id));
  }

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Household profiles</h2>
        </div>
        <button type="button" className="button-secondary text-xs" onClick={startAdd}>
          <Plus aria-hidden="true" size={13} />
          Add
        </button>
      </div>
      <p className="mb-3 text-xs text-[color:var(--muted)]">
        Split a subscription across people in your household. Each subscription can be owned wholly or fractionally; the
        active-profile filter scales monthly numbers by share.
      </p>

      <ul className="grid gap-2">
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className="flex items-center gap-3 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
          >
            {editingId === profile.id ? (
              <ProfileForm
                draftName={draftName}
                draftColor={draftColor}
                onName={setDraftName}
                onColor={setDraftColor}
                onCommit={commit}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold"
                  style={{ background: profile.avatarColor, color: "#140b08" }}
                >
                  {(profile.avatarInitials ?? profile.name).slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{profile.name}</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {profile.isDefault ? "Default profile" : "Profile"} · created {profile.createdAt.slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit ${profile.name}`}
                    onClick={() => startEdit(profile)}
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </button>
                  {!profile.isDefault && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete ${profile.name}`}
                      onClick={() => remove(profile)}
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
        {adding && (
          <li className="rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-3">
            <ProfileForm
              draftName={draftName}
              draftColor={draftColor}
              onName={setDraftName}
              onColor={setDraftColor}
              onCommit={commit}
              onCancel={() => setAdding(false)}
            />
          </li>
        )}
      </ul>
    </section>
  );
}

function ProfileForm({
  draftName,
  draftColor,
  onName,
  onColor,
  onCommit,
  onCancel,
}: {
  draftName: string;
  draftColor: string;
  onName: (value: string) => void;
  onColor: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="grid w-full gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit();
      }}
    >
      <label className="label text-xs">
        Name
        <input className="input" value={draftName} onChange={(event) => onName(event.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-1">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="h-6 w-6 rounded-full border border-[color:var(--line)]"
            style={{ background: color, outline: color === draftColor ? "2px solid var(--accent)" : undefined }}
            aria-label={`Color ${color}`}
            onClick={() => onColor(color)}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="button-ghost text-xs" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button-primary text-xs">
          Save
        </button>
      </div>
    </form>
  );
}

export { defaultProfile };
