// app/ui/AuditForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type State = "idle" | "loading" | "success" | "error";

type Answers = {
  name: string;
  email: string;
  phone: string;
  businessName: string;
  businessCategory: string;
  serviceArea: string;
  websiteLink: string;
  socialLinkInput: string;
  bookingLink: string;
  otherLink: string;
  links: string;
  mainGoal: string;
  services: string;
  process: string;
  style: string;
  assetsChoice: string;
  assetsLinks: string;
  notes: string;
};

type Question = {
  key: keyof Answers;
  eyebrow: string;
  title: string;
  help?: string;
  required?: boolean;
  input: "text" | "email" | "tel" | "textarea" | "choice" | "links";
  placeholder?: string;
  options?: string[];
  autoComplete?: string;
  multi?: boolean;
};

const STORAGE_KEY = "replicant.websiteAuditWizard.v1";

const INITIAL_ANSWERS: Answers = {
  name: "",
  email: "",
  phone: "",
  businessName: "",
  businessCategory: "",
  serviceArea: "",
  websiteLink: "",
  socialLinkInput: "",
  bookingLink: "",
  otherLink: "",
  links: "",
  mainGoal: "",
  services: "",
  process: "",
  style: "",
  assetsChoice: "",
  assetsLinks: "",
  notes: "",
};

const QUESTIONS: Question[] = [
  {
    key: "name",
    eyebrow: "1 of 13",
    title: "What's your name?",
    input: "text",
    placeholder: "Jane Doe",
    autoComplete: "name",
  },
  {
    key: "email",
    eyebrow: "2 of 13",
    title: "Where should we send the audit?",
    help: "Email is the only required field before final submit.",
    required: true,
    input: "email",
    placeholder: "jane@example.com",
    autoComplete: "email",
  },
  {
    key: "phone",
    eyebrow: "3 of 13",
    title: "What's the best phone number, if any?",
    input: "tel",
    placeholder: "(555) 123-4567",
    autoComplete: "tel",
  },
  {
    key: "businessName",
    eyebrow: "4 of 13",
    title: "What's the business name?",
    input: "text",
    placeholder: "Jane's Salon",
  },
  {
    key: "businessCategory",
    eyebrow: "5 of 13",
    title: "What kind of business is it?",
    input: "choice",
    options: [
      "Beauty & Grooming",
      "Wellness & Aesthetics",
      "Home & Trade Services",
      "Other",
    ],
  },
  {
    key: "serviceArea",
    eyebrow: "6 of 13",
    title: "What city or service area do you cover?",
    input: "text",
    placeholder: "Brooklyn, NY or Atlanta metro",
  },
  {
    key: "links",
    eyebrow: "7 of 13",
    title: "Add any links you already have.",
    help: "Leave anything blank if it does not apply.",
    input: "links",
  },
  {
    key: "mainGoal",
    eyebrow: "8 of 13",
    title: "What would you like to get out of the site?",
    input: "choice",
    multi: true,
    options: [
      "Get new customers",
      "Get more bookings",
      "Get more quote requests",
      "Get more calls",
      "Look more professional",
      "Make services/pricing easier to find",
      "Other",
    ],
  },
  {
    key: "services",
    eyebrow: "9 of 13",
    title: "What services do you offer?",
    input: "textarea",
    placeholder: "Haircuts, color, bridal styling, consultations...",
  },
  {
    key: "process",
    eyebrow: "10 of 13",
    title: "How do customers book or request a quote right now?",
    input: "textarea",
    placeholder: "They call, DM, use Square, fill out a form, text me...",
  },
  {
    key: "style",
    eyebrow: "11 of 13",
    title: "What style should the website have?",
    input: "choice",
    options: [
      "Clean and professional",
      "Premium / luxury",
      "Bold and modern",
      "Warm and local",
      "Simple and minimal",
      "Not sure yet",
      "Other",
    ],
  },
  {
    key: "assetsChoice",
    eyebrow: "12 of 13",
    title: "What about photos, videos, or brand assets?",
    help: "Direct uploads can come later. For now, links or a simple answer work.",
    input: "choice",
    options: ["I'll paste links", "I'll send them later", "None yet"],
  },
  {
    key: "notes",
    eyebrow: "13 of 13",
    title: "Anything else we should know?",
    input: "textarea",
    placeholder: "Competitors you like, must-have pages, problems to fix...",
  },
];

function normalizeUrl(value: string) {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function extractUrls(value: string) {
  return value
    .split(/[\s,]+/)
    .map((part) => part.trim().replace(/[).,]+$/, ""))
    .filter((part) => /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(part))
    .map(normalizeUrl);
}

function labelFor(key: keyof Answers) {
  const labels: Record<keyof Answers, string> = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    businessName: "Business name",
    businessCategory: "Business type/category",
    serviceArea: "Service area/location",
    websiteLink: "Website link",
    socialLinkInput: "Instagram / Facebook / TikTok link",
    bookingLink: "Booking link",
    otherLink: "Other link",
    links: "Current website/social/booking links",
    mainGoal: "Main goal",
    services: "Services offered",
    process: "Current booking or quote process",
    style: "Desired style/vibe",
    assetsChoice: "Assets/media plan",
    assetsLinks: "Assets/media links",
    notes: "Final notes",
  };
  return labels[key];
}

function answerForSummary(answers: Answers, key: keyof Answers) {
  const value = answers[key].trim();
  return value || "Skipped";
}

function combineLinks(answers: Answers) {
  return [
    answers.websiteLink,
    answers.socialLinkInput,
    answers.bookingLink,
    answers.otherLink,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

function buildMessage(answers: Answers) {
  const lines: string[] = ["Website audit wizard submission", ""];
  const orderedKeys: (keyof Answers)[] = [
    "name",
    "email",
    "phone",
    "businessName",
    "businessCategory",
    "serviceArea",
    "links",
    "mainGoal",
    "services",
    "process",
    "style",
    "assetsChoice",
  ];

  for (const key of orderedKeys) {
    lines.push(`${labelFor(key)}: ${answerForSummary(answers, key)}`);
  }

  if (answers.assetsChoice === "I'll paste links") {
    lines.push(`${labelFor("assetsLinks")}: ${answerForSummary(answers, "assetsLinks")}`);
  }

  lines.push(`${labelFor("notes")}: ${answerForSummary(answers, "notes")}`);
  return lines.join("\n");
}

export default function AuditForm() {
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [step, setStep] = useState(-1);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          answers?: Partial<Answers>;
          step?: number;
        };
        setAnswers({ ...INITIAL_ANSWERS, ...(parsed.answers || {}) });
        if (typeof parsed.step === "number") {
          setStep(Math.min(Math.max(parsed.step, -1), QUESTIONS.length - 1));
        }
      }
    } catch {
      // Ignore bad localStorage and let the user continue with a fresh wizard.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || state === "success") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, step }));
  }, [answers, hydrated, state, step]);

  const currentQuestion = step >= 0 ? QUESTIONS[step] : null;
  const progress = useMemo(() => {
    if (step < 0) return 0;
    return Math.round(((step + 1) / QUESTIONS.length) * 100);
  }, [step]);

  const disabled = state === "loading";
  const isLastStep = step === QUESTIONS.length - 1;

  function updateAnswer(key: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function updateLinkAnswer(key: keyof Answers, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      return { ...next, links: combineLinks(next) };
    });
    setError("");
  }

  function toggleChoice(key: keyof Answers, option: string, multi?: boolean) {
    if (!multi) {
      updateAnswer(key, option);
      return;
    }

    setAnswers((prev) => {
      const selected = prev[key]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const nextSelected = selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option];
      return { ...prev, [key]: nextSelected.join(", ") };
    });
    setError("");
  }

  function validateCurrentStep() {
    if (!currentQuestion?.required) return true;
    const value = answers[currentQuestion.key].trim();
    if (currentQuestion.key === "email") {
      if (!value) {
        setError("Email is required so we know where to send the audit.");
        return false;
      }
      if (!isValidEmail(value)) {
        setError("Enter a valid email so we know where to send the audit.");
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    if (isLastStep) {
      void onSubmit();
      return;
    }
    setStep((prev) => Math.min(prev + 1, QUESTIONS.length - 1));
  }

  function skipCurrent() {
    if (!currentQuestion || currentQuestion.required) return;
    setError("");
    setAnswers((prev) => ({ ...prev, [currentQuestion.key]: "" }));
    if (isLastStep) {
      void onSubmit();
      return;
    }
    setStep((prev) => Math.min(prev + 1, QUESTIONS.length - 1));
  }

  async function onSubmit() {
    const email = answers.email.trim();
    if (!email) {
      setStep(1);
      setError("Email is required so we know where to send the audit.");
      return;
    }
    if (!isValidEmail(email)) {
      setStep(1);
      setError("Enter a valid email so we know where to send the audit.");
      return;
    }

    setState("loading");
    setError("");

    const urls = extractUrls(answers.links);
    const socialUrl =
      urls.find((url) => /instagram|facebook|tiktok|linkedin|x\.com|twitter/i.test(url)) || "";
    const websiteUrl = urls.find((url) => url !== socialUrl) || urls[0] || "";

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: answers.name,
          businessName: answers.businessName,
          email,
          phone: answers.phone,
          businessCategory: answers.businessCategory,
          currentWebsiteUrl: websiteUrl,
          socialLink: socialUrl,
          mainGoal: answers.mainGoal,
          interestType: "Website",
          message: buildMessage(answers),
          source: "Website Audit",
          status: "Audit Requested",
        }),
      });
      const body = await res.text();
      if (!res.ok) {
        console.error("[audit-wizard] /api/lead failed", res.status, body);
        throw new Error("Bad response");
      }
      window.localStorage.removeItem(STORAGE_KEY);
      setState("success");
      setAnswers(INITIAL_ANSWERS);
      setStep(-1);
    } catch {
      setState("error");
      setError("Something went wrong. Try again.");
    }
  }

  const inputClass =
    "mt-4 w-full rounded-lg bg-white/5 px-4 py-3 text-base text-white placeholder-white/35 outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-sky-500/60 disabled:cursor-not-allowed disabled:opacity-60";
  const buttonBase =
    "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

  if (state === "success") {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/20">
          ✓
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-white">Audit requested.</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Thanks. We will review your answers and reach out with a clear,
            useful next step.
          </p>
        </div>
      </div>
    );
  }

  if (step < 0) {
    return (
      <div className="space-y-7">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-300/80">
            Free website audit
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">
            A few quick questions, one at a time.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            This should feel easy, not like homework. Share what you know now
            and skip what you do not know.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            "Takes about 5 minutes",
            "Answer what you can",
            "If you don't know something, skip it and continue",
            "Photos/videos/assets come last",
          ].map((item) => (
            <div
              key={item}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75"
            >
              {item}
            </div>
          ))}
        </div>

        <button
          type="button"
          className={`${buttonBase} bg-sky-500 text-white shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/20 hover:bg-sky-400`}
          onClick={() => setStep(0)}
        >
          Start the audit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-xs text-white/50">
          <span>{currentQuestion?.eyebrow}</span>
          <span>{progress}% complete</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-sky-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentQuestion && (
        <div>
          <h2 className="text-2xl font-semibold leading-tight text-white">
            {currentQuestion.title}
          </h2>
          {currentQuestion.help && (
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              {currentQuestion.help}
            </p>
          )}

          {currentQuestion.input === "links" ? (
            <div className="mt-5 grid gap-4">
              {[
                {
                  key: "websiteLink" as const,
                  label: "Website link",
                  placeholder: "https://yourbusiness.com",
                },
                {
                  key: "socialLinkInput" as const,
                  label: "Instagram / Facebook / TikTok link",
                  placeholder: "https://instagram.com/yourhandle",
                },
                {
                  key: "bookingLink" as const,
                  label: "Booking link",
                  placeholder: "https://booksy.com/...",
                },
                {
                  key: "otherLink" as const,
                  label: "Other link",
                  placeholder: "Google Business, Yelp, portfolio, etc.",
                },
              ].map((field) => (
                <label key={field.key} className="text-sm text-white/65">
                  {field.label}
                  <input
                    type="text"
                    disabled={disabled}
                    className="mt-2 w-full rounded-lg bg-white/5 px-4 py-3 text-base text-white placeholder-white/35 outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-sky-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder={field.placeholder}
                    value={answers[field.key]}
                    onChange={(e) => updateLinkAnswer(field.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          ) : currentQuestion.input === "choice" ? (
            <div className="mt-5 grid gap-3">
              {currentQuestion.options?.map((option) => {
                const selected = answers[currentQuestion.key]
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean);
                const active = currentQuestion.multi
                  ? selected.includes(option)
                  : answers[currentQuestion.key] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={disabled}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                      active
                        ? "border-sky-300/60 bg-sky-400/15 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.06]"
                    }`}
                    onClick={() =>
                      toggleChoice(currentQuestion.key, option, currentQuestion.multi)
                    }
                  >
                    {option}
                  </button>
                );
              })}

              {currentQuestion.key === "assetsChoice" &&
                answers.assetsChoice === "I'll paste links" && (
                  <textarea
                    rows={4}
                    disabled={disabled}
                    className={inputClass}
                    placeholder="Paste Google Drive, Dropbox, Instagram, or portfolio links here."
                    value={answers.assetsLinks}
                    onChange={(e) => updateAnswer("assetsLinks", e.target.value)}
                  />
                )}
              {currentQuestion.key === "assetsChoice" &&
                answers.assetsChoice === "I'll send them later" && (
                  <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/65">
                    You can text photos, videos, logos, or links to 954-280-0510
                    after submitting. You can also wait for our follow-up.
                  </p>
                )}
            </div>
          ) : currentQuestion.input === "textarea" ? (
            <textarea
              rows={6}
              disabled={disabled}
              className={inputClass}
              placeholder={currentQuestion.placeholder}
              value={answers[currentQuestion.key]}
              onChange={(e) => updateAnswer(currentQuestion.key, e.target.value)}
            />
          ) : (
            <input
              type={currentQuestion.input}
              disabled={disabled}
              autoComplete={currentQuestion.autoComplete}
              className={inputClass}
              placeholder={currentQuestion.placeholder}
              value={answers[currentQuestion.key]}
              onChange={(e) => updateAnswer(currentQuestion.key, e.target.value)}
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={disabled}
          className={`${buttonBase} border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]`}
          onClick={() => {
            setError("");
            setStep((prev) => Math.max(prev - 1, -1));
          }}
        >
          Back
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {!currentQuestion?.required && (
            <button
              type="button"
              disabled={disabled}
              className={`${buttonBase} text-white/55 hover:text-white`}
              onClick={skipCurrent}
            >
              {isLastStep ? "Skip & submit" : "Skip"}
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            className={`${buttonBase} bg-sky-500 text-white shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/20 hover:bg-sky-400`}
            onClick={goNext}
          >
            {state === "loading"
              ? "Sending..."
              : isLastStep
                ? "Submit audit request"
                : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
