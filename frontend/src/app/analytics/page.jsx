"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Download, FileSpreadsheet, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api, downloadFile } from "@/lib/api";

const money = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
export default function AnalyticsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [downloading, setDownloading] = useState("");

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError("");
    try {
      setReport(await api(`/analytics?from=${from}&to=${to}`, { skipCache: forceRefresh }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load analytics."); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  const exportReport = async (type, format) => {
    const key = `${type}-${format}`;
    setDownloading(key);
    setError("");
    try { await downloadFile(`/analytics/export.${format}?type=${type}&from=${from}&to=${to}`, `reelmanager-${type}-${from}-to-${to}.${format}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `Could not download ${type} ${format.toUpperCase()} report.`); }
    finally { setDownloading(""); }
  };
  const highestCount = Math.max(1, ...(report?.productionByStatus || []).map((item) => item.count));
  const monthMap = new Map();
  for (const [key, items] of [["invoiced", report?.financial?.invoicedByMonth], ["collected", report?.financial?.collectedByMonth], ["expenses", report?.financial?.expensesByMonth]]) {
    for (const item of items || []) {
      const month = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
      const current = monthMap.get(month) || { month, year: item._id.year, monthNumber: item._id.month, invoiced: 0, collected: 0, expenses: 0 };
      current[key] = item.amountPaise;
      monthMap.set(month, current);
    }
  }
  if (from && to) {
    const cursor = new Date(`${from}T00:00:00`);
    const lastMonth = new Date(`${to}T00:00:00`);
    cursor.setDate(1);
    lastMonth.setDate(1);
    while (cursor <= lastMonth) {
      const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(month))
        monthMap.set(month, { month, year: cursor.getFullYear(), monthNumber: cursor.getMonth() + 1, invoiced: 0, collected: 0, expenses: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  const monthly = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  const hasFinancialData = Boolean(report?.financial && (report.financial.invoicedByMonth.length || report.financial.collectedByMonth.length || report.financial.expensesByMonth.length));
  const chartMaximum = Math.max(1, ...monthly.flatMap((item) => [item.invoiced, item.collected, item.expenses]));
  const chartColors = { invoiced: "#6d55d8", collected: "#45a27b", expenses: "#e49a58" };

  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE PERFORMANCE</div><h1>Analytics & reports</h1><p>Operational and financial reporting for your selected period.</p></div></section>
    <section className="panel report-filter"><label className="form-field"><span>From</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label className="form-field"><span>To</span><input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label><button className="button button-primary" disabled={loading || !from || !to} onClick={() => void load(true)}>{loading ? "Updating…" : "Update report"}</button></section>
    {error && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    {loading && !report ? <section className="panel"><div className="table-loading"><span className="spinner" />Loading analytics…</div></section> : report && <>
      <section className="stats-grid analytics-summary"><article className="stat-card"><div className="stat-top"><span className="stat-label">Completed reels</span><span className="stat-icon violet"><Activity size={18} /></span></div><div className="stat-value">{report.production.completedCount}</div><div className="stat-foot"><span>Average revisions: {report.production.averageRevisions}</span></div></article>{report.financial && <><article className="stat-card"><div className="stat-top"><span className="stat-label">Outstanding receivables</span><span className="stat-icon orange"><Wallet size={18} /></span></div><div className="stat-value">{money(report.financial.receivablesPaise)}</div><div className="stat-foot"><span>{report.financial.overdueInvoices} overdue invoices</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-label">Collected · selected period</span><span className="stat-icon green"><Wallet size={18} /></span></div><div className="stat-value">{money(report.financial.collectedByMonth.reduce((sum, item) => sum + item.amountPaise, 0))}</div><div className="stat-foot"><span>Recorded payments</span></div></article></>}</section>
      <div className="analytics-grid"><section className="panel"><div className="panel-heading"><div><div className="section-kicker">PRODUCTION</div><h2>Reels by status</h2></div></div>{report.productionByStatus.length ? <div className="report-bars">{report.productionByStatus.map((item) => <div className="report-bar-row" key={item._id}><span>{item._id.replaceAll("_", " ")}</span><div><i style={{ width: `${Math.max(4, item.count / highestCount * 100)}%` }} /></div><b>{item.count}</b></div>)}</div> : <p className="report-empty">No production records in this range.</p>}</section><section className="panel"><div className="panel-heading"><div><div className="section-kicker">TEAM</div><h2>Task workload</h2></div></div>{report.taskWorkload.length ? <div className="report-bars">{report.taskWorkload.map((item) => <div className="report-bar-row" key={item.name}><span>{item.name}</span><div><i style={{ width: `${Math.max(4, item.completed / Math.max(1, item.total) * 100)}%` }} /></div><b>{item.completed}/{item.total}</b><small>{item.overdue} overdue</small></div>)}</div> : <p className="report-empty">No task records in this range.</p>}</section></div>
      {report.financial && <section className="panel financial-report"><div className="panel-heading"><div><div className="section-kicker">FINANCE</div><h2>Monthly cash & billing</h2></div><div className="heading-actions">{["invoices", "payments", "expenses"].map((type) => <div className="report-export-actions" key={type}><button className="button button-secondary" disabled={Boolean(downloading)} onClick={() => void exportReport(type, "csv")}><Download size={14} /> {type} CSV</button><button className="button button-secondary" disabled={Boolean(downloading)} onClick={() => void exportReport(type, "pdf")}><Download size={14} /> {type} PDF</button></div>)}</div></div>{hasFinancialData ? <><div className="chart-legend" aria-label="Chart legend">{Object.entries(chartColors).map(([key, color]) => <span key={key}><i style={{ backgroundColor: color }} />{key}</span>)}</div><div className="monthly-chart-scroll"><svg className="monthly-chart" viewBox="0 0 720 170" role="img" aria-labelledby="monthly-chart-title monthly-chart-description"><title id="monthly-chart-title">Monthly invoiced, collected, and expense totals</title><desc id="monthly-chart-description">Grouped bar chart comparing the three financial totals for each month in the selected date range.</desc><line x1="30" y1="130" x2="710" y2="130" stroke="currentColor" opacity=".18" />{monthly.map((item, index) => { const step = 680 / monthly.length; const barWidth = Math.min(9, Math.max(2, step / 5)); const x = 35 + index * step + step / 2 - barWidth * 1.65; return <g key={item.month}><title>{new Date(item.year, item.monthNumber - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}: invoiced {money(item.invoiced)}, collected {money(item.collected)}, expenses {money(item.expenses)}</title>{Object.entries(chartColors).map(([key, color], groupIndex) => { const value = item[key]; const height = value ? Math.max(1, value / chartMaximum * 104) : 0; return <rect key={key} x={x + groupIndex * barWidth * 1.2} y={130 - height} width={barWidth} height={height} rx="2" fill={color} />; })}<text x={35 + index * step + step / 2} y="148" textAnchor="middle">{new Date(item.year, item.monthNumber - 1, 1).toLocaleDateString(undefined, { month: "short" })}</text></g>; })}</svg></div><div className="table-scroll"><table className="data-table"><thead><tr><th>MONTH</th><th>INVOICED</th><th>COLLECTED</th><th>EXPENSES</th></tr></thead><tbody>{monthly.map((item) => <tr key={item.month}><td><b>{new Date(item.year, item.monthNumber - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</b></td><td>{money(item.invoiced)}</td><td>{money(item.collected)}</td><td>{money(item.expenses)}</td></tr>)}</tbody></table></div></> : <p className="report-empty">No financial records in this range.</p>}</section>}
      <section className="panel export-panel"><div><FileSpreadsheet size={17} /><span><b>Production export</b><small>Reel status, priority, client and deadlines in CSV or PDF format.</small></span></div><div className="heading-actions"><button className="button button-secondary" disabled={Boolean(downloading)} onClick={() => void exportReport("production", "csv")}><Download size={14} /> Download CSV</button><button className="button button-secondary" disabled={Boolean(downloading)} onClick={() => void exportReport("production", "pdf")}><Download size={14} /> Download PDF</button></div></section>
    </>}
  </AppShell>;
}
