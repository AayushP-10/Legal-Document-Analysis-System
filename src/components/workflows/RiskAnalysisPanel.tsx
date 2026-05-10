import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldAlert, ShieldCheck, ShieldQuestion, Loader2 } from "lucide-react";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface RiskClause {
  clauseName: string;
  riskLevel: "High" | "Medium" | "Low";
  reason: string;
  mitigation: string;
}

const riskConfig = {
  High: { color: "bg-destructive text-destructive-foreground", icon: ShieldAlert },
  Medium: { color: "bg-warning text-warning-foreground", icon: ShieldQuestion },
  Low: { color: "bg-success text-success-foreground", icon: ShieldCheck },
};

interface RiskAnalysisPanelProps {
  onBack: () => void;
  documentName?: string;
  filePath?: string;
  documentText?: string;
}

export function RiskAnalysisPanel({ onBack, documentName, filePath, documentText }: RiskAnalysisPanelProps) {
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<RiskClause[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const workflow = WORKFLOW_PROMPTS["clause-risk-analysis"];
    const docText = documentText || `Document: ${documentName || "Uploaded legal document"}`;

    runWorkflow(workflow.systemPrompt, workflow.userTemplate(docText), filePath ? [filePath] : undefined, workflow.jsonMode)
      .then((result) => {
        try {
          const parsed = JSON.parse(result);
          const risksArray = parsed.risks || parsed;
          const arr = Array.isArray(risksArray) ? risksArray : [];
          // Normalize keys (AI might use different casing)
          const normalized = arr.map((r: any) => ({
            clauseName: r.clauseName || r.clause_name || r["Clause Name"] || "Unknown",
            riskLevel: r.riskLevel || r.risk_level || r["Risk Level"] || "Medium",
            reason: r.reason || r["Reason for Risk"] || r.risk_reason || "",
            mitigation: r.mitigation || r["Suggested Mitigation"] || r.suggested_mitigation || "",
          }));
          setRisks(normalized);
        } catch {
          setError("Failed to parse risk analysis JSON.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Risk analysis failed:", err);
        setError("Unable to generate precise answer at this time. Please try again.");
        setLoading(false);
      });
  }, [documentName]);

  return (
    <div className="flex h-full">
      <div className="flex-1 border-r border-border flex flex-col items-center justify-center p-8 bg-muted/30">
        <div className="text-center space-y-2">
          <div className="h-16 w-12 border-2 border-dashed border-border rounded mx-auto flex items-center justify-center">
            <span className="text-xs text-muted-foreground">PDF</span>
          </div>
          <p className="text-sm font-medium">{documentName || "Document"}</p>
          <p className="text-xs text-muted-foreground">Document preview will appear here</p>
        </div>
      </div>

      <div className="w-full max-w-md flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-base font-semibold">Risk Assessment</h2>
            <p className="text-xs text-muted-foreground">Clause-level risk analysis</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generating precise answer...
            </div>
          ) : error ? (
            <div className="text-sm text-destructive py-4">{error}</div>
          ) : (
            risks.map((risk, i) => {
              const level = (["High", "Medium", "Low"].includes(risk.riskLevel) ? risk.riskLevel : "Medium") as keyof typeof riskConfig;
              const config = riskConfig[level];
              const Icon = config.icon;
              return (
                <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium">{risk.clauseName}</span>
                    </div>
                    <Badge className={config.color}>{risk.riskLevel}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk</p>
                      <p className="text-sm text-foreground leading-relaxed">{risk.reason}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mitigation</p>
                      <p className="text-sm text-foreground leading-relaxed">{risk.mitigation}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
