"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

const kinds = {
  shooting: "Shooting",
  delivery: "Delivery deadline",
  editing: "Editing task",
  marketing: "Marketing task",
  other: "Production task",
  contract_renewal: "Contract renewal",
  billing_cycle: "Billing cycle",
  invoice_due: "Invoice due",
};
const dateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const from = dateInput(new Date(month.getFullYear(), month.getMonth(), 1));
      const to = dateInput(new Date(month.getFullYear(), month.getMonth() + 1, 0));
      const result = await api(`/calendar?from=${from}&to=${to}`);
      setEvents(result.events);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load calendar events."); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => { void load(); }, [load]);

  const groups = events.reduce((accumulator, event) => {
    const key = new Date(event.date).toLocaleDateString();
    accumulator[key] ||= [];
    accumulator[key].push(event);
    return accumulator;
  }, {});
  const money = (paise) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return <AppShell>
    <section className="content-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> SCHEDULE & DEADLINES</div><h1>Calendar</h1><p>Production deadlines, shoots, billing-cycle endings and upcoming invoice due dates.</p></div><div className="calendar-controls"><button className="button button-secondary" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button><strong>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong><button className="button button-secondary" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button><button className="button button-secondary" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button></div></section>
    {error && <div className="inline-error" style={{ marginBottom: 13 }}>{error}</div>}
    <section className="panel calendar-panel">{loading ? <div className="table-loading"><span className="spinner" />Loading calendar…</div> : events.length === 0 ? <div className="empty-state"><div className="empty-icon"><CalendarDays size={21} /></div><h3>No events this month</h3><p>Scheduled shoots and production dates will appear here.</p></div> : <div className="calendar-agenda">{Object.entries(groups).map(([date, items]) => <section className="calendar-day" key={date}><h2>{new Date(items[0].date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2><div className="calendar-event-list">{items.map((event) => <article className={`calendar-event calendar-event-${event.kind}`} key={`${event.kind}-${event.id}`}><span className="calendar-event-dot" /><div className="calendar-event-copy"><b>{event.title}</b><span>{kinds[event.kind] || event.kind}{event.client ? ` · ${event.client}` : ""}{event.detail ? ` · ${event.detail}` : ""}</span></div>{event.amountPaise != null && <strong>{money(event.amountPaise)}</strong>}<small><Clock3 size={12} />{new Date(event.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></article>)}</div></section>)}</div>}</section>
  </AppShell>;
}
