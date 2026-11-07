"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    authApi.me().then(() => router.replace("/dashboard")).catch(() => {});
  }, [router]);

  return (
    <main className="flex flex-1 flex-col">
      <SiteHeader marker="01 / Home" />

      <section className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        <div className="flex flex-col justify-center border-b-2 border-ink px-gutter py-12 lg:col-span-9 lg:border-b-0 lg:border-r-2 lg:py-20">
          <p className="border-l-2 border-accent pl-3 text-label font-strong uppercase text-accent">
            Udyam Digital
          </p>
          <h1 className="mt-8 text-display text-ink">
            Everything your business needs, in one place.
          </h1>
          <p className="mt-8 max-w-xl text-lead text-muted">
            Create an account or log in to continue to your workspace.
          </p>
        </div>

        <aside className="flex flex-col justify-end gap-3 px-gutter py-10 lg:col-span-3 lg:py-16">
          <p className="pb-2 text-label font-strong uppercase text-muted">
            Access
          </p>
          <Link
            href="/register"
            className="border-2 border-accent bg-accent px-5 py-3 text-center text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="border-2 border-ink px-5 py-3 text-center text-label font-strong uppercase text-ink hover:bg-ink hover:text-white"
          >
            Log in
          </Link>
        </aside>
      </section>

      <footer className="border-t-2 border-ink">
        <div className="grid grid-cols-2 divide-x-2 divide-ink">
          <div className="px-gutter py-4">
            <span className="text-label font-strong uppercase text-ink">
              Udyam Digital
            </span>
          </div>
          <div className="px-gutter py-4">
            <span className="text-label font-strong uppercase text-muted">
              Workspace access
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
