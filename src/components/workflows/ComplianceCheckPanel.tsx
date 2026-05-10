import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Scale } from "lucide-react";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface ComplianceFinding {
  requirement: string;
  status: "Compliant" | "Partially Compliant" | "Non-Compliant";
  section: string;
  details: string;
  recommendation: string;
}

const statusConfig = {
  Compliant: { color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", icon: ShieldCheck },
  "Partially Compliant": { color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: ShieldQuestion },
  "Non-Compliant": { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: ShieldAlert },
};

const FRAMEWORKS = ["GDPR", "HIPAA", "CCPA", "SOX", "PCI-DSS"] as const;

interface ComplianceCheckPanelProps {
  onBack: () => void;
  documentName?: string;
  documentText?: string;
}

export function ComplianceCheckPanel({ onBack, documentName, documentText }: ComplianceCheckPanelProps) {
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<ComplianceFinding[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFramework || !documentText) return;

    setLoading(true);
    setFindings([]);
    setError(null);

    const workflow = WORKFLOW_PROMPTS["regulatory-compliance"];
    const truncated = documentText.length > 6000 ? documentText.slice(0, 6000) + "\n\n[...Text Truncated]" : documentText;
    const userPrompt = workflow.userTemplate(truncated, selectedFramework);

    runWorkflow(workflow.systemPrompt, userPrompt, undefined, workflow.jsonMode)
      .then((result) => {
        try {
          const parsed = JSON.parse(result);
          const arr = parsed.findings || parsed;
          setFindings(Array.isArray(arr) ? arr : []);
        } catch {
          setError("Failed to parse compliance analysis response.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Compliance check failed:", err);
        setError("Unable to generate precise answer at this time. Please try again.");
        setLoading(false);
      });
  }, [selectedFramework]);

  // Framework selection screen
  if (!selectedFramework) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Regulatory Compliance Check</h1>
            {documentName && (
              <p className="text-xs text-muted-foreground">Analyzing: {documentName}</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select a regulatory framework to assess this document against:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FRAMEWORKS.map((fw) => (
              <button
                key={fw}
                className="flex items-center gap-3 rounded-lg border border-border p-4 text-left hover:bg-accent hover:shadow-sm transition-all"
                onClick={() => setSelectedFramework(fw)}
              >
                <Scale className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">{fw}</p>
                  <p className="text-xs text-muted-foreground">
                    {fw === "GDPR" && "EU General Data Protection Regulation"}
                    {fw === "HIPAA" && "Health Insurance Portability & Accountability"}
                    {fw === "CCPA" && "California Consumer Privacy Act"}
                    {fw === "SOX" && "Sarbanes-Oxley Act"}
                    {fw === "PCI-DSS" && "Payment Card Industry Data Security Standard"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Results screen
  const compliantCount = findings.filter((f) => f.status === "Compliant").length;
  const partialCount = findings.filter((f) => f.status === "Partially Compliant").length;
  const nonCompliantCount = findings.filter((f) => f.status === "Non-Compliant").length;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSelectedFramework(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{selectedFramework} Compliance</h1>
          {documentName && (
            <p className="text-xs text-muted-foreground">Analyzing: {documentName}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Generating precise answer...
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-8">{error}</div>
      ) : (
        <>
          {/* Summary badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              ✓ {compliantCount} Compliant
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              ◐ {partialCount} Partial
            </Badge>
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              ✗ {nonCompliantCount} Non-Compliant
            </Badge>
          </div>

          {/* Findings list */}
          <div className="space-y-3">
            {findings.map((finding, i) => {
              const status = Object.keys(statusConfig).includes(finding.status)
                ? finding.status
                : "Partially Compliant";
              const config = statusConfig[status as keyof typeof statusConfig];
              const Icon = config.icon;

              return (
                <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">{finding.requirement}</span>
                    </div>
                    <Badge className={config.color}>{finding.status}</Badge>
                  </div>
                  {finding.section && finding.section !== "N/A" && (
                    <p className="text-xs text-muted-foreground">Section: {finding.section}</p>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed">{finding.details}</p>
                  {finding.recommendation && (
                    <div className="bg-muted rounded-md p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recommendation</p>
                      <p className="text-sm text-foreground mt-1">{finding.recommendation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
