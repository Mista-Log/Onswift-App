import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { saveInviteState } from "@/lib/inviteUtils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface InviteDetail {
  id: string;
  project_name: string;
  creator_name: string;
  client_email: string;
  onboarding_form: {
    questions: Question[];
  };
  expires_at: string;
}

interface Question {
  id: string;
  type: "text" | "textarea" | "email" | "date" | "select";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface FormResponses {
  [key: string]: string | number | boolean;
}

const InviteAccept = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invite, setInvite] = useState<InviteDetail | null>(null);
  const [responses, setResponses] = useState<FormResponses>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError("Invalid invite link");
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/v5/invites/${token}/`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          if (response.status === 410) {
            setError("This invite has expired");
          } else if (response.status === 400) {
            setError("This invite has already been accepted");
          } else if (response.status === 404) {
            setError("Invite not found");
          } else {
            setError("Failed to load invite");
          }
          return;
        }

        const data = await response.json();
        setInvite(data);

        // Initialize responses object with empty values for each question
        const initialResponses: FormResponses = {};
        data.onboarding_form.questions?.forEach((q: Question) => {
          initialResponses[q.id] = "";
        });
        setResponses(initialResponses);
      } catch (err) {
        console.error("Error fetching invite:", err);
        setError("Failed to load invite");
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleInputChange = (questionId: string, value: string | number | boolean) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Invalid invite link");
      return;
    }

    // Validate required fields
    if (invite?.onboarding_form.questions) {
      for (const q of invite.onboarding_form.questions) {
        if (q.required && !responses[q.id]) {
          toast({
            title: "Missing required field",
            description: `Please fill in: ${q.label}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE_URL}/api/v5/invites/${token}/accept/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });

      if (!response.ok) {
        if (response.status === 410) {
          setError("This invite has expired");
        } else if (response.status === 400) {
          setError("This invite has already been accepted");
        } else {
          const data = await response.json();
          setError(data.error || "Failed to accept invite");
        }
        return;
      }

      const data = await response.json();

      toast({
        title: "Success!",
        description: "Your information has been submitted.",
      });

      // Save invite state for post-signup use
      if (invite) {
        saveInviteState({
          inviteToken: token,
          clientEmail: invite.client_email,
          projectName: invite.project_name,
          creatorName: invite.creator_name,
          responses,
        });
      }

      // Handle different response actions
      if (data.action === "signup") {
        // New client - redirect to signup with email pre-filled
        // SignUp component will detect the invite and handle accordingly
        navigate("/signup", {
          state: {
            prefilledEmail: invite?.client_email,
            inviteToken: token,
            role: "client",
            inviteProject: invite?.project_name,
          },
        });
      } else if (data.action === "redirect") {
        // Existing client - redirect to project portal
        navigate(`/portal/${data.project_id}`);
      }
    } catch (err) {
      console.error("Error accepting invite:", err);
      setError("Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-slate-300 rounded mb-4"></div>
          <div className="h-4 w-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invite Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{invite.project_name}</CardTitle>
            <CardDescription>
              Invited by {invite.creator_name}
            </CardDescription>
            <p className="text-sm text-slate-500 mt-2">
              Please complete this form to get started on your project.
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {invite.onboarding_form.questions?.map((question) => (
                <div key={question.id} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    {question.label}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {question.type === "text" && (
                    <Input
                      type="text"
                      placeholder={question.placeholder}
                      value={responses[question.id] as string}
                      onChange={(e) => handleInputChange(question.id, e.target.value)}
                      required={question.required}
                    />
                  )}

                  {question.type === "email" && (
                    <Input
                      type="email"
                      placeholder={question.placeholder}
                      value={responses[question.id] as string}
                      onChange={(e) => handleInputChange(question.id, e.target.value)}
                      required={question.required}
                    />
                  )}

                  {question.type === "date" && (
                    <Input
                      type="date"
                      value={responses[question.id] as string}
                      onChange={(e) => handleInputChange(question.id, e.target.value)}
                      required={question.required}
                    />
                  )}

                  {question.type === "textarea" && (
                    <Textarea
                      placeholder={question.placeholder}
                      value={responses[question.id] as string}
                      onChange={(e) => handleInputChange(question.id, e.target.value)}
                      required={question.required}
                      rows={4}
                    />
                  )}

                  {question.type === "select" && (
                    <Select
                      value={responses[question.id] as string}
                      onValueChange={(value) => handleInputChange(question.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option..." />
                      </SelectTrigger>
                      <SelectContent>
                        {question.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}

              <Button type="submit" className="w-full" disabled={submitting} size="lg">
                {submitting ? "Submitting..." : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500 text-center mt-6">
          This invite expires on {new Date(invite.expires_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default InviteAccept;
