import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Brain, FileText, Hammer, Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface ConflictResolverPanelProps {
  onBack: () => void;
  documentName?: string;
  documentText?: string;
}

const THINKING_STEPS = [
  "Step 1: Identifying internal contradictions...",
  "Step 2: Analyzing risk of each ambiguity...",
  "Step 3: Summarizing findings...",
];

const ACTION_SEPARATOR = "===ACTION===";

export function ConflictResolverPanel({ onBack, documentName, documentText }: ConflictResolverPanelProps) {
  const [loading, setLoading] = useState(true);
  const [analysisContent, setAnalysisContent] = useState("");
  const [actionContent, setActionContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [activeTab, setActiveTab] = useState<"analysis" | "action">("analysis");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setAnalysisContent("");
    setActionContent("");
    setError(null);
    setThinkingStep(0);

    const stepInterval = setInterval(() => {
      setThinkingStep((prev) => (prev < THINKING_STEPS.length - 1 ? prev + 1 : prev));
    }, 4000);

    const workflow = WORKFLOW_PROMPTS["conflict-resolver"];
    const docText = documentText || `Document: ${documentName || "Uploaded legal document"}`;

    runWorkflow(workflow.systemPrompt, workflow.userTemplate(docText))
      .then((result) => {
        const parts = result.split(ACTION_SEPARATOR);
        setAnalysisContent(parts[0]?.trim() || result);
        setActionContent(parts[1]?.trim() || "No amendment was generated.");
        setLoading(false);
      })
      .catch((err) => {
        console.error("Conflict resolution failed:", err);
        setError("Unable to generate precise answer at this time. Please try again.");
        setLoading(false);
      })
      .finally(() => clearInterval(stepInterval));

    return () => clearInterval(stepInterval);
  }, [documentName]);

  function handleCopy() {
    navigator.clipboard.writeText(actionContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            Multi-Step Conflict Resolver
          </h1>
          {documentName && (
            <p className="text-xs text-muted-foreground">Analyzing: {documentName}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reasoning...
            </div>
            <div className="space-y-2">
              {THINKING_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-xs transition-all duration-500 ${
                    i <= thinkingStep
                      ? "text-violet-600 dark:text-violet-400 opacity-100"
                      : "text-muted-foreground opacity-40"
                  }`}
                >
                  <div className={`h-1.5 w-1.5 rounded-full ${
                    i < thinkingStep ? "bg-emerald-500"
                      : i === thinkingStep ? "bg-violet-500 animate-pulse"
                      : "bg-muted-foreground"
                  }`} />
                  {step}
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-8">{error}</div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("analysis")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "analysis"
                  ? "border-violet-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Analysis
            </button>
            <button
              onClick={() => setActiveTab("action")}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "action"
                  ? "border-violet-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Hammer className="h-3.5 w-3.5" />
              Suggested Amendment
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "analysis" ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{analysisContent}</ReactMarkdown>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copied ? "Copied" : "Copy Amendment"}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert border border-border rounded-lg p-5 bg-muted/30">
                <ReactMarkdown>{actionContent}</ReactMarkdown>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
