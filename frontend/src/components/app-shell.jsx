"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, BriefcaseBusiness, CalendarDays, ChevronDown, Clapperboard, Moon, Sun,
  FileText, Images, LayoutDashboard, LogOut, Menu, Receipt, ScrollText,
  Settings2, Users, Video, Wallet, X,
} from "lucide-react";
import { api } from "@/lib/api";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard, permission: "dashboard:read" },
  { href: "/clients", label: "Clients", icon: Users, permission: "clients:read" },
  { href: "/services", label: "Services", icon: BriefcaseBusiness, permission: "services:read" },
  { href: "/contracts", label: "Contracts", icon: FileText, permission: "contracts:read" },
  { href: "/quotations", label: "Quotations", icon: ScrollText, permission: "contracts:read" },
  { href: "/projects", label: "Projects", icon: Clapperboard, permission: "projects:read" },
  { href: "/production", label: "Production", icon: Video, permission: "production:read" },
  { href: "/media", label: "Media library", icon: Images, permission: "media:read" },
  { href: "/team", label: "Team", icon: Users, permission: "team:read" },
  { href: "/settings", label: "Settings", icon: Settings2 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, permission: "dashboard:read" },
  { href: "/invoices", label: "Invoices", icon: Receipt, permission: "finance:read" },
  { href: "/expenses", label: "Expenses", icon: Wallet, permission: "expenses:read" },
  { href: "/analytics", label: "Analytics", icon: Activity, permission: "dashboard:read" },
];

export function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("reelmanager-theme");
    const initialTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
    api("/auth/me")
      .then(({ user: sessionUser }) => setUser(sessionUser))
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("reelmanager-theme", nextTheme);
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not log out.");
    }
  }

  if (loading || !user) {
    return <main className="auth-loading"><span className="spinner" />Loading your workspace</main>;
  }

  const visibleNavigation = navigation.filter(({ permission }) => !permission || user.permissions.includes(permission));
  const currentPage = navigation.find((item) => item.href === pathname)?.label || "Workspace";

  return <div className="app-frame">
    {mobileOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><Clapperboard size={20} strokeWidth={2.2} /></div>
        <div><strong>reelmanager</strong><span>STUDIO WORKSPACE</span></div>
        <button className="mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={19} /></button>
      </div>
      <div className="workspace-chip"><div className="workspace-avatar">R</div><div><b>Reel Studio</b><small>Agency workspace</small></div><ChevronDown size={15} /></div>
      <p className="nav-caption">WORKSPACE</p>
      <nav className="side-nav">{visibleNavigation.map(({ href, label, icon: Icon }) =>
        <Link key={href} href={href} className={`nav-link ${pathname === href ? "nav-active" : ""}`} onClick={() => setMobileOpen(false)}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
        </Link>)}</nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-dot" /><div><b>Workspace setup</b><span>Core workspace is ready</span></div></div>
        <button className="profile-button" onClick={() => void logout()}>
          <div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="profile-info"><b>{user.name}</b><span>{user.role}</span></div><LogOut size={17} />
        </button>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{currentPage}</b></div>
        <div className="topbar-right"><span className="online-indicator" /> All changes saved <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button><Link className="settings-button" aria-label="Settings" href="/settings"><Settings2 size={18} /></Link></div>
      </header>
      <main className="page-content">{children}</main>
    </div>
  </div>;
}
