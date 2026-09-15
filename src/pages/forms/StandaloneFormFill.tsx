/**
 * StandaloneFormFill — Public page where anyone fills out a standalone form.
 * Self-contained copy of ClientOnboard's survey UI (intro → one block per
 * step → success), adapted to skip account creation entirely: responses are
 * submitted anonymously, and any number of people can fill the same form.
 * Kept separate from ClientOnboard.tsx rather than sharing code, since that
 * file is part of the client-onboarding flow this feature must not touch.
 */
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { publicFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { FIXED_PROCESSING_MESSAGE, runWithFixedProcessingDelay } from "@/lib/loadingGate";
import { uploadErrorMessage } from "@/lib/uploadError";
import { sanitize } from "isomorphic-dompurify";

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Lock, ChevronLeft, Check, Loader2 } from "lucide-react";
import type { StandaloneFormPublicData, FormBlock, BlockResponse } from "@/types/standaloneForm";

// Survey animation keyframes (self-contained copy — distinct id/class prefix
// from ClientOnboard.tsx's so the two pages never share state).
const animationStyles = `
  @keyframes sformFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes sformFadeInDelay1 {
    0% { opacity: 0; transform: translateY(10px); }
    50% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes sformFadeInDelay2 {
    0% { opacity: 0; transform: translateY(10px); }
    60% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes sformVibrate {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    20% { transform: translate(1px, -2px) rotate(1deg); }
    40% { transform: translate(1px, 1px) rotate(1deg); }
    60% { transform: translate(1px, 0px) rotate(1deg); }
    80% { transform: translate(1px, -1px) rotate(1deg); }
  }
  @keyframes sformConfettiFall {
    to { transform: translate(var(--tx), 100vh) rotate(720deg); opacity: 0; }
  }
  .sform-fade-in { animation: sformFadeIn 0.6s ease-out; }
  .sform-fade-in-delay-1 { animation: sformFadeInDelay1 0.8s ease-out; }
  .sform-fade-in-delay-2 { animation: sformFadeInDelay2 1s ease-out; }
  .sform-vibrate { animation: sformVibrate 0.8s ease-in-out 1; }
`;

if (typeof document !== "undefined" && !document.getElementById("standalone-form-survey-styles")) {
  const style = document.createElement("style");
  style.id = "standalone-form-survey-styles";
  style.textContent = animationStyles;
  document.head.appendChild(style);
}

/** True when a required block still has no usable answer. */
function isBlockAnswered(block: FormBlock, value: BlockResponse["value"]): boolean {
  if (block.type === "welcome") return true;
  if (block.type === "checkbox") return value === true;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

/** Escape respondent-typed text before it re-enters welcome HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replace @field reference pills in welcome HTML with the respondent's answers. */
function resolveMentions(html: string, blocks: FormBlock[], responses: BlockResponse[]): string {
  return html.replace(
    /<span[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*>(.*?)<\/span>/g,
    (_match, id: string, inner: string) => {
      const blockIndex = blocks.findIndex((b) => b.id === id);
      const value = blockIndex >= 0 ? responses[blockIndex]?.value : undefined;
      let text: string;
      if (typeof value === "string" && value.trim()) text = value;
      else if (Array.isArray(value) && value.length > 0) text = value.join(", ");
      else if (typeof value === "boolean") text = value ? "Yes" : "No";
      else text = blocks[blockIndex]?.label || inner.replace(/^@/, "");
      return escapeHtml(text);
    },
  );
}

export default function StandaloneFormFill() {
  const { slug } = useParams<{ slug: string }>();

  const [formData, setFormData] = useState<StandaloneFormPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ type: string; message: string } | null>(null);
  const [responses, setResponses] = useState<BlockResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    loadForm();
  }, [slug]);

  const loadForm = async (attempt = 0) => {
    try {
      const response = await publicFetch(`/api/v4/f/${slug}/`);
      if (response.ok) {
        const data: StandaloneFormPublicData = await response.json();
        setFormData(data);
        setResponses(data.blocks.map((_, index) => ({ block_index: index, value: null })));
        if (!data.is_open) {
          setErrorState({ type: "closed", message: "This form is no longer accepting responses." });
        }
      } else if (response.status === 404) {
        setErrorState({ type: "not_found", message: "Form not found." });
      } else if (attempt < 2) {
        setTimeout(() => loadForm(attempt + 1), 1200);
        return;
      } else {
        setErrorState({ type: "not_found", message: "Form not found." });
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

  const submitResponses = async () => {
    if (!formData) return;

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
      const response = await runWithFixedProcessingDelay(
        publicFetch(`/api/v4/f/${slug}/submit/`, {
          method: "POST",
          body: JSON.stringify({ responses }),
        })
      );

      if (response.ok) {
        setCurrentStep(formData.blocks.length + 1);
      } else if (response.status === 429) {
        toast.error("Too many submissions right now — please try again later.");
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error?.error || "Failed to submit form");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setProcessingMessage("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (errorState) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            {errorState.type === "closed" ? (
              <Lock className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            ) : (
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            )}
            <h2 className="text-xl font-semibold mb-2">
              {errorState.type === "closed" ? "No Longer Accepting Responses" : "Form Not Found"}
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
  const successStep = blockCount + 1;

  const isIntro = currentStep === 0;
  const isBlockStep = currentStep >= 1 && currentStep <= blockCount;
  const isSuccess = currentStep === successStep;

  const blockIndex = currentStep - 1;
  const currentBlock = isBlockStep ? blocks[blockIndex] : null;
  const isLastBlock = blockIndex === blockCount - 1;

  // Progress accounts only for answerable blocks.
  const answerableTotal = Math.max(blocks.filter((b) => b.type !== "welcome").length, 1);
  const answerableThrough = (index: number) =>
    blocks.slice(0, index + 1).filter((b) => b.type !== "welcome").length;

  const showHeader = isBlockStep && currentBlock?.type !== "welcome";
  const displayStep = answerableThrough(blockIndex);

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };
  const goNext = () => setCurrentStep(currentStep + 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
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

        <div className="px-8 py-12 md:px-12 md:py-16">
          {isIntro && (
            <IntroScreen title={formData.title} creatorName={formData.creator_name} onContinue={goNext} />
          )}

          {isBlockStep && currentBlock && (
            <BlockStepScreen
              key={blockIndex}
              slug={slug}
              blockIndex={blockIndex}
              block={currentBlock}
              allBlocks={formData.blocks}
              responses={responses}
              value={responses[blockIndex]?.value ?? null}
              onChange={(value) => updateResponse(blockIndex, value)}
              onContinue={isLastBlock ? submitResponses : goNext}
              submitting={submitting}
              processingMessage={processingMessage}
              isLastBlock={isLastBlock}
            />
          )}

          {isSuccess && <SuccessScreen />}
        </div>
      </div>
    </div>
  );
}

// ── Intro ───────────────────────────────────────────────────────────────────
function IntroScreen({
  title,
  creatorName,
  onContinue,
}: {
  title: string;
  creatorName: string;
  onContinue: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="text-8xl sform-vibrate inline-block">📝</div>
      <h1 className="text-4xl font-bold text-slate-900 mb-2 sform-fade-in-delay-1">{title}</h1>
      <p className="text-lg text-slate-600 leading-relaxed sform-fade-in-delay-2 max-w-md mx-auto">
        by {creatorName}
        <br />
        It only takes a minute.
      </p>
      <button
        onClick={onContinue}
        className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] transition-colors sform-fade-in-delay-2"
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
  allBlocks,
  responses,
  value,
  onChange,
  onContinue,
  submitting,
  processingMessage,
  isLastBlock,
}: {
  slug?: string;
  blockIndex: number;
  block: FormBlock;
  allBlocks: FormBlock[];
  responses: BlockResponse[];
  value: BlockResponse["value"];
  onChange: (value: BlockResponse["value"]) => void;
  onContinue: () => void;
  submitting: boolean;
  processingMessage: string;
  isLastBlock: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const answered = isBlockAnswered(block, value);
  const canContinue = (block.required ? answered : true) && !uploading && !submitting;

  const handleEnterAdvance = () => {
    if (canContinue) onContinue();
  };

  if (block.type === "welcome") {
    return (
      <div className="sform-fade-in space-y-8">
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{
            __html: sanitize(resolveMentions(block.content || "", allBlocks, responses)),
          }}
        />
        <button
          onClick={onContinue}
          disabled={submitting}
          className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] disabled:opacity-50 transition-colors"
        >
          {isLastBlock ? (submitting ? "Submitting..." : "Submit") : "Continue"}
        </button>
      </div>
    );
  }

  const isTextual = block.type === "short_answer" || block.type === "long_answer";

  return (
    <div className="sform-fade-in">
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
          onEnterAdvance={handleEnterAdvance}
        />
      </div>

      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full mt-8 px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLastBlock ? (submitting ? "Submitting..." : "Submit") : "Continue"}
      </button>
      {isLastBlock && submitting && processingMessage && (
        <p className="text-center text-xs text-slate-500 mt-3">{processingMessage}</p>
      )}
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
  onEnterAdvance,
}: {
  slug?: string;
  blockIndex: number;
  block: FormBlock;
  value: BlockResponse["value"];
  onChange: (value: BlockResponse["value"]) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  onEnterAdvance: () => void;
}) {
  switch (block.type) {
    case "short_answer":
      return (
        <input
          type="text"
          autoFocus
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnterAdvance();
            }
          }}
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onEnterAdvance();
            }
          }}
          placeholder={block.placeholder || "Your answer... (Shift+Enter for a new line)"}
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
                className="w-full text-left px-6 py-4 rounded-[14px] border-2 font-medium transition-all sform-fade-in"
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
 * Uploads the selected file to the public standalone-form upload endpoint and
 * stores the returned file URL as the block's response value.
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

      const response = await publicFetch(`/api/v4/f/${slug}/upload/`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onChange(data.url);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(uploadErrorMessage(response.status, undefined, data?.error || "Upload failed. Please try again."));
        setFileName(null);
        onChange(null);
      }
    } catch (err) {
      setError(uploadErrorMessage(undefined, err, "Upload failed. Please try again."));
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
            animation: `sformConfettiFall ${2 + Math.random()}s ease-in forwards`,
            animationDelay: `${piece.delay}s`,
            "--tx": `${(Math.random() - 0.5) * 200}px`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

function SuccessScreen() {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="text-center">
      {showConfetti && <Confetti />}
      <div className="mb-6 flex justify-center sform-fade-in">
        <div className="w-20 h-20 bg-gradient-to-br from-[#EDE9FE] to-[#F5F3FF] rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-10 h-10 text-[#6B5CE7]" />
        </div>
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4 sform-fade-in-delay-1">
        Thanks! 🎉
      </h1>
      <p className="text-lg text-slate-600 leading-relaxed sform-fade-in-delay-2 max-w-md mx-auto">
        Your response has been submitted.
      </p>
    </div>
  );
}
