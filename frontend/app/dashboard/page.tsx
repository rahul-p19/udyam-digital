"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
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
    <main className="flex flex-1 flex-col">
      <SiteHeader marker="Account / Dashboard" />

      <section className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        <aside className="border-b-2 border-ink px-gutter py-10 lg:col-span-3 lg:border-b-0 lg:border-r-2 lg:py-16">
          <p className="text-label font-strong uppercase text-accent">
            03 / Account
          </p>
          <h1 className="mt-4 text-4xl font-[750] leading-none tracking-tight text-ink">
            Dashboard
          </h1>
          <p className="mt-4 max-w-xs text-metadata text-muted">
            Your Udyam Digital workspace.
          </p>
        </aside>

        <div className="px-gutter py-10 lg:col-span-9 lg:py-16">
          {loading ? (
            <p className="text-metadata text-muted">
              Loading your session...
            </p>
          ) : error ? (
            <div className="max-w-md space-y-6 border-t-2 border-ink pt-6">
              <p
                role="alert"
                className="border-l-2 border-accent bg-surface px-3 py-2 text-metadata text-accent"
              >
                {error}
              </p>
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="border-2 border-ink px-5 py-3 text-label font-strong uppercase text-ink hover:bg-ink hover:text-white"
              >
                Go to login
              </button>
            </div>
          ) : user ? (
            <div className="max-w-xl">
              <p className="text-label font-strong uppercase text-muted">
                Signed in as
              </p>
              <p className="mt-2 border-b-2 border-ink pb-5 text-4xl font-[750] leading-none tracking-tight text-ink">
                {user.name ?? user.email}
              </p>

              <dl className="divide-y divide-ink/15 border-b-2 border-ink">
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                  <dt className="text-label font-strong uppercase text-muted">
                    Email
                  </dt>
                  <dd className="break-all text-metadata text-ink">
                    {user.email}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-8 w-full border-2 border-accent bg-accent px-6 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loggingOut ? "Logging out..." : "Log out"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
