import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Search, MoreVertical, FolderOpen } from "lucide-react";
import { addLocalDocument } from "@/stores/localDocumentStore";
import { useLocalDocuments } from "@/hooks/useLocalDocuments";
import { extractPdfText } from "@/services/huggingFaceService";
import { toast } from "@/hooks/use-toast";

const FOLDERS = [
  { label: "All Documents", value: null },
  { label: "Statements", value: "statements" },
  { label: "Supply Agreements", value: "supply-agreements" },
];

export default function Vault() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeFolder = searchParams.get("folder");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const localDocuments = useLocalDocuments();

  const allDocuments = localDocuments
    .filter((d) => activeFolder === null || d.folder === activeFolder)
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  const filtered = allDocuments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const localId = crypto.randomUUID();
      const filePath = `uploads/${Date.now()}_${file.name}`;
      const fileType = file.name.split(".").pop()?.toLowerCase() || "unknown";

      let extractedText = "";
      if (fileType === "pdf") {
        try {
          extractedText = await extractPdfText(file);
        } catch {
          // continue without text
        }
      }

      addLocalDocument(
        {
          id: localId,
          name: file.name,
          file_path: filePath,
          status: extractedText ? "analyzed" : "pending",
          folder: activeFolder,
          file_type: fileType,
          uploaded_at: new Date().toISOString(),
          isLocal: true,
          extractedText,
        },
        file
      );
    }

    toast({ title: "Document uploaded", description: `${files.length} file(s) uploaded successfully.` });
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Legal Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and analyze your legal documents</p>
        </div>
        <div>
          <label htmlFor="file-upload">
            <Button asChild disabled={uploading} className="gap-2 cursor-pointer">
              <span>
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload Document"}
              </span>
            </Button>
          </label>
          <input id="file-upload" type="file" className="hidden" accept=".pdf,.docx,.doc" multiple onChange={handleUpload} />
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {FOLDERS.map((f) => (
          <button
            key={f.label}
            onClick={() => navigate(f.value ? `/vault?folder=${f.value}` : "/vault")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeFolder === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-sm">No documents found</p>
          <p className="text-xs mt-1">Upload a PDF or DOCX to get started</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/analysis/${doc.id}`)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.uploaded_at).toLocaleDateString()} · {doc.file_type.toUpperCase()}
                  </p>
                </div>
                <Badge variant={doc.status === "analyzed" ? "default" : "secondary"} className={doc.status === "analyzed" ? "bg-success text-success-foreground" : ""}>
                  {doc.status === "analyzed" ? "Analyzed" : "Pending"}
                </Badge>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
