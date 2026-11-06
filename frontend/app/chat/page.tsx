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
    <div className="h-screen flex flex-col">
      <header className="h-16 border-b flex items-center justify-between px-6">
        <div>
          <h1 className="font-semibold text-lg">Udyam AI Advisor</h1>
          <p className="text-xs">Your business connectivity consultant</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs">{profile?.profileComplete ? "Complete" : "In progress"}</span>
          {process.env.NODE_ENV !== "production" && (
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem("udyam-advisor-session");
                window.location.reload();
              }}
              className="text-xs border rounded px-2 py-1 opacity-50 hover:opacity-100"
            >
              [dev] clear session
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="text-sm">Business profile: {collectedCount}/6 details collected.</p>

          {messages.map((message, index) => (
            <div key={`${message.createdAt}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%] space-y-1">
                <p className="text-xs">{message.role === "user" ? "You" : "Udyam AI Advisor"}</p>
                <div className="rounded-2xl border px-5 py-3">
                  <p className="text-sm leading-7 whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
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
                ))}
              </dl>
              <button
                type="button"
                onClick={() =>
                  router.push(`/recommendations?sessionId=${encodeURIComponent(sessionId ?? "")}`)
                }
                className="border rounded-lg px-4 py-2 text-sm"
              >
                Continue to product recommendations
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
