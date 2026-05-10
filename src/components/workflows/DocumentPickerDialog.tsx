import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocalDocuments } from "@/hooks/useLocalDocuments";

interface Document {
  id: string;
  name: string;
  file_path: string;
  status: string;
  file_type: string;
  uploaded_at: string;
}

interface DocumentPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (doc: Document) => void;
  workflowTitle: string;
}

export function DocumentPickerDialog({ open, onClose, onSelect, workflowTitle }: DocumentPickerDialogProps) {
  const documents = useLocalDocuments();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Select a Document</DialogTitle>
          <DialogDescription>
            Choose a document from your Vault to run <strong>{workflowTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        {documents.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <p>No documents in your Vault.</p>
            <p className="mt-1">Upload a document first using "Files and sources".</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {documents.map((doc) => (
              <button
                key={doc.id}
                className="w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-accent transition-colors"
                onClick={() => onSelect(doc as Document)}
              >
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.file_type.toUpperCase()} · {new Date(doc.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={doc.status === "analyzed" ? "default" : "secondary"} className="shrink-0 text-xs">
                  {doc.status}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
