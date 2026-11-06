"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/site-header";
import { ApiError, authApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await authApi.login({ email, password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader marker="Account / Log in" />

      <section className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        <aside className="border-b-2 border-ink px-gutter py-10 lg:col-span-3 lg:border-b-0 lg:border-r-2 lg:py-16">
          <p className="text-label font-strong uppercase text-accent">
            01 / Access
          </p>
          <h1 className="mt-4 text-4xl font-[750] leading-none tracking-tight text-ink">
            Welcome back
          </h1>
          <p className="mt-4 max-w-xs text-metadata text-muted">
            Log in to your Udyam Digital account.
          </p>
        </aside>

        <div className="px-gutter py-10 lg:col-span-9 lg:py-16">
          <form
            onSubmit={handleSubmit}
            className="max-w-md border-t-2 border-ink pt-6"
          >
            {error ? (
              <p
                role="alert"
                className="mb-6 border-l-2 border-accent bg-surface px-3 py-2 text-metadata text-accent"
              >
                {error}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-label font-strong uppercase text-muted"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border-0 border-b-2 border-ink/20 bg-transparent px-0 py-3 text-body text-ink focus:border-accent"
              />
            </div>

            <div className="mt-5 space-y-1.5">
              <label
                htmlFor="password"
                className="text-label font-strong uppercase text-muted"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-0 border-b-2 border-ink/20 bg-transparent px-0 py-3 text-body text-ink focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="mt-8 w-full border-2 border-accent bg-accent px-6 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="mt-8 text-metadata text-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-strong text-accent underline underline-offset-4 hover:text-accent-hover"
            >
              Create one
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
