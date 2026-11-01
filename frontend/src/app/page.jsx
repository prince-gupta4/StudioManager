"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CirclePlus, Clapperboard, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

const money = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function DashboardPage() {
  const [clients, setClients] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/clients?limit=5&page=1"), api("/dashboard/summary")])
      .then(([clientResult, dashboardSummary]) => {
        setClients(clientResult);
        setSummary(dashboardSummary);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load workspace data."));
  }, []);

  const dateLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
  return <AppShell>
    <section className="welcome-row">
      <div><div className="eyebrow"><span className="eyebrow-line" /> {dateLabel} · STUDIO OVERVIEW</div><h1>Good work starts <span>with a clear view.</span></h1><p>Here&apos;s what&apos;s happening across your workspace today.</p></div>
      <Link href="/clients" className="button button-primary"><CirclePlus size={17} /> Add a client</Link>
    </section>
    {error && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="stats-grid">
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Total clients</span><span className="stat-icon violet"><Users size={18} /></span></div><div className="stat-value">{summary?.clients ?? "—"}</div><div className="stat-foot"><span>{summary ? `${summary.activeClients} active` : "Loading records"}</span><span>{summary ? `${summary.newClients} added this month` : ""}</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Active contracts</span><span className="stat-icon blue"><BriefcaseBusiness size={18} /></span></div><div className="stat-value">{summary?.activeContracts ?? "—"}</div><div className="stat-foot"><Link href="/contracts" className="text-link">View agreements <ArrowRight size={13} /></Link><span>Current</span></div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Production queue</span><span className="stat-icon orange"><Clapperboard size={18} /></span></div><div className="stat-value">{summary?.pendingReels ?? "—"}</div><div className="stat-foot"><span>{summary ? `${summary.completedReels} completed` : "Reels in progress"}</span><span>{summary ? `${summary.overdueReels} overdue` : ""}</span></div></article>
      <article className={`stat-card ${summary && summary.collectedRevenuePaise === undefined ? "muted-stat" : ""}`}><div className="stat-top"><span className="stat-label">Collected this month</span><span className="stat-icon green"><ArrowUpRight size={18} /></span></div><div className="stat-value">{summary?.collectedRevenuePaise === undefined ? "—" : money(summary.collectedRevenuePaise)}</div><div className="stat-foot"><span>{summary?.collectedRevenuePaise === undefined ? "Finance permission required" : "Recorded payments only"}</span><span>This month</span></div></article>
    </section>
    {summary?.contractedRevenuePaise !== undefined && <section className="revenue-strip"><span>Revenue metrics for this month</span><b>Contracted this month <i>{money(summary.contractedRevenuePaise)}</i></b><b>Invoiced <i>{money(summary.invoicedRevenuePaise)}</i></b><b>Collected <i>{money(summary.collectedRevenuePaise)}</i></b><b>Outstanding <i>{money(summary.outstandingPaise)}</i></b></section>}
    <section className="dashboard-grid">
      <article className="panel client-panel">
        <div className="panel-heading"><div><div className="section-kicker">RELATIONSHIPS</div><h2>Recent clients</h2></div><Link href="/clients" className="text-link">View all <ArrowRight size={15} /></Link></div>
        {error ? <div className="inline-error">{error}</div> : !clients ? <div className="table-loading"><span className="spinner" />Loading client records…</div> : clients.items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Users size={21} /></div><h3>Your client list starts here</h3><p>Add your first client to keep the work and relationships organized.</p><Link href="/clients" className="button button-secondary">Create a client <ArrowRight size={15} /></Link></div> : <div className="client-list">{clients.items.map((client) => <Link key={client._id} href="/clients" className="client-row"><div className="client-mark">{client.name.slice(0, 1).toUpperCase()}</div><div className="client-row-main"><b>{client.name}</b><span>Added {new Date(client.createdAt).toLocaleDateString()}</span></div><span className={`status-pill status-${client.status}`}>{client.status}</span><ArrowRight className="row-arrow" size={16} /></Link>)}</div>}
      </article>
      <article className="panel setup-panel">
        <div className="panel-heading"><div><div className="section-kicker">WORK TO MOVE FORWARD</div><h2>Studio pulse</h2></div></div>
        <div className="pulse-item"><span className="pulse-value">{summary?.overdueTasks ?? "—"}</span><span><b>Overdue tasks</b><small>Production tasks past deadline</small></span></div>
        <div className="pulse-item"><span className="pulse-value">{summary?.pendingApprovals ?? "—"}</span><span><b>Pending approvals</b><small>Reels waiting for client review</small></span></div>
        {summary?.overdueInvoices !== undefined && <div className="pulse-item"><span className="pulse-value">{summary.overdueInvoices}</span><span><b>Overdue invoices</b><small>Issued invoices past their due date</small></span></div>}
        <Link href="/production" className="button button-secondary pulse-action">Open production <ArrowRight size={15} /></Link>
      </article>
    </section>
    <footer className="page-footer"><span>ReelManager <i>·</i> Studio operations</span><span>Built for the work behind the work.</span></footer>
  </AppShell>;
}
