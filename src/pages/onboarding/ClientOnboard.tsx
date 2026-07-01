/**
 * ClientOnboard — Public page where clients view and complete the onboarding form.
 * Presented as a multi-step survey (intro → one block per step → credentials →
 * success), styled after the signup survey. Handles signup + form submission in
 * one flow.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { publicFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { FIXED_PROCESSING_MESSAGE, runWithFixedProcessingDelay } from "@/lib/loadingGate";

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, CheckCircle2, ChevronLeft, Check, Loader2 } from "lucide-react";
import type { OnboardingPublicData, FormBlock, BlockResponse } from "@/types/onboarding";

// Survey animation keyframes (self-contained copy, styled after SignUp.tsx).
const animationStyles = `
  @keyframes onboardFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes onboardFadeInDelay1 {
    0% { opacity: 0; transform: translateY(10px); }
    50% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes onboardFadeInDelay2 {
    0% { opacity: 0; transform: translateY(10px); }
    60% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes onboardVibrate {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    20% { transform: translate(1px, -2px) rotate(1deg); }
    40% { transform: translate(1px, 1px) rotate(1deg); }
    60% { transform: translate(1px, 0px) rotate(1deg); }
    80% { transform: translate(1px, -1px) rotate(1deg); }
  }
  @keyframes onboardConfettiFall {
    to { transform: translate(var(--tx), 100vh) rotate(720deg); opacity: 0; }
  }
  .onboard-fade-in { animation: onboardFadeIn 0.6s ease-out; }
  .onboard-fade-in-delay-1 { animation: onboardFadeInDelay1 0.8s ease-out; }
  .onboard-fade-in-delay-2 { animation: onboardFadeInDelay2 1s ease-out; }
  .onboard-vibrate { animation: onboardVibrate 0.8s ease-in-out 1; }
`;

if (typeof document !== "undefined" && !document.getElementById("onboard-survey-styles")) {
  const style = document.createElement("style");
  style.id = "onboard-survey-styles";
  style.textContent = animationStyles;
  document.head.appendChild(style);
}

const signupSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormData = z.infer<typeof signupSchema>;

/** True when a required block still has no usable answer. */
function isBlockAnswered(block: FormBlock, value: BlockResponse["value"]): boolean {
  if (block.type === "welcome") return true;
  if (block.type === "checkbox") return value === true;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

export default function ClientOnboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getUser } = useAuth();

  const [formData, setFormData] = useState<OnboardingPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ type: string; message: string } | null>(null);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    loadForm();
  }, [slug]);

  const loadForm = async (attempt = 0) => {
    try {
      const response = await publicFetch(`/api/v4/onboard/${slug}/`);
      if (response.ok) {
        const data: OnboardingPublicData = await response.json();
        setFormData(data);
        setResponses(data.blocks.map((_, index) => ({ block_index: index, value: null })));
      } else if (response.status === 410) {
        setErrorState({ type: "expired", message: "This onboarding link has expired." });
      } else if (response.status === 409) {
        setErrorState({ type: "completed", message: "This onboarding form has already been completed." });
      } else if (response.status === 404) {
        setErrorState({ type: "not_found", message: "Onboarding link not found." });
      } else if (attempt < 2) {
        // Transient server error — retry silently before surfacing an error
        setTimeout(() => loadForm(attempt + 1), 1200);
        return;
      } else {
        setErrorState({ type: "not_found", message: "Onboarding link not found." });
      }
    } catch {
      if (attempt < 2) {
        setTimeout(() => loadForm(attempt + 1), 1200);
        return;
      }
      setErrorState({ type: "error", message: "Something went wrong. Please try again." });
    }
    setLoading(false);
  };

  const updateResponse = (index: number, value: BlockResponse["value"]) => {
    setResponses((prev) => {
      const updated = [...prev];
      updated[index] = { block_index: index, value };
      return updated;
    });
  };

  const onSubmit = async (signupData: SignupFormData) => {
    if (!formData) return;

    // Validate required fields
    const missingRequired = formData.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block, index }) => {
        if (block.type === "welcome") return false;
        if (!block.required) return false;
        const response = responses[index];
        return !response?.value;
      });

    if (missingRequired.length > 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    setProcessingMessage(FIXED_PROCESSING_MESSAGE);
    try {
      const payload = {
        ...signupData,
        responses,
      };

      const response = await runWithFixedProcessingDelay(
        publicFetch(`/api/v4/onboard/${slug}/submit/`, {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );

      if (response.ok) {
        const data = await response.json();

        // Store auth tokens
        localStorage.setItem("onswift_access", data.access);
        localStorage.setItem("onswift_refresh", data.refresh);
        localStorage.setItem("onswift_user", JSON.stringify(data.user));

        // Sync AuthContext before route guard checks client role on /portal.
        await getUser();

        toast.success("Welcome! Your account has been created.");
        // Advance to the confetti success screen; it redirects to /dashboard.
        setCurrentStep(formData.blocks.length + 2);
      } else {
        const error = await response.json();
        toast.error(error?.email?.[0] || error?.error || "Failed to submit form");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setProcessingMessage("");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error states
  if (errorState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            {errorState.type === "expired" ? (
              <Clock className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            ) : errorState.type === "completed" ? (
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
            ) : (
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            )}
            <h2 className="text-xl font-semibold mb-2">
              {errorState.type === "expired"
                ? "Link Expired"
                : errorState.type === "completed"
                ? "Already Completed"
                : "Link Not Found"}
            </h2>
            <p className="text-muted-foreground">{errorState.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!formData) return null;

  const blocks = formData.blocks;
  const blockCount = blocks.length;
  const credentialsStep = blockCount + 1;
  const successStep = blockCount + 2;

  const isIntro = currentStep === 0;
  const isBlockStep = currentStep >= 1 && currentStep <= blockCount;
  const isCredentials = currentStep === credentialsStep;
  const isSuccess = currentStep === successStep;

  const blockIndex = currentStep - 1;
  const currentBlock = isBlockStep ? blocks[blockIndex] : null;

  // Progress accounts only for answerable blocks + the credentials step.
  const answerableTotal = blocks.filter((b) => b.type !== "welcome").length + 1;
  const answerableThrough = (index: number) =>
    blocks.slice(0, index + 1).filter((b) => b.type !== "welcome").length;

  const showHeader =
    (isBlockStep && currentBlock?.type !== "welcome") || isCredentials;
  const displayStep = isCredentials ? answerableTotal : answerableThrough(blockIndex);

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };
  const goNext = () => setCurrentStep(currentStep + 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header with progress bar */}
        {showHeader && (
          <div className="border-b border-slate-200">
            <div className="px-8 pt-6 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">
                  Step {displayStep} of {answerableTotal}
                </span>
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </button>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6B5CE7] rounded-full transition-all duration-300"
                  style={{ width: `${(displayStep / answerableTotal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-8 py-12 md:px-12 md:py-16">
          {isIntro && (
            <IntroScreen
              title={formData.title}
              creatorName={formData.creator_name}
              creatorCompany={formData.creator_company}
              onContinue={goNext}
            />
          )}

          {isBlockStep && currentBlock && (
            <BlockStepScreen
              key={blockIndex}
              slug={slug}
              blockIndex={blockIndex}
              block={currentBlock}
              value={responses[blockIndex]?.value ?? null}
              onChange={(value) => updateResponse(blockIndex, value)}
              onContinue={goNext}
            />
          )}

          {isCredentials && (
            <CredentialsScreen
              register={register}
              errors={errors}
              submitting={submitting}
              processingMessage={processingMessage}
              onSubmit={handleSubmit(onSubmit)}
            />
          )}

          {isSuccess && <SuccessScreen onDone={() => navigate("/dashboard")} />}
        </div>
      </div>
    </div>
  );
}

// ── Intro ───────────────────────────────────────────────────────────────────
function IntroScreen({
  title,
  creatorName,
  creatorCompany,
  onContinue,
}: {
  title: string;
  creatorName: string;
  creatorCompany: string | null;
  onContinue: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="text-8xl onboard-vibrate inline-block">👋</div>
      <h1 className="text-4xl font-bold text-slate-900 mb-2 onboard-fade-in-delay-1">{title}</h1>
      <p className="text-lg text-slate-600 leading-relaxed onboard-fade-in-delay-2 max-w-md mx-auto">
        by {creatorName}
        {creatorCompany && ` · ${creatorCompany}`}
        <br />
        Let's get you onboarded — it only takes a minute.
      </p>
      <button
        onClick={onContinue}
        className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] transition-colors onboard-fade-in-delay-2"
      >
        Get started
      </button>
    </div>
  );
}

// ── Single form block as a survey step ───────────────────────────────────────
function BlockStepScreen({
  slug,
  blockIndex,
  block,
  value,
  onChange,
  onContinue,
}: {
  slug?: string;
  blockIndex: number;
  block: FormBlock;
  value: BlockResponse["value"];
  onChange: (value: BlockResponse["value"]) => void;
  onContinue: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const answered = isBlockAnswered(block, value);
  const canContinue = (block.required ? answered : true) && !uploading;

  // Welcome block: rich HTML content, no answer collected.
  if (block.type === "welcome") {
    return (
      <div className="onboard-fade-in space-y-8">
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: block.content || "" }}
        />
        <button
          onClick={onContinue}
          className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] transition-colors"
        >
          Continue
        </button>
      </div>
    );
  }

  const isTextual = block.type === "short_answer" || block.type === "long_answer";

  return (
    <div className="onboard-fade-in">
      <h2 className="text-3xl font-bold text-slate-900 mb-2">
        {block.label}
        {block.required && <span className="text-[#6B5CE7] ml-1">*</span>}
      </h2>
      {block.placeholder && !isTextual && (
        <p className="text-slate-600 mb-8">{block.placeholder}</p>
      )}
      <div className={isTextual ? "mt-6" : "mt-8"}>
        <BlockInput
          slug={slug}
          blockIndex={blockIndex}
          block={block}
          value={value}
          onChange={onChange}
          uploading={uploading}
          setUploading={setUploading}
        />
      </div>

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full mt-8 px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

/** Renders the survey-styled input for a single (non-welcome) block. */
function BlockInput({
  slug,
  blockIndex,
  block,
  value,
  onChange,
  uploading,
  setUploading,
}: {
  slug?: string;
  blockIndex: number;
  block: FormBlock;
  value: BlockResponse["value"];
  onChange: (value: BlockResponse["value"]) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  switch (block.type) {
    case "short_answer":
      return (
        <input
          type="text"
          autoFocus
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={block.placeholder || "Your answer..."}
          className="w-full px-6 py-4 rounded-[14px] border-2 border-slate-200 focus:border-[#6B5CE7] focus:outline-none text-slate-900 placeholder-slate-400 transition-colors"
        />
      );

    case "long_answer":
      return (
        <textarea
          autoFocus
          rows={5}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={block.placeholder || "Your answer..."}
          className="w-full px-6 py-4 rounded-[14px] border-2 border-slate-200 focus:border-[#6B5CE7] focus:outline-none text-slate-900 placeholder-slate-400 transition-colors resize-none"
        />
      );

    case "multiple_choice":
      return (
        <div className="space-y-3">
          {(block.options || []).map((option) => {
            const selected = value === option;
            return (
              <button
                key={option}
                onClick={() => onChange(option)}
                className="w-full text-left px-6 py-4 rounded-[14px] border-2 font-medium transition-all onboard-fade-in"
                style={{
                  borderColor: selected ? "#6B5CE7" : "#e2e8f0",
                  backgroundColor: selected ? "#F5F3FF" : "#f8fafc",
                  color: selected ? "#0f172a" : "#475569",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      borderColor: selected ? "#6B5CE7" : "#cbd5e1",
                      backgroundColor: selected ? "#6B5CE7" : "transparent",
                    }}
                  >
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span>{option}</span>
                </div>
              </button>
            );
          })}
        </div>
      );

    case "checkbox": {
      const checked = value === true;
      return (
        <button
          onClick={() => onChange(!checked)}
          className="w-full text-left px-5 py-4 rounded-[14px] border-2 font-medium transition-all flex items-center gap-3"
          style={{
            borderColor: checked ? "#6B5CE7" : "#e2e8f0",
            backgroundColor: checked ? "#F5F3FF" : "#f8fafc",
            color: checked ? "#0f172a" : "#475569",
          }}
        >
          <div
            className="w-5 h-5 rounded-[6px] border-2 flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              borderColor: checked ? "#6B5CE7" : "#cbd5e1",
              backgroundColor: checked ? "#6B5CE7" : "transparent",
            }}
          >
            {checked && <Check className="w-3 h-3 text-white" />}
          </div>
          <span>{block.label || "I agree"}</span>
        </button>
      );
    }

    case "file_upload":
      return (
        <FileUploadInput
          slug={slug}
          blockIndex={blockIndex}
          block={block}
          value={value}
          onChange={onChange}
          onUploadingChange={setUploading}
        />
      );

    default:
      return null;
  }
}

/**
 * Uploads the selected file to the public onboarding upload endpoint and stores
 * the returned file URL as the block's response value.
 */
function FileUploadInput({
  slug,
  blockIndex,
  block,
  value,
  onChange,
  onUploadingChange,
}: {
  slug?: string;
  blockIndex: number;
  block: FormBlock;
  value: BlockResponse["value"];
  onChange: (value: BlockResponse["value"]) => void;
  onUploadingChange: (v: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleFile = async (file: File | undefined) => {
    if (!file || !slug) return;
    setError("");
    setUploading(true);
    onUploadingChange(true);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("block_index", String(blockIndex));

      const response = await publicFetch(`/api/v4/onboard/${slug}/upload/`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onChange(data.url);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data?.error || "Upload failed. Please try again.");
        setFileName(null);
        onChange(null);
      }
    } catch {
      setError("Upload failed. Please try again.");
      setFileName(null);
      onChange(null);
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  };

  const uploaded = typeof value === "string" && value.length > 0;

  return (
    <div className="border-2 border-dashed border-slate-200 rounded-[14px] p-8 text-center">
      <input
        type="file"
        disabled={uploading}
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="max-w-xs mx-auto text-sm text-slate-600 file:mr-4 file:rounded-[100px] file:border-0 file:bg-[#6B5CE7] file:px-4 file:py-2 file:text-white file:font-medium hover:file:bg-[#5A4BD1] disabled:opacity-50"
      />
      {uploading ? (
        <p className="text-sm text-slate-500 mt-3 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading{fileName ? ` ${fileName}` : ""}…
        </p>
      ) : uploaded ? (
        <a
          href={value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#6B5CE7] hover:underline mt-3 inline-flex items-center gap-1 font-medium"
        >
          <Check className="h-4 w-4" />
          {fileName || "File uploaded"}
        </a>
      ) : (
        <p className="text-xs text-slate-400 mt-3">
          {block.placeholder || "Click to browse or drag and drop"}
        </p>
      )}
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}

// ── Credentials ──────────────────────────────────────────────────────────────
function CredentialsScreen({
  register,
  errors,
  submitting,
  processingMessage,
  onSubmit,
}: {
  register: ReturnType<typeof useForm<SignupFormData>>["register"];
  errors: ReturnType<typeof useForm<SignupFormData>>["formState"]["errors"];
  submitting: boolean;
  processingMessage: string;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="onboard-fade-in space-y-6"
    >
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Create your account</h2>
        <p className="text-slate-600">Sign up to submit your responses and access your portal.</p>
      </div>

      <div className="space-y-4">
        <div>
          <input
            {...register("full_name")}
            placeholder="Full name"
            className="w-full px-6 py-4 rounded-[14px] border-2 border-slate-200 focus:border-[#6B5CE7] focus:outline-none text-slate-900 placeholder-slate-400 transition-colors"
          />
          {errors.full_name && (
            <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>
          )}
        </div>
        <div>
          <input
            {...register("email")}
            type="email"
            placeholder="you@example.com"
            className="w-full px-6 py-4 rounded-[14px] border-2 border-slate-200 focus:border-[#6B5CE7] focus:outline-none text-slate-900 placeholder-slate-400 transition-colors"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <input
            {...register("password")}
            type="password"
            placeholder="Password (min. 8 characters)"
            className="w-full px-6 py-4 rounded-[14px] border-2 border-slate-200 focus:border-[#6B5CE7] focus:outline-none text-slate-900 placeholder-slate-400 transition-colors"
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Processing onboarding..." : "Create account"}
      </button>
      {submitting && processingMessage && (
        <p className="text-center text-xs text-slate-500">{processingMessage}</p>
      )}
    </form>
  );
}

// ── Success ──────────────────────────────────────────────────────────────────
function Confetti() {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

  useEffect(() => {
    const colors = ["#6B5CE7", "#EDE9FE", "#C4BBFA", "#5A4BD1", "#F5F3FF"];
    setPieces(
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      }))
    );
  }, []);

  return (
    <>
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="fixed pointer-events-none"
          style={{
            left: `${piece.left}%`,
            top: "-10px",
            width: "8px",
            height: "8px",
            backgroundColor: piece.color,
            borderRadius: "50%",
            animation: `onboardConfettiFall ${2 + Math.random()}s ease-in forwards`,
            animationDelay: `${piece.delay}s`,
            "--tx": `${(Math.random() - 0.5) * 200}px`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

function SuccessScreen({ onDone }: { onDone: () => void }) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const confettiTimer = setTimeout(() => setShowConfetti(false), 6000);
    const redirectTimer = setTimeout(onDone, 2500);
    return () => {
      clearTimeout(confettiTimer);
      clearTimeout(redirectTimer);
    };
  }, [onDone]);

  return (
    <div className="text-center">
      {showConfetti && <Confetti />}
      <div className="mb-6 flex justify-center onboard-fade-in">
        <div className="w-20 h-20 bg-gradient-to-br from-[#EDE9FE] to-[#F5F3FF] rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-10 h-10 text-[#6B5CE7]" />
        </div>
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4 onboard-fade-in-delay-1">
        You're all set 🎉
      </h1>
      <p className="text-lg text-slate-600 leading-relaxed onboard-fade-in-delay-2 max-w-md mx-auto">
        Your responses have been submitted. Redirecting you to your portal…
      </p>
    </div>
  );
}
