"use client";

import { useState, useTransition } from "react";
import type { TeamDept, TeamMemberStatus, TeamRole } from "@prisma/client";
import { addTeamMember, prepareTeamInvite, removeTeamMember, updateTeamMember } from "./actions";

type Member = {
  id: string;
  displayName: string;
  phoneE164: string;
  departments: TeamDept[];
  role: TeamRole;
  status: TeamMemberStatus;
};
const DEPTS: TeamDept[] = ["FOH", "BOH", "BAR", "BAKERY", "MGMT"];

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "The roster could not be updated.";
}

export function TeamRoster({ restaurantId, members }: { restaurantId: string; members: Member[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [departments, setDepartments] = useState<TeamDept[]>(["FOH"]);
  const [role, setRole] = useState<TeamRole>("MEMBER");
  const [bulk, setBulk] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ url: string; phone: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleDept(dept: TeamDept) {
    setDepartments((current) => current.includes(dept) ? current.filter((item) => item !== dept) : [...current, dept]);
  }

  function run(work: () => Promise<void>) {
    setError(""); setNotice(""); setInvite(null);
    startTransition(async () => {
      try { await work(); }
      catch (cause) { setError(errorText(cause)); }
    });
  }

  const editor = (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Name
        <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border border-line bg-ink px-3 py-2" maxLength={120} />
      </label>
      <label className="text-sm">Phone
        <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="+1 555 123 4567" className="mt-1 w-full rounded border border-line bg-ink px-3 py-2" />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm">Departments</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {DEPTS.map((dept) => <label key={dept} className="text-sm"><input type="checkbox" checked={departments.includes(dept)} onChange={() => toggleDept(dept)} className="mr-1" />{dept}</label>)}
        </div>
      </fieldset>
      <label className="text-sm">Team role
        <select value={role} onChange={(event) => setRole(event.target.value as TeamRole)} className="mt-1 w-full rounded border border-line bg-ink px-3 py-2">
          <option value="MEMBER">Member</option><option value="CONTRIBUTOR">Contributor</option><option value="MANAGER">Manager</option>
        </select>
      </label>
    </div>
  );

  return (
    <div className="space-y-7">
      <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="font-display text-xl">{editing ? "Edit member" : "Add member"}</h2>
        {editor}
        <div className="flex gap-3">
          <button disabled={pending} className="rounded bg-copper px-4 py-2 text-sm font-medium text-ink disabled:opacity-50" onClick={() => run(async () => {
            const input = { restaurantId, displayName: name, phone, departments, role };
            if (editing) await updateTeamMember({ ...input, memberId: editing });
            else await addTeamMember(input);
            setEditing(null); setName(""); setPhone(""); setRole("MEMBER"); setDepartments(["FOH"]);
            setNotice("Roster saved.");
          })}>Save member</button>
          {editing && <button className="rounded border border-line px-4 py-2 text-sm" onClick={() => setEditing(null)}>Cancel</button>}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="font-display text-xl">Paste a list</h2>
        <p className="text-sm text-muted">One person per line: name, phone, departments separated by +. Example: Alex Lee, 7175551234, FOH+BAR. New rows are invited as Members.</p>
        <textarea value={bulk} onChange={(event) => setBulk(event.target.value)} rows={4} className="w-full rounded border border-line bg-ink px-3 py-2 text-sm" />
        <button disabled={pending || !bulk.trim()} className="rounded border border-copper-dim px-4 py-2 text-sm text-copper-soft disabled:opacity-50" onClick={() => run(async () => {
          const rows = bulk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          let saved = 0;
          for (const [index, line] of rows.entries()) {
            const parts = line.split(",").map((part) => part.trim());
            if (parts.length !== 3) throw new Error(`Line ${index + 1}: use name, phone, departments. ${saved} earlier rows were saved.`);
            const rowDepts = parts[2].toUpperCase().split("+").map((part) => part.trim()) as TeamDept[];
            try { await addTeamMember({ restaurantId, displayName: parts[0], phone: parts[1], departments: rowDepts }); }
            catch (cause) { throw new Error(`Line ${index + 1}: ${errorText(cause)} ${saved} earlier rows were saved.`); }
            saved++;
          }
          setBulk(""); setNotice(`${saved} roster ${saved === 1 ? "member" : "members"} added.`);
        })}>Add list</button>
      </section>

      {error && <p role="alert" className="rounded border border-red-600 px-4 py-2 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-copper-soft">{notice}</p>}
      {invite && (
        <div className="space-y-3 rounded-lg border border-copper-dim bg-copper/10 p-4 text-sm">
          <p>Invitation link prepared for {invite.phone}. Send it from your phone or copy it below.</p>
          <a className="inline-block rounded bg-copper px-4 py-2 font-medium text-ink" href={`sms:${invite.phone}?body=${encodeURIComponent(`Join our Team Hub: ${invite.url}`)}`}>Open text message</a>
          <div className="break-all text-copper-soft">{invite.url}</div>
          <button className="underline" onClick={() => navigator.clipboard.writeText(invite.url)}>Copy link</button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl">Roster ({members.length})</h2>
        {members.length === 0 && <p className="text-sm text-muted">No team members yet.</p>}
        {members.map((member) => (
          <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
            <div>
              <strong>{member.displayName}</strong> <span className="text-muted">{member.phoneE164}</span>
              <p className="mt-1 text-xs text-muted">{member.departments.join(" · ")} · {member.role} · {member.status}</p>
            </div>
            {member.status !== "REMOVED" && <div className="flex flex-wrap gap-3">
              {member.status === "INVITED" && <button disabled={pending} className="text-copper-soft underline" onClick={() => run(async () => { setInvite(await prepareTeamInvite({ restaurantId, memberId: member.id })); })}>Text invite</button>}
              <button disabled={pending} className="underline" onClick={() => {
                setEditing(member.id); setName(member.displayName); setPhone(member.phoneE164);
                setDepartments(member.departments); setRole(member.role); window.scrollTo({ top: 0, behavior: "smooth" });
              }}>Edit</button>
              <button disabled={pending} className="text-red-300 underline" onClick={() => {
                if (window.confirm(`Remove ${member.displayName} from this team?`)) run(async () => { await removeTeamMember({ restaurantId, memberId: member.id }); setNotice("Member removed."); });
              }}>Remove</button>
            </div>}
          </div>
        ))}
      </section>
    </div>
  );
}
