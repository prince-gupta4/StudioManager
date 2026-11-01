"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Password updated successfully.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update password."); }
    finally { setBusy(false); }
  }

  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> ACCOUNT</div><h1>Settings</h1><p>Manage your sign-in credentials and workspace account.</p></div></section>
    <section className="panel settings-panel"><div className="panel-heading"><div><div className="section-kicker">SECURITY</div><h2><KeyRound size={17} /> Change password</h2></div></div><form className="modal-form settings-form" onSubmit={submit}><label className="form-field"><span>Current password *</span><input required type="password" autoComplete="current-password" maxLength={200} value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label><label className="form-field"><span>New password * (6+ characters)</span><input required type="password" autoComplete="new-password" minLength={6} maxLength={200} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label><label className="form-field"><span>Confirm new password *</span><input required type="password" autoComplete="new-password" minLength={6} maxLength={200} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>{error && <div className="form-error">{error}</div>}{message && <div className="form-success">{message}</div>}<div className="modal-actions"><button className="button button-primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></div></form></section>
  </AppShell>;
}
