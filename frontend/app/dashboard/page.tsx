"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, authApi, type AuthUser } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    authApi
      .me()
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser);
      })
      .catch((err) => {
        if (!active) return;

        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }

        setError(
          err instanceof Error ? err.message : "Unable to load your session",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // Cookies are cleared by the server; continue to login either way.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        {loading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Loading your session...
          </p>
        ) : error ? (
          <div className="space-y-4">
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/15"
            >
              Go to login
            </button>
          </div>
        ) : user ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Signed in as
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {user.name ?? user.email}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {user.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
