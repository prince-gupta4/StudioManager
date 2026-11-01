import { jsx as _jsx } from "react/jsx-runtime";
import "./globals.css";
export const metadata = {
    title: "ReelManager | Studio workspace",
    description: "Manage creative clients and production operations in one workspace.",
};
export default function RootLayout({ children }) {
    return _jsx("html", { lang: "en", children: _jsx("body", { children: children }) });
}
