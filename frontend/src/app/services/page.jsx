"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, BriefcaseBusiness, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
const blank = { name: "", description: "", category: "", unit: "per reel", rate: "0", billingType: "per_unit", taxPercent: "0", active: true };
const billingLabels = { one_time: "One-time", recurring: "Recurring", per_unit: "Per unit", custom: "Custom" };
export default function ServicesPage() {
    const [items, setItems] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [modal, setModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState(blank);
    const load = useCallback(async () => {
        setError("");
        try {
            const response = await api("/services");
            setItems(response.items);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load services.");
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    function openCreate() { setSelected(null); setForm(blank); setModal(true); }
    function openEdit(item) {
        setSelected(item);
        setForm({
            name: item.name, description: item.description || "", category: item.category || "",
            unit: item.unit, rate: (item.defaultRatePaise / 100).toFixed(2), billingType: item.billingType,
            taxPercent: (item.taxRateBasisPoints / 100).toString(), active: item.active,
        });
        setModal(true);
    }
    async function save(event) {
        event.preventDefault();
        const rupees = Number(form.rate);
        const taxPercent = Number(form.taxPercent);
        if (!Number.isFinite(rupees) || rupees < 0 || !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
            setError("Enter a valid non-negative rate and tax percentage (up to 100%).");
            return;
        }
        setBusy(true);
        setError("");
        const payload = {
            name: form.name,
            description: form.description,
            category: form.category,
            unit: form.unit,
            billingType: form.billingType,
            active: form.active,
            defaultRatePaise: Math.round(rupees * 100),
            taxRateBasisPoints: Math.round(taxPercent * 100),
        };
        try {
            await api(`/services${selected ? `/${selected._id}` : ""}`, {
                method: selected ? "PATCH" : "POST",
                body: JSON.stringify(payload),
            });
            setModal(false);
            await load();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save this service.");
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs(AppShell, { children: [_jsxs("section", { className: "content-heading", children: [_jsxs("div", { children: [_jsxs("div", { className: "eyebrow", children: [_jsx("span", { className: "eyebrow-line" }), " YOUR CREATIVE OFFERING"] }), _jsx("h1", { children: "Services" }), _jsx("p", { children: "Build a flexible catalogue to use across future contracts and billing." })] }), _jsxs("button", { className: "button button-primary", onClick: openCreate, children: [_jsx(Plus, { size: 16 }), " Add service"] })] }), error && !modal && _jsx("div", { className: "inline-error", style: { marginBottom: 13 }, children: error }), _jsx("section", { className: "panel list-panel", children: items === null ? _jsxs("div", { className: "table-loading", children: [_jsx("span", { className: "spinner" }), "Loading services\u2026"] }) : items.length === 0 ? _jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-icon", children: _jsx(BriefcaseBusiness, { size: 21 }) }), _jsx("h3", { children: "No services yet" }), _jsx("p", { children: "Create your catalogue of shooting, editing, marketing and custom services." }), _jsx("button", { className: "button button-secondary", onClick: openCreate, children: "Create a service" })] }) : _jsx("div", { className: "table-scroll", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "SERVICE" }), _jsx("th", { children: "CATEGORY" }), _jsx("th", { children: "UNIT" }), _jsx("th", { children: "DEFAULT RATE" }), _jsx("th", { children: "BILLING" }), _jsx("th", { children: "TAX" }), _jsx("th", { children: "STATUS" }), _jsx("th", { "aria-label": "Actions" })] }) }), _jsx("tbody", { children: items.map((item) => _jsxs("tr", { children: [_jsx("td", { children: item.name }), _jsx("td", { children: item.category || "—" }), _jsx("td", { children: item.unit }), _jsxs("td", { children: ["\u20B9", (item.defaultRatePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })] }), _jsx("td", { children: billingLabels[item.billingType] }), _jsxs("td", { children: [(item.taxRateBasisPoints / 100).toFixed(2).replace(/\.?0+$/, ""), "%"] }), _jsx("td", { children: _jsx("span", { className: `status-pill ${item.active ? "status-active" : "status-inactive"}`, children: item.active ? "Active" : "Inactive" }) }), _jsx("td", { children: _jsx("div", { className: "table-actions", children: _jsx("button", { className: "icon-button", title: "Edit service", "aria-label": `Edit ${item.name}`, onClick: () => openEdit(item), children: _jsx(Pencil, { size: 14 }) }) }) })] }, item._id)) })] }) }) }), modal && _jsx("div", { className: "modal-backdrop", onMouseDown: (event) => { if (event.target === event.currentTarget)
                    setModal(false); }, children: _jsxs("section", { className: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "service-title", children: [_jsxs("div", { className: "modal-header", children: [_jsxs("div", { children: [_jsx("div", { className: "section-kicker", children: "SERVICE CATALOGUE" }), _jsx("h2", { id: "service-title", children: selected ? "Edit service" : "Add a service" })] }), _jsx("button", { className: "modal-close", "aria-label": "Close dialog", onClick: () => setModal(false), children: _jsx(X, { size: 17 }) })] }), _jsxs("form", { className: "modal-form", onSubmit: save, children: [_jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Service name *" }), _jsx("input", { autoFocus: true, required: true, maxLength: 120, value: form.name, onChange: (event) => setForm({ ...form, name: event.target.value }) })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Category" }), _jsx("input", { maxLength: 100, value: form.category, onChange: (event) => setForm({ ...form, category: event.target.value }), placeholder: "Production, marketing\u2026" })] }), _jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Unit *" }), _jsx("input", { required: true, maxLength: 40, value: form.unit, onChange: (event) => setForm({ ...form, unit: event.target.value }), placeholder: "per reel, per month\u2026" })] })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Default rate (\u20B9) *" }), _jsx("input", { required: true, type: "number", min: "0", step: "0.01", value: form.rate, onChange: (event) => setForm({ ...form, rate: event.target.value }) })] }), _jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Tax (%)" }), _jsx("input", { type: "number", min: "0", max: "100", step: "0.01", value: form.taxPercent, onChange: (event) => setForm({ ...form, taxPercent: event.target.value }) })] })] }), _jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Billing type" }), _jsxs("select", { value: form.billingType, onChange: (event) => setForm({ ...form, billingType: event.target.value }), children: [_jsx("option", { value: "per_unit", children: "Per unit" }), _jsx("option", { value: "recurring", children: "Recurring" }), _jsx("option", { value: "one_time", children: "One-time" }), _jsx("option", { value: "custom", children: "Custom" })] })] }), _jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Description" }), _jsx("textarea", { maxLength: 1000, value: form.description, onChange: (event) => setForm({ ...form, description: event.target.value }) })] }), _jsx("label", { className: "form-field", children: _jsxs("span", { children: [_jsx("input", { type: "checkbox", checked: form.active, onChange: (event) => setForm({ ...form, active: event.target.checked }), style: { width: "auto", minHeight: 0, marginRight: 7 } }), "Active"] }) }), error && _jsx("div", { className: "form-error", role: "alert", children: error }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "button button-secondary", onClick: () => setModal(false), children: "Cancel" }), _jsx("button", { className: "button button-primary", disabled: busy, children: busy ? "Saving…" : selected ? "Save changes" : "Create service" })] })] })] }) })] });
}
