import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Swords, FileText, Mail, Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface Props {
  onBack: () => void;
  documentName?: string;
  documentText?: string;
}

const STEPS = [
  "Scanning for vulnerabilities...",
  "Constructing attack vectors...",
  "Drafting defensive redlines...",
  "Composing rebuttal email...",
];

const SEP = "===ACTION===";

export function DevilsAdvocatePanel({ onBack, documentName, documentText }: Props) {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"analysis" | "action">("analysis");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true); setAnalysis(""); setAction(""); setError(null); setStep(0);
    const iv = setInterval(() => setStep(p => Math.min(p + 1, STEPS.length - 1)), 3500);
    const wf = WORKFLOW_PROMPTS["devils-advocate"];
    const txt = documentText || `Document: ${documentName || "Uploaded legal document"}`;
    runWorkflow(wf.systemPrompt, wf.userTemplate(txt))
      .then(r => { const p = r.split(SEP); setAnalysis(p[0]?.trim() || r); setAction(p[1]?.trim() || "No rebuttal email generated."); setLoading(false); })
      .catch(e => { console.error("Devil's advocate failed:", e); setError("Unable to generate precise answer. Please try again."); setLoading(false); })
      .finally(() => clearInterval(iv));
    return () => clearInterval(iv);
  }, [documentName]);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Swords className="h-5 w-5 text-red-500" />The Devil's Advocate Agent
          </h1>
          {documentName && <p className="text-xs text-muted-foreground">Attacking: {documentName}</p>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <Loader2 className="h-4 w-4 animate-spin" />Opposing Counsel is analyzing...
            </div>
            <div className="space-y-2">
              {STEPS.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-500 ${i <= step ? "text-red-600 dark:text-red-400" : "text-muted-foreground opacity-40"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${i < step ? "bg-emerald-500" : i === step ? "bg-red-500 animate-pulse" : "bg-muted-foreground"}`} />{s}
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-8">{error}</div>
      ) : (
        <>
          <div className="flex border-b border-border">
            <button onClick={() => setTab("analysis")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "analysis" ? "border-red-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <FileText className="h-3.5 w-3.5" />Analysis
            </button>
            <button onClick={() => setTab("action")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "action" ? "border-red-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Mail className="h-3.5 w-3.5" />Rebuttal Email
            </button>
          </div>
          {tab === "analysis" ? (
            <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{analysis}</ReactMarkdown></div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(action); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                  {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}{copied ? "Copied" : "Copy Email"}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert border border-border rounded-lg p-5 bg-muted/30">
                <ReactMarkdown>{action}</ReactMarkdown>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
