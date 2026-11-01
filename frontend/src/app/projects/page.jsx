"use client";

import { useCallback, useEffect, useState } from "react";
import { Clapperboard, Plus, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

export default function ProjectsPage() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", client: "", contract: "", description: "", status: "planning", startDate: "", deadline: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projects, clientResult, contractResult] = await Promise.all([api("/projects?limit=100"), api("/clients?limit=100"), api("/contract-options")]);
      setItems(projects.items);
      setClients(clientResult.items);
      setContracts(contractResult.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load projects."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/projects", { method: "POST", body: JSON.stringify({ ...form, contract: form.contract || undefined, startDate: form.startDate || undefined, deadline: form.deadline || undefined }) });
      setModal(false);
      setForm({ name: "", client: "", contract: "", description: "", status: "planning", startDate: "", deadline: "" });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create project."); }
    finally { setBusy(false); }
  }

  async function changeStatus(project, status) {
    setError("");
    try { await api(`/projects/${project._id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update project."); }
  }

  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> CAMPAIGNS & DELIVERABLES</div><h1>Projects</h1><p>Group production work around client campaigns and engagements.</p></div><button className="button button-primary" onClick={() => { setError(""); setModal(true); }}><Plus size={16} /> New project</button></section>
    {error && !modal && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel list-panel">{loading ? <div className="table-loading"><span className="spinner" />Loading projects…</div> : items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Clapperboard size={21} /></div><h3>No projects yet</h3><p>Create a project and connect client reels and production tasks to it.</p><button className="button button-secondary" onClick={() => setModal(true)}>Create a project</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>PROJECT</th><th>CLIENT</th><th>CONTRACT</th><th>START</th><th>DEADLINE</th><th>STATUS</th><th>UPDATE</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td>{item.name}<small className="table-subtext">{item.description || "—"}</small></td><td>{item.client?.name}</td><td>{item.contract?.number || "—"}</td><td>{item.startDate ? new Date(item.startDate).toLocaleDateString() : "—"}</td><td>{item.deadline ? new Date(item.deadline).toLocaleDateString() : "—"}</td><td><span className={`status-pill status-${item.status === "active" ? "active" : item.status === "planning" ? "lead" : "inactive"}`}>{item.status.replace("_", " ")}</span></td><td><select className="inline-select" aria-label={`Update status for ${item.name}`} value={item.status} onChange={(event) => void changeStatus(item, event.target.value)}><option value="planning">Planning</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table></div>}</section>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="project-title"><div className="modal-header"><div><div className="section-kicker">PROJECT SETUP</div><h2 id="project-title">Create a project</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setModal(false)}><X size={17} /></button></div><form className="modal-form" onSubmit={create}>
      <label className="form-field"><span>Project name *</span><input autoFocus required maxLength={180} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <div className="form-grid"><label className="form-field"><span>Client *</span><select required value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value, contract: "" })}><option value="">Select client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</select></label><label className="form-field"><span>Contract (optional)</span><select value={form.contract} onChange={(event) => setForm({ ...form, contract: event.target.value })}><option value="">No contract</option>{contracts.filter((contract) => !form.client || contract.client?._id === form.client).map((contract) => <option key={contract._id} value={contract._id}>{contract.number} · {contract.title}</option>)}</select></label></div>
      <div className="form-grid"><label className="form-field"><span>Start date</span><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label className="form-field"><span>Deadline</span><input type="date" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} /></label></div>
      <label className="form-field"><span>Description</span><textarea maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" disabled={busy || clients.length === 0}>{busy ? "Creating…" : "Create project"}</button></div>
    </form></section></div>}
  </AppShell>;
}
