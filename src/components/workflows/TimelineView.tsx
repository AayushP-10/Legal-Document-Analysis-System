import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface TimelineEvent {
  date: string;
  event_description: string;
  clause_reference: string;
}

interface TimelineViewProps {
  onBack: () => void;
  documentName?: string;
  filePath?: string;
  documentText?: string;
}

export function TimelineView({ onBack, documentName, filePath, documentText }: TimelineViewProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const workflow = WORKFLOW_PROMPTS["extract-chronology"];
    const docText = documentText || `Document: ${documentName || "Uploaded legal document"}`;

    runWorkflow(workflow.systemPrompt, workflow.userTemplate(docText), filePath ? [filePath] : undefined, workflow.jsonMode)
      .then((result) => {
        try {
          const parsed = JSON.parse(result);
          const eventsArray = parsed.events || parsed;
          if (Array.isArray(eventsArray)) {
            setEvents(eventsArray);
          } else {
            // Fallback: try regex extraction
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              setEvents(JSON.parse(jsonMatch[0]));
            } else {
              setError("Could not parse timeline data from AI response.");
            }
          }
        } catch {
          setError("Failed to parse timeline JSON from AI response.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Timeline extraction failed:", err);
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
          <h1 className="text-xl font-semibold tracking-tight">Chronology of Key Events</h1>
          {documentName && (
            <p className="text-xs text-muted-foreground">Extracted from: {documentName}</p>
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
        <div className="relative ml-4">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-6">
            {events.map((event, i) => (
              <div key={i} className="relative pl-10">
                <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {event.date}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {event.clause_reference}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {event.event_description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
