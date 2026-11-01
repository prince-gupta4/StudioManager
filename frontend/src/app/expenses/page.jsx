"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Wallet, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

const categories = ["Travel", "Equipment", "Camera rental", "Lighting", "Freelancers", "Salaries", "Software subscriptions", "Internet", "Advertising", "Miscellaneous"];
const money = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function ExpensesPage() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", category: "Travel", date: new Date().toISOString().slice(0, 10), paymentMethod: "other", client: "", project: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, options] = await Promise.all([api("/expenses?limit=100"), api("/expenses/options")]);
      setItems(result.items);
      setClients(options.clients);
      setProjects(options.projects);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load expenses."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/expenses", { method: "POST", body: JSON.stringify({
        title: form.title, amountPaise: Math.round(Number(form.amount) * 100), category: form.category,
        date: form.date, paymentMethod: form.paymentMethod,
        ...(form.client ? { client: form.client } : {}),
        ...(form.project ? { project: form.project } : {}),
        notes: form.notes,
      }) });
      setModal(false);
      setForm({ ...form, title: "", amount: "", notes: "" });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save expense."); }
    finally { setBusy(false); }
  }

  const total = items.reduce((sum, item) => sum + item.amountPaise, 0);
  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> COSTS & PROFITABILITY</div><h1>Expenses</h1><p>Record operating costs and optional client or project associations.</p></div><button className="button button-primary" onClick={() => { setError(""); setModal(true); }}><Plus size={16} /> Record expense</button></section>
    <section className="stats-grid expense-summary"><article className="stat-card"><div className="stat-top"><span className="stat-label">Recorded expenses</span><span className="stat-icon orange"><Wallet size={18} /></span></div><div className="stat-value">{items.length}</div><div className="stat-foot"><span>Visible records</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-label">Total recorded</span><span className="stat-icon violet"><Wallet size={18} /></span></div><div className="stat-value">{money(total)}</div><div className="stat-foot"><span>For current page</span></div></article></section>
    {error && !modal && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel list-panel">{loading ? <div className="table-loading"><span className="spinner" />Loading expenses…</div> : items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Wallet size={21} /></div><h3>No expenses recorded</h3><p>Record operating costs to start building actual project profitability data.</p><button className="button button-secondary" onClick={() => setModal(true)}>Record an expense</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>EXPENSE</th><th>CATEGORY</th><th>DATE</th><th>PAYMENT</th><th>CLIENT / PROJECT</th><th>AMOUNT</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td><b>{item.title}</b><small className="table-subtext">{item.notes || "—"}</small></td><td>{item.category}</td><td>{new Date(item.date).toLocaleDateString()}</td><td>{item.paymentMethod.replaceAll("_", " ")}</td><td>{item.client?.name || "—"}<small className="table-subtext">{item.project?.name || ""}</small></td><td><b>{money(item.amountPaise)}</b></td></tr>)}</tbody><tfoot><tr><td colSpan="5">Total · {items.length} records</td><td>{money(total)}</td></tr></tfoot></table></div>}</section>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="expense-title"><div className="modal-header"><div><div className="section-kicker">COST RECORD</div><h2 id="expense-title">Record an expense</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setModal(false)}><X size={17} /></button></div><form className="modal-form" onSubmit={create}>
      <label className="form-field"><span>Expense title *</span><input autoFocus required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <div className="form-grid"><label className="form-field"><span>Amount (₹) *</span><input required type="number" min=".01" step=".01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label className="form-field"><span>Date *</span><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label></div>
      <div className="form-grid"><label className="form-field"><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="form-field"><span>Payment method</span><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option value="other">Other</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option></select></label></div>
      <div className="form-grid"><label className="form-field"><span>Client (optional)</span><select value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value, project: "" })}><option value="">None</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</select></label><label className="form-field"><span>Project (optional)</span><select value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}><option value="">None</option>{projects.filter((project) => !form.client || project.client?._id === form.client).map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label></div>
      <label className="form-field"><span>Notes</span><textarea maxLength={3000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save expense"}</button></div>
    </form></section></div>}
  </AppShell>;
}
