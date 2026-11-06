"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SiteHeader } from "@/components/site-header";
import { ApiError, authApi } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setPending(true);

    try {
      await authApi.register({
        email,
        password,
        name: name.trim() === "" ? undefined : name.trim(),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to create your account",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader marker="Account / Register" />

      <section className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        <aside className="border-b-2 border-ink px-gutter py-10 lg:col-span-3 lg:border-b-0 lg:border-r-2 lg:py-16">
          <p className="text-label font-strong uppercase text-accent">
            02 / Access
          </p>
          <h1 className="mt-4 text-4xl font-[750] leading-none tracking-tight text-ink">
            Create your account
          </h1>
          <p className="mt-4 max-w-xs text-metadata text-muted">
            Start using Udyam Digital today.
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
                htmlFor="name"
                className="text-label font-strong uppercase text-muted"
              >
                Name <span className="text-muted/60">(optional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full border-0 border-b-2 border-ink/20 bg-transparent px-0 py-3 text-body text-ink focus:border-accent"
              />
            </div>

            <div className="mt-5 space-y-1.5">
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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-0 border-b-2 border-ink/20 bg-transparent px-0 py-3 text-body text-ink focus:border-accent"
              />
              <p className="text-metadata text-muted">At least 8 characters.</p>
            </div>

            <div className="mt-5 space-y-1.5">
              <label
                htmlFor="confirm-password"
                className="text-label font-strong uppercase text-muted"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full border-0 border-b-2 border-ink/20 bg-transparent px-0 py-3 text-body text-ink focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="mt-8 w-full border-2 border-accent bg-accent px-6 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-8 text-metadata text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-strong text-accent underline underline-offset-4 hover:text-accent-hover"
            >
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
