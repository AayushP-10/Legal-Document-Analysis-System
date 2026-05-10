import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface ObligationsPanelProps {
  onBack: () => void;
  documentName?: string;
  documentText?: string;
}

export function ObligationsPanel({ onBack, documentName, documentText }: ObligationsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setContent("");
    setError(null);

    const workflow = WORKFLOW_PROMPTS["summarize-obligations"];
    const docText = documentText || `Document: ${documentName || "Uploaded legal document"}`;

    runWorkflow(workflow.systemPrompt, workflow.userTemplate(docText))
      .then((result) => {
        setContent(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Obligations extraction failed:", err);
        setError("Unable to generate precise answer at this time. Please try again.");
        setLoading(false);
      });
  }, [documentName]);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Summarize Obligations
          </h1>
          {documentName && (
            <p className="text-xs text-muted-foreground">Extracted from: {documentName}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating precise answer...
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-6 w-1/2 mt-4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-8">{error}</div>
      ) : (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
