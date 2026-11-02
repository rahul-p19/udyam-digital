"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
      profile.monthlyBudget.min !== null || profile.monthlyBudget.max !== null
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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        <span className="text-xs">{profile?.profileComplete ? "Complete" : "In progress"}</span>
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
          ))}

          {loading && <p className="text-sm animate-pulse">Thinking...</p>}
          {error && <p className="text-sm" role="alert">{error}</p>}

          {profile?.profileComplete && (
            <section className="border rounded-2xl p-5 space-y-3">
              <h2 className="font-semibold">Your business profile</h2>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {profileSummary(profile).map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-semibold">{label}</dt>
                    <dd>{value || "Not specified"}</dd>
                  </div>
                ))}
              </dl>
              <button type="button" className="border rounded-lg px-4 py-2 text-sm">
                Continue to product recommendations
              </button>
            </section>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      <footer className="border-t px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-end gap-3 border rounded-2xl p-2">
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
            className="flex-1 resize-none outline-none border-none px-3 py-2 text-sm max-h-32"
          />
          <button type="submit" disabled={!inputValue.trim() || loading || !sessionId || profile?.profileComplete} className="w-10 h-10 rounded-xl border flex items-center justify-center disabled:opacity-30" aria-label="Send message">
            ↑
          </button>
        </form>
        <p className="text-center text-xs mt-3">Share one detail or several at a time. Your answers are saved for this session.</p>
      </footer>
    </div>
  );
}
