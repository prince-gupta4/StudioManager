"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clapperboard, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [visible, setVisible] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function submit(event) {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
            await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
            router.replace("/");
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not sign in.");
        }
        finally {
            setBusy(false);
        }
    }
    return _jsxs("main", { className: "login-page", children: [_jsxs("div", { className: "login-decoration", children: [_jsx("div", { className: "decor-orbit orbit-one" }), _jsx("div", { className: "decor-orbit orbit-two" }), _jsx("div", { className: "decor-dot dot-one" }), _jsx("div", { className: "decor-dot dot-two" }), _jsxs("div", { className: "login-quote", children: [_jsx("span", { children: "\u201C" }), _jsxs("p", { children: ["Make room for the", _jsx("br", {}), "work that moves you."] }), _jsx("small", { children: "YOUR STUDIO, IN SYNC." })] })] }), _jsxs("div", { className: "login-side", children: [_jsxs("div", { className: "login-card", children: [_jsxs("div", { className: "login-brand", children: [_jsx("span", { className: "login-brand-icon", children: _jsx(Clapperboard, { size: 19 }) }), _jsx("b", { children: "reelmanager" })] }), _jsxs("div", { className: "login-heading", children: [_jsx("span", { className: "section-kicker", children: "WELCOME BACK" }), _jsxs("h1", { children: ["Sign in to your", _jsx("br", {}), _jsx("span", { children: "studio workspace." })] }), _jsx("p", { children: "Your creative operations, all in one place." })] }), _jsxs("form", { className: "login-form", onSubmit: submit, children: [_jsx("label", { htmlFor: "email", children: "Work email" }), _jsx("input", { id: "email", autoComplete: "username", type: "email", value: email, onChange: (event) => setEmail(event.target.value), placeholder: "you@yourstudio.com", required: true }), _jsx("div", { className: "password-label", children: _jsx("label", { htmlFor: "password", children: "Password" }) }), _jsxs("div", { className: "password-input", children: [_jsx("input", { id: "password", autoComplete: "current-password", type: visible ? "text" : "password", value: password, onChange: (event) => setPassword(event.target.value), placeholder: "Enter your password", required: true }), _jsx("button", { type: "button", "aria-label": visible ? "Hide password" : "Show password", onClick: () => setVisible(!visible), children: visible ? _jsx(EyeOff, { size: 17 }) : _jsx(Eye, { size: 17 }) })] }), error && _jsx("div", { className: "form-error", role: "alert", children: error }), _jsxs("button", { className: "button button-primary login-submit", disabled: busy, children: [busy ? "Signing in…" : "Sign in", " ", !busy && _jsx(ArrowRight, { size: 17 })] })] }), _jsxs("div", { className: "login-support", children: [_jsx("span", { children: "Secure workspace access" }), _jsx("span", { children: "Contact your workspace administrator for access." })] })] }), _jsxs("div", { className: "login-copyright", children: ["\u00A9 ", new Date().getFullYear(), " ReelManager ", _jsx("span", { children: "\u00B7" }), " Made for the makers."] })] })] });
}
