"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useRouter } from "next/navigation";
import { advisorApi, type BusinessProfile } from "../../lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

const profileFields: Array<keyof BusinessProfile> = [
  "businessType",
  "employeeCount",
  "locationCount",
  "currentInfrastructure",
  "requirements",
  "monthlyBudget",
];

function isCollected(profile: BusinessProfile, field: keyof BusinessProfile) {
  if (field === "monthlyBudget") {
    return (
      profile.monthlyBudget.min !== null ||
      profile.monthlyBudget.max !== null ||
      profile.monthlyBudget.isFlexible === true
    );
  }
  const value = profile[field];
  return Array.isArray(value) ? value.length > 0 : value !== null;
}

function profileSummary(profile: BusinessProfile) {
  return [
    ["Business", profile.businessType],
    ["Employees", profile.employeeCount],
    ["Locations", profile.locationCount],
    ["Connectivity", profile.currentInfrastructure.join(", ")],
    ["Services", profile.requirements.join(", ")],
    [
      "Monthly budget",
      profile.monthlyBudget.min === null && profile.monthlyBudget.max === null
        ? "Flexible"
        : `₹${profile.monthlyBudget.min ?? profile.monthlyBudget.max}${profile.monthlyBudget.min !== profile.monthlyBudget.max ? ` - ₹${profile.monthlyBudget.max}` : ""}`,
    ],
  ];
}

export default function Page() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedSessionId = window.localStorage.getItem("udyam-advisor-session");
    const load = savedSessionId
      ? advisorApi.getSession(savedSessionId).then((session) => {
          setSessionId(session.sessionId);
          setMessages(session.messages);
          setProfile(session.profile);
        })
      : advisorApi.createSession().then((session) => {
          window.localStorage.setItem("udyam-advisor-session", session.sessionId);
          setSessionId(session.sessionId);
          setProfile(session.businessProfile);
          setMessages([
            {
              role: "assistant",
              content: session.assistantMessage,
              createdAt: new Date().toISOString(),
            },
          ]);
        });

    load.catch((loadError: Error) => {
      setError(loadError.message || "Unable to start the advisor.");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = inputValue.trim();
    if (!message || !sessionId || loading || profile?.profileComplete) return;

    setInputValue("");
    setError(null);
    setLoading(true);
    setMessages((current) => [
      ...current,
      { role: "user", content: message, createdAt: new Date().toISOString() },
    ]);

    try {
      const response = await advisorApi.sendMessage(sessionId, message);
      setProfile(response.businessProfile);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: response.assistantMessage,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send message.");
    } finally {
      setLoading(false);
    }
  }

  const collectedCount = profile
    ? profileFields.filter((field) => isCollected(profile, field)).length
    : 0;

  return (
    <div className="flex h-screen flex-col bg-ground">
      <SiteHeader marker="Advisor / Session" />

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
        <aside className="border-b-2 border-ink px-gutter py-6 lg:col-span-3 lg:overflow-y-auto lg:border-b-0 lg:border-r-2 lg:py-10">
          <p className="text-label font-strong uppercase text-accent">
            Advisor
          </p>
          <h1 className="mt-2 text-item-title font-[750] tracking-tight text-ink">
            Udyam AI Advisor
          </h1>
          <p className="mt-2 text-metadata text-muted">
            Your business connectivity consultant
          </p>

          <div className="mt-8">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-label font-strong uppercase text-muted">
                Profile
              </span>
              <span className="text-label font-strong uppercase text-accent">
                {collectedCount}/6
              </span>
            </div>
            <div className="mt-2 h-2 w-full bg-ink/10">
              <div
                className="h-full bg-accent"
                style={{
                  width: `${(collectedCount / profileFields.length) * 100}%`,
                }}
              />
            </div>
            <p className="mt-3 text-metadata text-muted">
              Business profile: {collectedCount}/6 details collected.
            </p>
          </div>

          <div className="mt-6 border-t-2 border-ink pt-4">
            <p className="text-label font-strong uppercase text-muted">
              Status
            </p>
            <p
              className={`mt-2 inline-block border-2 px-2 py-1 text-label font-strong uppercase ${
                profile?.profileComplete
                  ? "border-accent text-accent"
                  : "border-ink text-ink"
              }`}
            >
              {profile?.profileComplete ? "Complete" : "In progress"}
            </p>
          </div>

          {process.env.NODE_ENV !== "production" && (
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem("udyam-advisor-session");
                window.location.reload();
              }}
              className="mt-6 text-label opacity-50 hover:opacity-100"
            >
              [dev] clear session
            </button>
          )}
        </aside>

        <main className="flex min-h-0 flex-1 flex-col lg:col-span-9">
          <div className="flex-1 overflow-y-auto px-gutter py-8">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((message, index) => (
                <article
                  key={`${message.createdAt}-${index}`}
                  className={`border-l-2 pl-4 ${
                    message.role === "user"
                      ? "border-accent bg-surface py-3 pr-3"
                      : "border-ink"
                  }`}
                >
                  <p className="text-label font-strong uppercase text-muted">
                    {message.role === "user" ? "You" : "Udyam AI Advisor"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-body leading-relaxed text-ink">
                    {message.content}
                  </p>
                </article>
              ))}

              {loading ? (
                <p className="text-metadata text-muted">Thinking...</p>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="border-l-2 border-accent bg-surface px-3 py-2 text-metadata text-accent"
                >
                  {error}
                </p>
              ) : null}

              {profile?.profileComplete && (
                <section className="border-t-2 border-ink pt-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-item-title font-[750] tracking-tight text-ink">
                      Your business profile
                    </h2>
                    <span className="text-label font-strong uppercase text-accent">
                      Complete
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-px border-y-2 border-ink bg-ink/15 sm:grid-cols-2">
                    {profileSummary(profile).map(([label, value]) => (
                      <div key={label} className="bg-ground p-3">
                        <dt className="text-label font-strong uppercase text-muted">
                          {label}
                        </dt>
                        <dd className="mt-1 text-metadata text-ink">
                          {value || "Not specified"}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/recommendations?sessionId=${encodeURIComponent(sessionId ?? "")}`)
                    }
                    className="mt-6 border-2 border-accent bg-accent px-5 py-3 text-label font-strong uppercase text-white hover:border-accent-hover hover:bg-accent-hover"
                  >
                    Continue to product recommendations
                  </button>
                </section>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          <footer className="border-t-2 border-ink px-gutter py-4">
            <form
              onSubmit={handleSubmit}
              className="mx-auto flex max-w-3xl items-end gap-2 border-2 border-ink p-2"
            >
              <textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Tell me about your business..."
                rows={1}
                disabled={loading || profile?.profileComplete}
                className="max-h-32 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-body text-ink placeholder:text-muted/70 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={
                  !inputValue.trim() ||
                  loading ||
                  !sessionId ||
                  profile?.profileComplete
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-accent bg-accent text-white hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Send message"
              >
                ↑
              </button>
            </form>
            <p className="mx-auto mt-3 max-w-3xl text-center text-metadata text-muted">
              Share one detail or several at a time. Your answers are saved for
              this session.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
