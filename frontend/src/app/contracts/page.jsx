"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarPlus, FileText, Plus, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

const emptyLine = { service: "", quantity: "1", includedQuantity: "0", unit: "per reel", rate: "0", additionalRate: "0", tax: "0", billingFrequency: "monthly", recurring: true, billOnCompletion: false };
const money = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [usageItems, setUsageItems] = useState([]);
  const [form, setForm] = useState({ client: "", title: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", billingFrequency: "monthly", billingDay: "1", paymentDueDays: "15", status: "active", items: [{ ...emptyLine }] });
  const [cycleForm, setCycleForm] = useState({ contract: "", startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10), endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [contractResult, cycleResult, clientResult, serviceResult] = await Promise.all([
        api("/contracts?limit=100"),
        api("/contracts/billing-cycles"),
        api("/clients?limit=100"),
        api("/services"),
      ]);
      setContracts(contractResult.items);
      setCycles(cycleResult.items);
      setClients(clientResult.items);
      setServices(serviceResult.items.filter((service) => service.active));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load contracts.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function updateLine(index, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((line, i) => i === index ? { ...line, [field]: value } : line) }));
  }

  async function createContract(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const items = form.items.map((line) => ({
      service: line.service,
      quantity: Number(line.quantity),
      includedQuantity: Number(line.includedQuantity),
      unit: line.unit,
      ratePaise: Math.round(Number(line.rate) * 100),
      additionalUnitRatePaise: Math.round(Number(line.additionalRate) * 100),
      taxRateBasisPoints: Math.round(Number(line.tax) * 100),
      billingFrequency: line.billingFrequency,
      recurring: line.recurring,
      billOnCompletion: line.billOnCompletion,
    }));
    try {
      await api("/contracts", { method: "POST", body: JSON.stringify({
        client: form.client, title: form.title, startDate: form.startDate,
        ...(form.endDate ? { endDate: form.endDate } : {}),
        billingFrequency: form.billingFrequency, billingDay: Number(form.billingDay),
        paymentDueDays: Number(form.paymentDueDays), status: form.status, items,
      }) });
      setModal("");
      setForm({ ...form, title: "", items: [{ ...emptyLine }] });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create contract."); }
    finally { setBusy(false); }
  }

  async function createCycle(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/contracts/${cycleForm.contract}/billing-cycles`, { method: "POST", body: JSON.stringify({ startDate: cycleForm.startDate, endDate: cycleForm.endDate }) });
      setModal("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open billing cycle."); }
    finally { setBusy(false); }
  }

  function editCycleUsage(cycle) {
    setSelectedCycle(cycle);
    setUsageItems(cycle.items.map((item) => ({
      contractItemId: item.contractItemId,
      assignedQuantity: String(item.assignedQuantity || 0),
      completedQuantity: String(item.completedQuantity || 0),
      approvedQuantity: String(item.approvedQuantity || 0),
      deliveredQuantity: String(item.deliveredQuantity || 0),
      billableQuantity: String(item.billableQuantity || 0),
      additionalQuantity: String(item.additionalQuantity || 0),
    })));
    setError("");
    setModal("usage");
  }

  async function saveCycleUsage(event) {
    event.preventDefault();
    if (!selectedCycle) return;
    setBusy(true);
    setError("");
    try {
      await api(`/contracts/billing-cycles/${selectedCycle._id}/quantities`, {
        method: "PATCH",
        body: JSON.stringify({ items: usageItems.map((item) => ({
          ...item,
          assignedQuantity: Number(item.assignedQuantity),
          completedQuantity: Number(item.completedQuantity),
          approvedQuantity: Number(item.approvedQuantity),
          deliveredQuantity: Number(item.deliveredQuantity),
          billableQuantity: Number(item.billableQuantity),
          additionalQuantity: Number(item.additionalQuantity),
        })) }),
      });
      setModal("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save cycle quantities."); }
    finally { setBusy(false); }
  }

  async function setStatus(contract, status) {
    setError("");
    try {
      await api(`/contracts/${contract._id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update contract."); }
  }

  return <AppShell>
    <section className="content-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> COMMERCIAL TERMS & ENTITLEMENTS</div><h1>Contracts</h1><p>Manage service agreements and create dated billing-cycle snapshots.</p></div>
      <div className="heading-actions"><button className="button button-secondary" onClick={() => { setError(""); setModal("cycle"); }}><CalendarPlus size={15} /> Open billing cycle</button><button className="button button-primary" onClick={() => { setError(""); setModal("contract"); }}><Plus size={16} /> New contract</button></div>
    </section>
    {error && !modal && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel list-panel">
      <div className="panel-heading table-panel-heading"><div><div className="section-kicker">AGREEMENTS</div><h2>Client contracts <span className="record-count">{contracts.length}</span></h2></div></div>
      {loading ? <div className="table-loading"><span className="spinner" />Loading contracts…</div> : contracts.length === 0 ? <div className="empty-state"><div className="empty-icon"><FileText size={21} /></div><h3>No contracts created</h3><p>Create a client contract and define included services, rates and additional work pricing.</p><button className="button button-secondary" onClick={() => setModal("contract")}>Create a contract</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>CONTRACT</th><th>CLIENT</th><th>TERM</th><th>ITEMS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
        {contracts.map((contract) => <tr key={contract._id}><td><b>{contract.number}</b><small className="table-subtext">{contract.title}</small></td><td>{contract.client?.name || "Client"}</td><td>{new Date(contract.startDate).toLocaleDateString()}<small className="table-subtext">{contract.endDate ? `to ${new Date(contract.endDate).toLocaleDateString()}` : "Ongoing"}</small></td><td>{contract.items?.length || 0} services</td><td><span className={`status-pill status-${contract.status === "active" ? "active" : contract.status === "draft" ? "lead" : "inactive"}`}>{contract.status}</span></td><td>{contract.status === "draft" ? <button className="text-button" onClick={() => void setStatus(contract, "active")}>Activate</button> : contract.status === "active" ? <button className="text-button" onClick={() => void setStatus(contract, "paused")}>Pause</button> : contract.status === "paused" ? <button className="text-button" onClick={() => void setStatus(contract, "active")}>Resume</button> : "—"}</td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="panel list-panel cycles-panel">
      <div className="panel-heading table-panel-heading"><div><div className="section-kicker">RATE SNAPSHOTS</div><h2>Billing cycles <span className="record-count">{cycles.length}</span></h2></div></div>
      {cycles.length === 0 ? <div className="table-empty">Billing cycles will appear here after you open a cycle for an active contract.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>CLIENT</th><th>CONTRACT</th><th>PERIOD</th><th>SNAPSHOT LINES</th><th>STATUS</th><th /></tr></thead><tbody>      {cycles.map((cycle) => <tr key={cycle._id}><td>{cycle.client?.name}</td><td>{cycle.contract?.number}</td><td>{new Date(cycle.startDate).toLocaleDateString()} – {new Date(cycle.endDate).toLocaleDateString()}</td><td>{cycle.items.length}</td><td><span className={`status-pill status-${cycle.status === "open" ? "active" : "inactive"}`}>{cycle.status}</span></td><td>{cycle.status === "open" ? <button className="text-button" onClick={() => editCycleUsage(cycle)}>Record usage</button> : <a href="/invoices" className="text-link">Invoice <ArrowRight size={14} /></a>}</td></tr>)}</tbody></table></div>}
    </section>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(""); }}><section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="contract-dialog-title">
      <div className="modal-header"><div><div className="section-kicker">{modal === "contract" ? "NEW AGREEMENT" : modal === "cycle" ? "PERIOD SNAPSHOT" : "QUOTA & BILLABLE WORK"}</div><h2 id="contract-dialog-title">{modal === "contract" ? "Create a contract" : modal === "cycle" ? "Open a billing cycle" : "Record cycle usage"}</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setModal("")}><X size={17} /></button></div>
      {modal === "contract" ? <form className="modal-form" onSubmit={createContract}>
        <label className="form-field"><span>Contract title *</span><input required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Monthly social content package" /></label>
        <div className="form-grid"><label className="form-field"><span>Client *</span><select required value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })}><option value="">Select a client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</select></label><label className="form-field"><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option></select></label></div>
        <div className="form-grid"><label className="form-field"><span>Start date *</span><input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label className="form-field"><span>End date (optional)</span><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label></div>
        <div className="form-grid"><label className="form-field"><span>Billing frequency</span><select value={form.billingFrequency} onChange={(event) => setForm({ ...form, billingFrequency: event.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option><option value="custom">Custom</option><option value="one_time">One-time</option></select></label><label className="form-field"><span>Payment due (days)</span><input type="number" min="0" max="365" value={form.paymentDueDays} onChange={(event) => setForm({ ...form, paymentDueDays: event.target.value })} /></label></div>
        <div className="line-items-heading"><b>Contract services</b><button type="button" className="text-button" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyLine }] })}><Plus size={14} /> Add line</button></div>
        <div className="line-items-scroll">{form.items.map((line, index) => <div className="contract-line" key={index}><select required value={line.service} onChange={(event) => { const service = services.find((item) => item._id === event.target.value); setForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, service: event.target.value, unit: service?.unit || row.unit, rate: service ? String((service.defaultRatePaise / 100).toFixed(2)) : row.rate, tax: service ? String(service.taxRateBasisPoints / 100) : row.tax } : row) })); }}><option value="">Service</option>{services.map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}</select><input aria-label="Quantity" type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} placeholder="Qty" /><input aria-label="Included quantity" type="number" min="0" step="1" value={line.includedQuantity} onChange={(event) => updateLine(index, "includedQuantity", event.target.value)} placeholder="Included" /><input aria-label="Unit" value={line.unit} onChange={(event) => updateLine(index, "unit", event.target.value)} placeholder="Unit" /><input aria-label="Rate in rupees" type="number" min="0" step=".01" value={line.rate} onChange={(event) => updateLine(index, "rate", event.target.value)} placeholder="Rate ₹" /><input aria-label="Additional rate in rupees" type="number" min="0" step=".01" value={line.additionalRate} onChange={(event) => updateLine(index, "additionalRate", event.target.value)} placeholder="Extra ₹" /><input aria-label="Tax percent" type="number" min="0" max="100" step=".01" value={line.tax} onChange={(event) => updateLine(index, "tax", event.target.value)} placeholder="Tax %" />{form.items.length > 1 && <button className="icon-button" type="button" aria-label="Remove line" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}><X size={14} /></button>}</div>)}</div>
        <p className="form-hint">{money(form.items.reduce((sum, line) => sum + Number(line.quantity || 0) * Math.round(Number(line.rate || 0) * 100), 0))} base value per cycle before taxes and additional work.</p>
        {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button className="button button-primary" disabled={busy || clients.length === 0 || services.length === 0}>{busy ? "Saving…" : "Create contract"}</button></div>
      </form> : modal === "cycle" ? <form className="modal-form" onSubmit={createCycle}>
        <label className="form-field"><span>Active contract *</span><select required value={cycleForm.contract} onChange={(event) => setCycleForm({ ...cycleForm, contract: event.target.value })}><option value="">Select a contract</option>{contracts.filter((contract) => contract.status === "active").map((contract) => <option key={contract._id} value={contract._id}>{contract.number} · {contract.title}</option>)}</select></label>
        <div className="form-grid"><label className="form-field"><span>Period start</span><input type="date" required value={cycleForm.startDate} onChange={(event) => setCycleForm({ ...cycleForm, startDate: event.target.value })} /></label><label className="form-field"><span>Period end</span><input type="date" required value={cycleForm.endDate} onChange={(event) => setCycleForm({ ...cycleForm, endDate: event.target.value })} /></label></div>
        <p className="form-hint">The cycle stores a snapshot of current contract service rates. Later contract rate changes will not change this period’s snapshot.</p>
        {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Opening…" : "Open cycle"}</button></div>
      </form> : <form className="modal-form usage-form" onSubmit={saveCycleUsage}>
        <p className="form-hint">Contractual quantity comes from the saved rate snapshot. Record assignments, completed/approved/delivered units, units to bill, and additional work separately.</p>
        {selectedCycle?.items.map((snapshot, index) => <div key={snapshot.contractItemId} className="usage-item">
          <div className="usage-item-heading"><b>{snapshot.service?.name || snapshot.description || "Contract service"}</b><span>Entitlement {snapshot.entitlementQuantity ?? snapshot.includedQuantity} {snapshot.unit} · Included {snapshot.includedQuantity}</span></div>
          <div className="usage-grid">{[["assignedQuantity", "Assigned"], ["completedQuantity", "Completed"], ["approvedQuantity", "Approved"], ["deliveredQuantity", "Delivered"], ["billableQuantity", "Billable"], ["additionalQuantity", "Additional"]].map(([key, label]) => <label key={key} className="form-field"><span>{label}</span><input aria-label={label} type="number" min="0" step="1" value={usageItems[index]?.[key] ?? "0"} onChange={(event) => setUsageItems((current) => current.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} /></label>)}</div>
        </div>)}
        {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save quantities"}</button></div>
      </form>}
    </section></div>}
  </AppShell>;
}
