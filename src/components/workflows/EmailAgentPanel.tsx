import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileEdit, Mail, AlertTriangle } from "lucide-react";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface EmailDraft {
  subject: string;
  recipient: string;
  body: string;
  risk_identified: string;
}

interface EmailPlan {
  email: EmailDraft | null;
}

const STEPS = ["Scanning document for egregious risks...", "Identifying critical liability...", "Drafting pushback email..."];

interface Props { onBack: () => void; documentName?: string; documentText?: string; }

export function EmailAgentPanel({ onBack, documentName, documentText }: Props) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<EmailPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setLoading(true); setPlan(null); setError(null); setStep(0);
    const iv = setInterval(() => setStep(p => Math.min(p + 1, STEPS.length - 1)), 2500);
    const wf = WORKFLOW_PROMPTS["email-agent"];
    const txt = documentText || `Document: ${documentName || "Uploaded legal document"}`;
    runWorkflow(wf.systemPrompt, wf.userTemplate(txt), undefined, wf.jsonMode)
      .then(r => {
        try {
          const parsed = JSON.parse(r);
          setPlan({
            email: parsed.email || null,
          });
        } catch { setError("Failed to parse email drafting response."); }
        setLoading(false);
      })
      .catch(e => { console.error("Email agent failed:", e); setError("Unable to draft email. Please try again."); setLoading(false); })
      .finally(() => clearInterval(iv));
    return () => clearInterval(iv);
  }, [documentName, documentText]);

  const handleSendEmail = () => {
    if (!plan?.email) return;
    const { recipient, subject, body } = plan.email;
    const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-rose-500" />Legal Outreach Drafter
          </h1>
          {documentName && <p className="text-xs text-muted-foreground">Reviewing: {documentName}</p>}
        </div>
      </div>

      {loading ? (
        <div className="border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
            <Loader2 className="h-4 w-4 animate-spin" />Agent is acting...
          </div>
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-500 ${i <= step ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground opacity-40"}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${i < step ? "bg-emerald-500" : i === step ? "bg-rose-500 animate-pulse" : "bg-muted-foreground"}`} />{s}
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-8">{error}</div>
      ) : plan?.email ? (
        <div className="space-y-6 pt-4">
          <div className="border border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-900/20 rounded-lg p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-rose-800 dark:text-rose-200">Critical Risk Identified</h3>
              <p className="text-sm text-rose-700/80 dark:text-rose-300/80">{plan.email.risk_identified}</p>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden flex flex-col shadow-sm">
            <div className="bg-muted/50 border-b border-border p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium min-w-10 text-muted-foreground">To:</span>
                <span>{plan.email.recipient}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium min-w-10 text-muted-foreground">Subject:</span>
                <span className="font-medium">{plan.email.subject}</span>
              </div>
            </div>
            
            <div className="p-6 bg-card text-sm whitespace-pre-wrap leading-relaxed">
              {plan.email.body}
            </div>

            <div className="bg-muted/30 border-t border-border p-4 flex justify-end">
              <Button onClick={handleSendEmail} className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
                <Mail className="h-4 w-4" /> Open in Mail Client
              </Button>
            </div>
          </div>
        </div>
      ) : (
         <div className="text-sm text-muted-foreground py-8">No critical risks requiring an email were found.</div>
      )}
    </div>
  );
}
