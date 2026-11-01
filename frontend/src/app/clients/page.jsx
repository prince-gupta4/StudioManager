"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
const emptyForm = { name: "", type: "business", status: "lead", email: "", phone: "", source: "" };
export default function ClientsPage() {
    const [result, setResult] = useState(null);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [modal, setModal] = useState(null);
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const load = useCallback(async () => {
        setBusy(true);
        setError("");
        try {
            const params = new URLSearchParams({ page: String(page), limit: "10" });
            if (query)
                params.set("search", query);
            if (status)
                params.set("status", status);
            setResult(await api(`/clients?${params}`));
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load clients.");
        }
        finally {
            setBusy(false);
        }
    }, [page, query, status]);
    useEffect(() => { void load(); }, [load]);
    function openCreate() {
        setSelected(null);
        setForm(emptyForm);
        setModal("create");
    }
    function openEdit(client) {
        setSelected(client);
        setForm({
            name: client.name,
            type: client.type,
            status: client.status,
            email: client.email || "",
            phone: client.phone || "",
            source: client.source || "",
        });
        setModal("edit");
    }
    async function save(event) {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
            await api(`/clients${selected && modal === "edit" ? `/${selected._id}` : ""}`, {
                method: selected && modal === "edit" ? "PATCH" : "POST",
                body: JSON.stringify(form),
            });
            setModal(null);
            await load();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save this client.");
        }
        finally {
            setBusy(false);
        }
    }
    async function archiveClient() {
        if (!selected)
            return;
        setBusy(true);
        setError("");
        try {
            await api(`/clients/${selected._id}`, { method: "DELETE" });
            setModal(null);
            setSelected(null);
            await load();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not archive this client.");
            setModal(null);
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs(AppShell, { children: [_jsxs("section", { className: "content-heading", children: [_jsxs("div", { children: [_jsxs("div", { className: "eyebrow", children: [_jsx("span", { className: "eyebrow-line" }), " RELATIONSHIP MANAGEMENT"] }), _jsx("h1", { children: "Clients" }), _jsx("p", { children: "Keep client details, contacts and relationships organized." })] }), _jsxs("button", { className: "button button-primary", onClick: openCreate, children: [_jsx(Plus, { size: 16 }), " Add client"] })] }), error && !modal && _jsx("div", { className: "inline-error", style: { marginBottom: 13 }, children: error }), _jsxs("section", { className: "panel list-panel", children: [_jsxs("div", { className: "list-toolbar", children: [_jsxs("form", { className: "search-box", onSubmit: (event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); }, children: [_jsx(Search, { size: 16 }), _jsx("input", { value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search clients\u2026", "aria-label": "Search clients" })] }), _jsxs("select", { className: "filter-select", value: status, "aria-label": "Filter by status", onChange: (event) => { setStatus(event.target.value); setPage(1); }, children: [_jsx("option", { value: "", children: "All statuses" }), _jsx("option", { value: "lead", children: "Lead" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" })] })] }), _jsx("div", { className: "table-scroll", children: _jsxs("table", { className: "data-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "CLIENT" }), _jsx("th", { children: "TYPE" }), _jsx("th", { children: "CONTACT" }), _jsx("th", { children: "STATUS" }), _jsx("th", { children: "ADDED" }), _jsx("th", { "aria-label": "Actions" })] }) }), _jsxs("tbody", { children: [busy && !result ? _jsx("tr", { children: _jsx("td", { colSpan: 6, children: _jsxs("div", { className: "table-loading", children: [_jsx("span", { className: "spinner" }), "Loading clients\u2026"] }) }) })
                                            : result?.items.map((client) => _jsxs("tr", { children: [_jsx("td", { children: _jsxs("div", { className: "table-client", children: [_jsx("span", { className: "client-mark", children: client.name.slice(0, 1).toUpperCase() }), _jsx("span", { children: client.name })] }) }), _jsx("td", { children: client.type === "business" ? "Business" : "Individual" }), _jsx("td", { children: client.email || client.phone || "—" }), _jsx("td", { children: _jsx("span", { className: `status-pill status-${client.status}`, children: client.status }) }), _jsx("td", { children: new Date(client.createdAt).toLocaleDateString() }), _jsx("td", { children: _jsxs("div", { className: "table-actions", children: [_jsx("button", { className: "icon-button", title: "Edit client", "aria-label": `Edit ${client.name}`, onClick: () => openEdit(client), children: _jsx(Pencil, { size: 14 }) }), _jsx("button", { className: "icon-button", title: "Archive client", "aria-label": `Archive ${client.name}`, onClick: () => { setSelected(client); setModal("archive"); }, children: _jsx(Trash2, { size: 14 }) })] }) })] }, client._id)), !busy && result?.items.length === 0 && _jsx("tr", { children: _jsx("td", { colSpan: 6, children: _jsxs("div", { className: "table-empty", children: [_jsx(Users, { size: 20 }), _jsx("p", { children: "No clients match your search yet." }), _jsx("button", { className: "button button-secondary", onClick: openCreate, children: "Add your first client" })] }) }) })] })] }) }), result && result.total > 0 && _jsxs("div", { className: "pagination", children: [_jsxs("span", { children: ["Showing ", ((page - 1) * 10) + 1, "\u2013", Math.min(page * 10, result.total), " of ", result.total, " clients"] }), _jsxs("div", { className: "pagination-controls", children: [_jsx("button", { disabled: page <= 1 || busy, "aria-label": "Previous page", onClick: () => setPage((value) => value - 1), children: _jsx(ArrowLeft, { size: 14 }) }), _jsxs("span", { className: "page-number", children: [page, " / ", Math.max(result.pages, 1)] }), _jsx("button", { disabled: page >= result.pages || busy, "aria-label": "Next page", onClick: () => setPage((value) => value + 1), children: _jsx(ArrowRight, { size: 14 }) })] })] })] }), modal && _jsx("div", { className: "modal-backdrop", onMouseDown: (event) => { if (event.target === event.currentTarget)
                    setModal(null); }, children: _jsxs("section", { className: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-title", children: [_jsxs("div", { className: "modal-header", children: [_jsxs("div", { children: [_jsx("div", { className: "section-kicker", children: modal === "archive" ? "ARCHIVE RECORD" : modal === "edit" ? "CLIENT DETAILS" : "NEW RELATIONSHIP" }), _jsx("h2", { id: "modal-title", children: modal === "archive" ? "Archive this client?" : modal === "edit" ? "Edit client" : "Add a client" })] }), _jsx("button", { className: "modal-close", "aria-label": "Close dialog", onClick: () => setModal(null), children: _jsx(X, { size: 17 }) })] }), modal === "archive" ? _jsxs(_Fragment, { children: [_jsxs("div", { className: "confirm-copy", children: ["This will archive ", _jsx("b", { children: selected?.name }), " and remove it from the active client list. The record remains stored for history."] }), error && _jsx("div", { className: "form-error", style: { margin: "8px 21px" }, children: error }), _jsx("div", { className: "modal-form", children: _jsxs("div", { className: "modal-actions", children: [_jsx("button", { className: "button button-secondary", onClick: () => setModal(null), children: "Cancel" }), _jsx("button", { className: "button button-danger", disabled: busy, onClick: () => void archiveClient(), children: busy ? "Archiving…" : "Archive client" })] }) })] })
                            : _jsxs("form", { className: "modal-form", onSubmit: save, children: [_jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Client / business name *" }), _jsx("input", { autoFocus: true, required: true, maxLength: 160, value: form.name, onChange: (event) => setForm({ ...form, name: event.target.value }) })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Client type" }), _jsxs("select", { value: form.type, onChange: (event) => setForm({ ...form, type: event.target.value }), children: [_jsx("option", { value: "business", children: "Business" }), _jsx("option", { value: "individual", children: "Individual" })] })] }), _jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Status" }), _jsxs("select", { value: form.status, onChange: (event) => setForm({ ...form, status: event.target.value }), children: [_jsx("option", { value: "lead", children: "Lead" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "inactive", children: "Inactive" })] })] })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Email" }), _jsx("input", { type: "email", maxLength: 254, value: form.email, onChange: (event) => setForm({ ...form, email: event.target.value }) })] }), _jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Phone" }), _jsx("input", { maxLength: 40, value: form.phone, onChange: (event) => setForm({ ...form, phone: event.target.value }) })] })] }), _jsxs("label", { className: "form-field", children: [_jsx("span", { children: "Acquisition source" }), _jsx("input", { maxLength: 120, value: form.source, onChange: (event) => setForm({ ...form, source: event.target.value }), placeholder: "Referral, website, social\u2026" })] }), error && _jsx("div", { className: "form-error", role: "alert", children: error }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "button button-secondary", onClick: () => setModal(null), children: "Cancel" }), _jsx("button", { className: "button button-primary", disabled: busy, children: busy ? "Saving…" : modal === "edit" ? "Save changes" : "Create client" })] })] })] }) })] });
}
