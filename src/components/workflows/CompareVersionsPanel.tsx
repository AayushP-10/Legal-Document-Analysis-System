import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileText, Loader2, Plus, Minus, RefreshCw } from "lucide-react";
import { runWorkflow } from "@/services/legalAI";
import { extractPdfText } from "@/services/huggingFaceService";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface AddedOrRemoved {
  clause: string;
  details: string;
}

interface ChangedItem {
  clause: string;
  original: string;
  revised: string;
  impact: string;
}

interface ComparisonResult {
  added: AddedOrRemoved[];
  removed: AddedOrRemoved[];
  changed: ChangedItem[];
}

interface CompareVersionsPanelProps {
  onBack: () => void;
}

export function CompareVersionsPanel({ onBack }: CompareVersionsPanelProps) {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileDrop(setter: (f: File) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setter(file);
    };
  }

  async function runComparison() {
    if (!originalFile || !newFile) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      setLoadingMessage("Extracting text from original document...");
      const originalText = await extractPdfText(originalFile);

      setLoadingMessage("Extracting text from revised document...");
      const newText = await extractPdfText(newFile);

      // Truncate each to fit context window
      const maxPerDoc = 3000;
      const truncOriginal = originalText.length > maxPerDoc
        ? originalText.slice(0, maxPerDoc) + "\n\n[...Text Truncated]"
        : originalText;
      const truncNew = newText.length > maxPerDoc
        ? newText.slice(0, maxPerDoc) + "\n\n[...Text Truncated]"
        : newText;

      setLoadingMessage("Comparing versions...");
      const workflow = WORKFLOW_PROMPTS["compare-versions"];
      const userPrompt = workflow.userTemplate(truncOriginal, truncNew);
      const response = await runWorkflow(workflow.systemPrompt, userPrompt, undefined, workflow.jsonMode);

      const parsed = JSON.parse(response);
      setResult({
        added: Array.isArray(parsed.added) ? parsed.added : [],
        removed: Array.isArray(parsed.removed) ? parsed.removed : [],
        changed: Array.isArray(parsed.changed) ? parsed.changed : [],
      });
    } catch (err) {
      console.error("Version comparison failed:", err);
      setError("Unable to generate precise answer at this time. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  // Upload UI
  if (!result && !loading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Compare Contract Versions</h1>
            <p className="text-xs text-muted-foreground">Upload two document versions to compare</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Original document */}
          <label className="cursor-pointer group">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-3 hover:border-primary/50 hover:bg-accent/50 transition-all">
              {originalFile ? (
                <>
                  <FileText className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-sm font-medium truncate">{originalFile.name}</p>
                  <Badge variant="secondary">Original</Badge>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="text-sm font-medium">Upload Original</p>
                  <p className="text-xs text-muted-foreground">The base version of the contract</p>
                </>
              )}
            </div>
            <input type="file" accept=".pdf" className="hidden" onChange={handleFileDrop(setOriginalFile)} />
          </label>

          {/* New document */}
          <label className="cursor-pointer group">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-3 hover:border-primary/50 hover:bg-accent/50 transition-all">
              {newFile ? (
                <>
                  <FileText className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-sm font-medium truncate">{newFile.name}</p>
                  <Badge variant="secondary">Revised</Badge>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="text-sm font-medium">Upload Revised</p>
                  <p className="text-xs text-muted-foreground">The new or revised version</p>
                </>
              )}
            </div>
            <input type="file" accept=".pdf" className="hidden" onChange={handleFileDrop(setNewFile)} />
          </label>
        </div>

        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        <Button
          className="w-full"
          disabled={!originalFile || !newFile}
          onClick={runComparison}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Compare Documents
        </Button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Compare Contract Versions</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm font-medium">{loadingMessage || "Comparing Versions..."}</p>
          <p className="text-xs">This may take a moment for longer documents</p>
        </div>
      </div>
    );
  }

  // Results screen
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => { setResult(null); setOriginalFile(null); setNewFile(null); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Comparison Results</h1>
          <p className="text-xs text-muted-foreground">
            {originalFile?.name} → {newFile?.name}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
          + {result?.added.length || 0} Added
        </Badge>
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          − {result?.removed.length || 0} Removed
        </Badge>
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          ≠ {result?.changed.length || 0} Changed
        </Badge>
      </div>

      {/* Added Clauses */}
      {result && result.added.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            Added Clauses
          </h2>
          {result.added.map((item, i) => (
            <div key={i} className="border-l-4 border-emerald-500 rounded-lg border border-border p-4 space-y-1">
              <p className="text-sm font-medium">{item.clause}</p>
              <p className="text-sm text-muted-foreground">{item.details}</p>
            </div>
          ))}
        </div>
      )}

      {/* Removed Clauses */}
      {result && result.removed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Minus className="h-4 w-4 text-red-600" />
            Removed Clauses
          </h2>
          {result.removed.map((item, i) => (
            <div key={i} className="border-l-4 border-red-500 rounded-lg border border-border p-4 space-y-1">
              <p className="text-sm font-medium">{item.clause}</p>
              <p className="text-sm text-muted-foreground">{item.details}</p>
            </div>
          ))}
        </div>
      )}

      {/* Changed Obligations */}
      {result && result.changed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-blue-600" />
            Changed Obligations
          </h2>
          {result.changed.map((item, i) => (
            <div key={i} className="border-l-4 border-blue-500 rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium">{item.clause}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-red-50 dark:bg-red-950/30 rounded p-2">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Original</p>
                  <p className="text-muted-foreground">{item.original}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Revised</p>
                  <p className="text-muted-foreground">{item.revised}</p>
                </div>
              </div>
              <div className="bg-muted rounded-md p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Impact</p>
                <p className="text-sm text-foreground mt-1">{item.impact}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {result && result.added.length === 0 && result.removed.length === 0 && result.changed.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <p>No material differences were identified between the two versions.</p>
        </div>
      )}
    </div>
  );
}
