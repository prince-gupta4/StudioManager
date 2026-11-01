"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Plus, ScrollText, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api, downloadFile } from "@/lib/api";

const money = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function QuotationsPage() {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState("");
  const [form, setForm] = useState({ client: "", title: "", issueDate: today(), validUntil: "", items: [{ service: "", description: "", quantity: "1", unit: "unit", rate: "0", tax: "0" }], terms: "" });
  const [convert, setConvert] = useState({ startDate: today(), endDate: "", billingFrequency: "monthly", paymentDueDays: "15" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [quoteResult, clientResult, serviceResult] = await Promise.all([api("/quotations?limit=100"), api("/clients?limit=100"), api("/services")]);
      setItems(quoteResult.items);
      setClients(clientResult.items);
      setServices(serviceResult.items.filter((service) => service.active));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load quotations."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function updateLine(index, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((line, i) => i === index ? { ...line, [field]: value } : line) }));
  }

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const lines = form.items.map((line) => ({
        ...(line.service ? { service: line.service } : {}),
        description: line.description || services.find((service) => service._id === line.service)?.name || "Service",
        quantity: Number(line.quantity),
        unit: line.unit || "unit",
        ratePaise: Math.round(Number(line.rate) * 100),
        taxRateBasisPoints: Math.round(Number(line.tax) * 100),
      }));
      await api("/quotations", { method: "POST", body: JSON.stringify({ client: form.client, title: form.title, issueDate: form.issueDate, validUntil: form.validUntil, items: lines, terms: form.terms }) });
      setModal("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create quotation."); }
    finally { setBusy(false); }
  }

  async function setStatus(item, status) {
    setError("");
    try { await api(`/quotations/${item._id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update quotation."); }
  }

  async function convertQuote(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/quotations/${selected._id}/convert`, { method: "POST", body: JSON.stringify({ ...convert, paymentDueDays: Number(convert.paymentDueDays), ...(convert.endDate ? { endDate: convert.endDate } : {}) }) });
      setModal("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not convert quotation."); }
    finally { setBusy(false); }
  }

  async function downloadQuotation(item) {
    setDownloading(item._id);
    setError("");
    try { await downloadFile(`/quotations/${item._id}/pdf`, `${item.number}.pdf`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not download quotation PDF."); }
    finally { setDownloading(""); }
  }

  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> SCOPE & PRICING</div><h1>Quotations</h1><p>Price work for clients and convert accepted quotes into contracts.</p></div><button className="button button-primary" onClick={() => { setError(""); setModal("create"); }}><Plus size={16} /> New quotation</button></section>
    {error && !modal && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel list-panel">{loading ? <div className="table-loading"><span className="spinner" />Loading quotations…</div> : items.length === 0 ? <div className="empty-state"><div className="empty-icon"><ScrollText size={21} /></div><h3>No quotations yet</h3><p>Create a priced scope and record its acceptance before converting to a contract.</p><button className="button button-secondary" onClick={() => setModal("create")}>Create a quotation</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>QUOTATION</th><th>CLIENT</th><th>VALID UNTIL</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td><b>{item.number}</b><small className="table-subtext">{item.title}</small></td><td>{item.client?.name}</td><td>{new Date(item.validUntil).toLocaleDateString()}</td><td>{item.items.length}</td><td>{money(item.totalPaise)}</td><td><span className={`status-pill status-${item.status === "accepted" || item.status === "converted" ? "active" : item.status === "rejected" || item.status === "expired" ? "inactive" : "lead"}`}>{item.status}</span></td><td><div className="table-actions">{item.status === "draft" ? <button className="text-button" onClick={() => void setStatus(item, "sent")}>Mark sent</button> : item.status === "sent" ? <><button className="text-button" onClick={() => void setStatus(item, "accepted")}>Accept</button><button className="text-button" onClick={() => void setStatus(item, "rejected")}>Reject</button></> : item.status === "accepted" ? <button className="text-button" onClick={() => { setSelected(item); setError(""); setModal("convert"); }}>Convert to contract</button> : item.convertedContract ? <span>{item.convertedContract.number}</span> : null}<button className="icon-button" disabled={downloading === item._id} onClick={() => void downloadQuotation(item)} aria-label={`Download PDF for ${item.number}`} title={downloading === item._id ? "Preparing PDF" : "Download quotation PDF"}><Download size={14} /></button></div></td></tr>)}</tbody></table></div>}</section>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(""); }}><section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="quote-title"><div className="modal-header"><div><div className="section-kicker">COMMERCIAL PROPOSAL</div><h2 id="quote-title">{modal === "create" ? "Create quotation" : "Convert to contract"}</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setModal("")}><X size={17} /></button></div>
      {modal === "create" ? <form className="modal-form" onSubmit={create}><label className="form-field"><span>Quotation title *</span><input required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><div className="form-grid"><label className="form-field"><span>Client *</span><select required value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })}><option value="">Select client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</select></label><label className="form-field"><span>Valid until *</span><input required type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label></div><div className="line-items-heading"><b>Quote line items</b><button type="button" className="text-button" onClick={() => setForm({ ...form, items: [...form.items, { service: "", description: "", quantity: "1", unit: "unit", rate: "0", tax: "0" }] })}><Plus size={14} /> Add line</button></div>{form.items.map((line, index) => <div className="invoice-line" key={index}><select aria-label="Service" value={line.service} onChange={(event) => { const service = services.find((item) => item._id === event.target.value); setForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, service: event.target.value, description: service?.name || "", unit: service?.unit || "unit", rate: service ? String((service.defaultRatePaise / 100).toFixed(2)) : row.rate, tax: service ? String(service.taxRateBasisPoints / 100) : row.tax } : row) })); }}><option value="">Custom</option>{services.map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}</select><input aria-label="Description" value={line.description} onChange={(event) => updateLine(index, "description", event.target.value)} placeholder="Description" /><input aria-label="Quantity" type="number" step=".01" min=".01" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} /><input aria-label="Unit" value={line.unit} onChange={(event) => updateLine(index, "unit", event.target.value)} /><input aria-label="Rate rupees" type="number" step=".01" min="0" value={line.rate} onChange={(event) => updateLine(index, "rate", event.target.value)} placeholder="₹ rate" /><input aria-label="Tax percent" type="number" step=".01" min="0" max="100" value={line.tax} onChange={(event) => updateLine(index, "tax", event.target.value)} placeholder="Tax %" />{form.items.length > 1 && <button className="icon-button" type="button" aria-label="Remove item" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}><X size={14} /></button>}</div>)}<label className="form-field"><span>Terms</span><textarea maxLength={5000} value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button className="button button-primary" disabled={busy || clients.length === 0}>{busy ? "Creating…" : "Create draft quotation"}</button></div></form> : <form className="modal-form" onSubmit={convertQuote}><p className="form-hint">Creates a draft contract using the quotation’s immutable service/rate lines.</p><label className="form-field"><span>Contract start date</span><input required type="date" value={convert.startDate} onChange={(event) => setConvert({ ...convert, startDate: event.target.value })} /></label><div className="form-grid"><label className="form-field"><span>End date (optional)</span><input type="date" value={convert.endDate} onChange={(event) => setConvert({ ...convert, endDate: event.target.value })} /></label><label className="form-field"><span>Billing frequency</span><select value={convert.billingFrequency} onChange={(event) => setConvert({ ...convert, billingFrequency: event.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Annually</option><option value="custom">Custom</option><option value="one_time">One-time</option></select></label></div><label className="form-field"><span>Payment due (days)</span><input type="number" min="0" max="365" value={convert.paymentDueDays} onChange={(event) => setConvert({ ...convert, paymentDueDays: event.target.value })} /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Converting…" : "Create draft contract"}</button></div></form>}
    </section></div>}
  </AppShell>;
}
