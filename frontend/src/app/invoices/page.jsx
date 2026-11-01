"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Plus, Receipt, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api, downloadFile } from "@/lib/api";

const money = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ client: "", issueDate: today(), dueDate: today(), items: [{ service: "", description: "", quantity: "1", unit: "unit", rate: "0", tax: "0" }] });
  const [cycleForm, setCycleForm] = useState({ cycleId: "", issueDate: today(), dueDate: today() });
  const [paymentForm, setPaymentForm] = useState({ amount: "", date: today(), method: "upi", reference: "", notes: "" });
  const [downloading, setDownloading] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invoiceResult, clientResult, serviceResult, cycleResult] = await Promise.all([
        api("/invoices?limit=100"), api("/clients?limit=100"), api("/services"), api("/contracts/billing-cycles"),
      ]);
      setInvoices(invoiceResult.items);
      setClients(clientResult.items);
      setServices(serviceResult.items.filter((service) => service.active));
      setCycles(cycleResult.items.filter((cycle) => cycle.status === "open"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load billing data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function updateLine(index, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((line, i) => i === index ? { ...line, [field]: value } : line) }));
  }

  async function createInvoice(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const items = form.items.map((line) => ({
      ...(line.service ? { service: line.service } : {}),
      description: line.description || services.find((service) => service._id === line.service)?.name || "Service",
      quantity: Number(line.quantity),
      unit: line.unit || "unit",
      ratePaise: Math.round(Number(line.rate) * 100),
      taxRateBasisPoints: Math.round(Number(line.tax) * 100),
    }));
    try {
      await api("/invoices", { method: "POST", body: JSON.stringify({ client: form.client, issueDate: form.issueDate, dueDate: form.dueDate, items }) });
      setModal("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create invoice."); }
    finally { setBusy(false); }
  }

  async function generateFromCycle(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/invoices/from-cycle", { method: "POST", body: JSON.stringify(cycleForm) });
      setModal("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create cycle invoice."); }
    finally { setBusy(false); }
  }

  async function issueInvoice(invoice) {
    setError("");
    try { await api(`/invoices/${invoice._id}/issue`, { method: "PATCH", body: JSON.stringify({}) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not issue invoice."); }
  }

  async function recordPayment(event) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api(`/invoices/${selected._id}/payments`, { method: "POST", body: JSON.stringify({
        amountPaise: Math.round(Number(paymentForm.amount) * 100),
        date: paymentForm.date, method: paymentForm.method,
        reference: paymentForm.reference, notes: paymentForm.notes,
      }) });
      setModal("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record payment."); }
    finally { setBusy(false); }
  }

  async function downloadInvoice(invoice) {
    setDownloading(invoice._id);
    setError("");
    try { await downloadFile(`/invoices/${invoice._id}/pdf`, `${invoice.number}.pdf`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not download invoice PDF."); }
    finally { setDownloading(""); }
  }

  const activeCycles = cycles.filter((cycle) => !cycle.invoice);
  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> BILLING & RECEIVABLES</div><h1>Invoices</h1><p>Create custom or cycle-based invoices and record partial payments.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={() => { setError(""); setModal("cycle"); }} disabled={!activeCycles.length}>From billing cycle</button><button className="button button-primary" onClick={() => { setError(""); setModal("invoice"); }}><Plus size={16} /> New invoice</button></div></section>
    {error && !modal && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel list-panel">{loading ? <div className="table-loading"><span className="spinner" />Loading invoices…</div> : invoices.length === 0 ? <div className="empty-state"><div className="empty-icon"><Receipt size={21} /></div><h3>No invoices yet</h3><p>Create a custom invoice, or generate one from a billing cycle after setting billable quantities.</p><button className="button button-secondary" onClick={() => setModal("invoice")}>Create an invoice</button></div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>INVOICE</th><th>CLIENT</th><th>ISSUED</th><th>DUE</th><th>TOTAL</th><th>PAID</th><th>OUTSTANDING</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice._id}><td><b>{invoice.number}</b><small className="table-subtext">{invoice.items.length} line items</small></td><td>{invoice.client?.name}</td><td>{new Date(invoice.issueDate).toLocaleDateString()}</td><td>{new Date(invoice.dueDate).toLocaleDateString()}</td><td>{money(invoice.totalPaise)}</td><td>{money(invoice.amountPaidPaise)}</td><td>{money(invoice.amountDuePaise)}</td><td><span className={`status-pill status-${invoice.status === "paid" ? "active" : invoice.status === "overdue" ? "lead" : "inactive"}`}>{invoice.status.replaceAll("_", " ")}</span></td><td><div className="table-actions">{invoice.status === "draft" ? <button className="text-button" onClick={() => void issueInvoice(invoice)}>Issue</button> : invoice.amountDuePaise > 0 && invoice.status !== "cancelled" ? <button className="text-button" onClick={() => { setSelected(invoice); setPaymentForm({ amount: (invoice.amountDuePaise / 100).toFixed(2), date: today(), method: "upi", reference: "", notes: "" }); setModal("payment"); }}>Record payment</button> : null}<button className="icon-button" disabled={downloading === invoice._id} onClick={() => void downloadInvoice(invoice)} aria-label={`Download PDF for ${invoice.number}`} title={downloading === invoice._id ? "Preparing PDF" : "Download invoice PDF"}><Download size={14} /></button></div></td></tr>)}</tbody></table></div>}</section>
    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(""); }}><section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="invoice-dialog-title">
      <div className="modal-header"><div><div className="section-kicker">FINANCIAL RECORD</div><h2 id="invoice-dialog-title">{modal === "invoice" ? "Create an invoice" : modal === "cycle" ? "Invoice a billing cycle" : `Payment · ${selected?.number}`}</h2></div><button className="modal-close" aria-label="Close dialog" onClick={() => setModal("")}><X size={17} /></button></div>
      {modal === "invoice" && <form className="modal-form" onSubmit={createInvoice}>
        <div className="form-grid"><label className="form-field"><span>Client *</span><select required value={form.client} onChange={(event) => setForm({ ...form, client: event.target.value })}><option value="">Select client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</select></label><label className="form-field"><span>Issue date *</span><input type="date" required value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></label></div>
        <label className="form-field"><span>Due date *</span><input type="date" required value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
        <div className="line-items-heading"><b>Invoice line items</b><button type="button" className="text-button" onClick={() => setForm({ ...form, items: [...form.items, { service: "", description: "", quantity: "1", unit: "unit", rate: "0", tax: "0" }] })}><Plus size={14} /> Add line</button></div>
        <div className="line-items-scroll">{form.items.map((line, index) => <div className="invoice-line" key={index}><select aria-label="Service" value={line.service} onChange={(event) => { const selectedService = services.find((service) => service._id === event.target.value); setForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, service: event.target.value, description: selectedService?.name || "", unit: selectedService?.unit || "unit", rate: selectedService ? String((selectedService.defaultRatePaise / 100).toFixed(2)) : row.rate, tax: selectedService ? String(selectedService.taxRateBasisPoints / 100) : row.tax } : row) })); }}><option value="">Custom</option>{services.map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}</select><input aria-label="Description" value={line.description} onChange={(event) => updateLine(index, "description", event.target.value)} placeholder="Description" /><input aria-label="Quantity" type="number" step=".01" min=".01" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} placeholder="Quantity" /><input aria-label="Unit" value={line.unit} onChange={(event) => updateLine(index, "unit", event.target.value)} placeholder="Unit" /><input aria-label="Rate rupees" type="number" step=".01" min="0" value={line.rate} onChange={(event) => updateLine(index, "rate", event.target.value)} placeholder="₹ rate" /><input aria-label="Tax percent" type="number" step=".01" min="0" max="100" value={line.tax} onChange={(event) => updateLine(index, "tax", event.target.value)} placeholder="Tax %" />{form.items.length > 1 && <button className="icon-button" type="button" aria-label="Remove item" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}><X size={14} /></button>}</div>)}</div>
        <p className="form-hint">Invoice totals and tax are validated and calculated by the API in integer paise. Draft invoices can be issued to freeze the financial snapshot.</p>
        {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button className="button button-primary" disabled={busy || clients.length === 0}>{busy ? "Creating…" : "Create draft"}</button></div>
      </form>}
      {modal === "cycle" && <form className="modal-form" onSubmit={generateFromCycle}><label className="form-field"><span>Open billing cycle *</span><select required value={cycleForm.cycleId} onChange={(event) => setCycleForm({ ...cycleForm, cycleId: event.target.value })}><option value="">Select cycle</option>{activeCycles.map((cycle) => <option key={cycle._id} value={cycle._id}>{cycle.client?.name} · {cycle.contract?.number} · {new Date(cycle.startDate).toLocaleDateString()}–{new Date(cycle.endDate).toLocaleDateString()}</option>)}</select></label><div className="form-grid"><label className="form-field"><span>Issue date</span><input required type="date" value={cycleForm.issueDate} onChange={(event) => setCycleForm({ ...cycleForm, issueDate: event.target.value })} /></label><label className="form-field"><span>Due date</span><input required type="date" value={cycleForm.dueDate} onChange={(event) => setCycleForm({ ...cycleForm, dueDate: event.target.value })} /></label></div><p className="form-hint">Only billable and additional quantities recorded in this cycle are invoiced. Cycle rates stay unchanged if the contract is updated.</p>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button className="button button-primary" disabled={busy || !activeCycles.length}>{busy ? "Generating…" : "Create draft invoice"}</button></div></form>}
      {modal === "payment" && <form className="modal-form" onSubmit={recordPayment}><p className="payment-balance">Outstanding balance <b>{money(selected?.amountDuePaise || 0)}</b></p><label className="form-field"><span>Payment amount (₹) *</span><input required type="number" min=".01" max={(selected?.amountDuePaise || 0) / 100} step=".01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></label><div className="form-grid"><label className="form-field"><span>Payment date</span><input required type="date" value={paymentForm.date} onChange={(event) => setPaymentForm({ ...paymentForm, date: event.target.value })} /></label><label className="form-field"><span>Method</span><select value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="online">Online</option><option value="other">Other</option></select></label></div><label className="form-field"><span>Reference</span><input maxLength={180} value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} /></label><label className="form-field"><span>Notes</span><textarea maxLength={2000} value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal("")}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Recording…" : "Record payment"}</button></div></form>}
    </section></div>}
  </AppShell>;
}
