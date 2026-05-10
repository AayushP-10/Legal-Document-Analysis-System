import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface DraftDrawerProps {
  open: boolean;
  onClose: () => void;
  documentName?: string;
  filePath?: string;
  documentText?: string;
}

export function DraftDrawer({ open, onClose, documentName, filePath, documentText }: DraftDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setContent("");
      setError(null);

      const workflow = WORKFLOW_PROMPTS["draft-client-alert"];
      const docText = documentText || `Document: ${documentName || "Uploaded legal document"}`;

      runWorkflow(workflow.systemPrompt, workflow.userTemplate(docText), filePath ? [filePath] : undefined)
        .then((result) => {
          setContent(result);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Draft generation failed:", err);
          setError("Unable to generate precise answer at this time. Please try again.");
          setLoading(false);
        });
    }
  }, [open, documentName]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-lg">Document Drafter</SheetTitle>
          {documentName && (
            <p className="text-xs text-muted-foreground">Based on: {documentName}</p>
          )}
        </SheetHeader>

        <div className="mt-6">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
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
            <div className="text-sm text-destructive">{error}</div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
