"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Shield, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

export default function TeamPage() {
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [roleModal, setRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: "", permissions: [] });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [memberResult, roleResult] = await Promise.all([api("/team?limit=100"), api("/team/roles")]);
      setMembers(memberResult.items);
      setRoles(roleResult.items);
      setAvailablePermissions(roleResult.permissions);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load your team."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/team", { method: "POST", body: JSON.stringify(form) });
      setModal(false);
      setForm({ name: "", email: "", password: "", role: "" });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create account."); }
    finally { setBusy(false); }
  }

  async function toggle(member) {
    setError("");
    try {
      await api(`/team/${member._id}/status`, { method: "PATCH", body: JSON.stringify({ active: !member.active }) });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update team member."); }
  }

  async function createRole(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(editingRole ? `/team/roles/${editingRole._id}` : "/team/roles", { method: editingRole ? "PATCH" : "POST", body: JSON.stringify(roleForm) });
      setRoleModal(false);
      setEditingRole(null);
      setRoleForm({ name: "", permissions: [] });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create role."); }
    finally { setBusy(false); }
  }

  const permissionOptions = availablePermissions;

  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> PEOPLE & ACCESS</div><h1>Team</h1><p>Create staff accounts and assign a least-privilege built-in role.</p></div><button className="button button-primary" onClick={() => { setError(""); setModal(true); }}><Plus size={16} /> Add team member</button></section>
    {error && !modal && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel list-panel">{loading ? <div className="table-loading"><span className="spinner" />Loading team…</div> : members.length === 0 ? <div className="empty-state"><div className="empty-icon"><UserRound size={21} /></div><h3>No team accounts</h3><p>Create accounts for editors, shooters, marketers and administrators.</p><button className="button button-secondary" onClick={() => setModal(true)}>Add a team member</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>TEAM MEMBER</th><th>ROLE</th><th>STATUS</th><th>LAST LOGIN</th><th>JOINED</th><th>ACTION</th></tr></thead><tbody>{members.map((member) => <tr key={member._id}><td><div className="table-client"><span className="client-mark"><UserRound size={14} /></span><span>{member.name}<small className="table-subtext">{member.email}</small></span></div></td><td><span className="role-label"><Shield size={13} /> {member.role?.name || "Unassigned"}</span></td><td><span className={`status-pill ${member.active ? "status-active" : "status-inactive"}`}>{member.active ? "Active" : "Inactive"}</span></td><td>{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : "Never"}</td><td>{new Date(member.createdAt).toLocaleDateString()}</td><td><button className="text-button" disabled={member.role?.name === "Owner" && members.filter((user) => user.role?.name === "Owner" && user.active).length <= 1} onClick={() => void toggle(member)}>{member.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>}</section>
    <section className="panel roles-panel"><div className="panel-heading"><div><div className="section-kicker">ROLE CATALOGUE</div><h2>Role permissions</h2></div><button className="button button-secondary" onClick={() => { setError(""); setEditingRole(null); setRoleForm({ name: "", permissions: [] }); setRoleModal(true); }}><Plus size={14} /> Create custom role</button></div><div className="role-grid">{roles.map((role) => <article className="role-card" key={role._id}><div><b>{role.name}</b><span>{role.isSystem ? "Built-in" : "Custom"} · {role.permissions.length} permissions</span></div><small>{role.permissions.join(" · ")}</small>{!role.isSystem && <button className="text-button" onClick={() => { setError(""); setEditingRole(role); setRoleForm({ name: role.name, permissions: role.permissions }); setRoleModal(true); }}>Edit role</button>}</article>)}</div></section>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="team-dialog-title"><div className="modal-header"><div><div className="section-kicker">ADMIN-CREATED ACCOUNT</div><h2 id="team-dialog-title">Add team member</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setModal(false)}><X size={17} /></button></div><form className="modal-form" onSubmit={create}><label className="form-field"><span>Name *</span><input autoFocus required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="form-field"><span>Work email *</span><input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="form-field"><span>Role *</span><select required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="">Select role</option>{roles.map((role) => <option key={role._id} value={role._id}>{role.name}</option>)}</select></label><label className="form-field"><span>Temporary password * (12+ characters)</span><input required type="password" minLength={12} maxLength={200} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><p className="form-hint">No email/invitation provider is configured. Share the temporary credentials securely; the member can sign in with this password.</p>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" disabled={busy || !roles.length}>{busy ? "Creating…" : "Create account"}</button></div></form></section></div>}
    {roleModal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRoleModal(false); }}><section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="role-dialog-title"><div className="modal-header"><div><div className="section-kicker">LEAST-PRIVILEGE ACCESS</div><h2 id="role-dialog-title">{editingRole ? "Edit custom role" : "Create custom role"}</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setRoleModal(false)}><X size={17} /></button></div><form className="modal-form" onSubmit={createRole}><label className="form-field"><span>Role name *</span><input required autoFocus minLength={2} maxLength={80} value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} /></label><fieldset className="permission-fieldset"><legend>Permissions</legend><div className="permission-grid">{permissionOptions.map((permission) => <label key={permission}><input type="checkbox" checked={roleForm.permissions.includes(permission)} onChange={(event) => setRoleForm({ ...roleForm, permissions: event.target.checked ? [...roleForm.permissions, permission] : roleForm.permissions.filter((item) => item !== permission) })} />{permission}</label>)}</div></fieldset>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setRoleModal(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingRole ? "Save changes" : "Create role"}</button></div></form></section></div>}
  </AppShell>;
}
