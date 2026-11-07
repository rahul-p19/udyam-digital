"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "udyam-admin-key";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [key, setKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setKey(sessionStorage.getItem(STORAGE_KEY));
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sessionStorage.setItem(STORAGE_KEY, input.trim());
    setKey(input.trim());
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setKey(null);
    setInput("");
  }

  if (!mounted) return null;

  if (!key) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <p className="text-label font-strong uppercase text-accent mb-2">Accel Business</p>
          <h1 className="text-3xl font-[750] tracking-tight text-ink mb-6">Admin access</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter admin key"
              className="w-full border-2 border-ink px-4 py-3 text-body text-ink bg-transparent outline-none focus:border-accent"
              autoFocus
            />
            <button
              type="submit"
              className="w-full border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/admin/leads", label: "Dropped leads" },
    { href: "/admin/kyc", label: "KYC review queue" },
  ];

  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b-2 border-ink px-gutter py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-label font-strong uppercase text-accent">Accel Business · Admin</span>
          <nav className="flex gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-label font-strong uppercase ${
                  pathname.startsWith(link.href) ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-label font-strong uppercase text-muted hover:text-ink"
        >
          Sign out
        </button>
      </header>

      <AdminKeyContext value={key}>
        {children}
      </AdminKeyContext>
    </div>
  );
}

import { createContext, useContext } from "react";

const AdminKeyCtx = createContext<string>("");
export function AdminKeyContext({ value, children }: { value: string; children: React.ReactNode }) {
  return <AdminKeyCtx.Provider value={value}>{children}</AdminKeyCtx.Provider>;
}
export function useAdminKey() {
  return useContext(AdminKeyCtx);
}
