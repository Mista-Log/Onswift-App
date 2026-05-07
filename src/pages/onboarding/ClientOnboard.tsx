/**
 * ClientOnboard — Public page where clients view and complete the onboarding form.
 * Handles signup + form submission in one flow.
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BlockRenderer } from "@/components/onboarding/BlockRenderer";
import { AlertCircle, Clock, CheckCircle2, Loader2 } from "lucide-react";
import type { OnboardingPublicData, BlockResponse } from "@/types/onboarding";

const signupSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormData = z.infer<typeof signupSchema>;

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

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    loadForm();
  }, [slug]);

  const loadForm = async () => {
    try {
      const response = await publicFetch(`/api/v4/onboard/${slug}/`);
      if (response.ok) {
        const data: OnboardingPublicData = await response.json();
        setFormData(data);
        // Initialize responses array
        setResponses(
          data.blocks.map((_, index) => ({ block_index: index, value: null }))
        );
      } else if (response.status === 410) {
        setErrorState({ type: "expired", message: "This onboarding link has expired." });
      } else if (response.status === 409) {
        setErrorState({ type: "completed", message: "This onboarding form has already been completed." });
      } else {
        setErrorState({ type: "not_found", message: "Onboarding link not found." });
      }
    } catch (error) {
      setErrorState({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
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

        // Redirect to portal
        navigate("/portal");
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{formData.title}</h1>
          <p className="text-muted-foreground">
            by {formData.creator_name}
            {formData.creator_company && ` · ${formData.creator_company}`}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Form blocks */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              {formData.blocks.map((block, index) => (
                <BlockRenderer
                  key={index}
                  block={block}
                  index={index}
                  value={responses[index]?.value ?? null}
                  onChange={(value) => updateResponse(index, value)}
                />
              ))}
            </CardContent>
          </Card>

          <Separator />

          {/* Signup section */}
          <Card>
            <CardHeader>
              <CardTitle>Create Your Account</CardTitle>
              <CardDescription>
                Sign up to submit your responses and access your client portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input {...register("full_name")} placeholder="John Doe" />
                {errors.full_name && (
                  <p className="text-sm text-destructive mt-1">{errors.full_name.message}</p>
                )}
              </div>
              <div>
                <Label>Email</Label>
                <Input {...register("email")} type="email" placeholder="john@example.com" />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Label>Password</Label>
                <Input {...register("password")} type="password" placeholder="Min. 8 characters" />
                {errors.password && (
                  <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing onboarding...
              </>
            ) : (
              "Submit & Create Account"
            )}
          </Button>
          {submitting && (
            <p className="text-center text-xs text-muted-foreground">{processingMessage}</p>
          )}
        </form>
      </div>
    </div>
  );
}
