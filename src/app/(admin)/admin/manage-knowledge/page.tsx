// src/app/(admin)/admin/manage-knowledge/page.tsx
"use client";
import { useState, ChangeEvent, FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UploadCloud, FileText, ListChecks, AlertTriangle } from "lucide-react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"; // For fetching list
import Link from "next/link";

// Server action to be created
import { uploadKnowledgeDocumentAction } from "@/app/actions/knowledgeActions";

interface KnowledgeDocument {
    id: string;
    file_name: string;
    status: string;
    uploaded_at: string;
    total_chunks?: number;
    error_message?: string;
}

export default function ManageKnowledgePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  const supabase = createPagesBrowserClient( /* ... */ );

  const fetchDocuments = async () => {
    setIsLoadingDocuments(true);
    const { data, error } = await supabase
        .from("knowledge_documents")
        .select("id, file_name, status, uploaded_at, total_chunks, error_message")
        .order("uploaded_at", { ascending: false });
    if (error) toast.error("Failed to fetch documents", { description: error.message });
    else setDocuments(data || []);
    setIsLoadingDocuments(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Invalid File Type", { description: "Please upload PDF documents only." });
        setSelectedFile(null);
        return;
      }
      if (file.size > 25 * 1024 * 1024) { // 25MB limit for PDFs (adjust as needed)
        toast.error("File Too Large", { description: "PDF size should not exceed 25MB." });
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.error("No file selected.");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append("document", selectedFile);

    try {
      const result = await uploadKnowledgeDocumentAction(formData);
      if (result.success) {
        toast.success("Document uploaded successfully!", {
          description: "It will be processed in the background. Check status below.",
        });
        setSelectedFile(null); // Clear file input
        (event.target as HTMLFormElement).reset(); // Reset form
        fetchDocuments(); // Refresh the list
      } else {
        toast.error("Upload Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Upload Error", { description: e.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Manage AI Knowledge Base (Curriculum/Textbooks)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Upload New Document (PDF)</CardTitle>
          <CardDescription>Upload PDF files (textbooks, curriculum guides) for Nova to learn from. Processing may take some time.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pdfUpload">Select PDF Document</Label>
              <Input id="pdfUpload" type="file" onChange={handleFileChange} accept="application/pdf" className="mt-1" disabled={isUploading}/>
            </div>
            <Button type="submit" disabled={isUploading || !selectedFile}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4"/>}
              Upload & Process Document
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Uploaded Documents Status</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoadingDocuments && <Loader2 className="mx-auto h-8 w-8 animate-spin"/>}
            {!isLoadingDocuments && documents.length === 0 && <p>No documents uploaded yet.</p>}
            <div className="space-y-3">
                {documents.map(doc => (
                    <div key={doc.id} className="p-3 border rounded-md flex justify-between items-center">
                        <div>
                            <p className="font-medium flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground"/> {doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">Uploaded: {new Date(doc.uploaded_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                             <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                doc.status === 'processed' ? 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300' :
                                doc.status === 'processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 animate-pulse' :
                                doc.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300' :
                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300'
                             }`}>
                                {doc.status}
                             </span>
                             {doc.status === 'processed' && <p className="text-xs text-muted-foreground">{doc.total_chunks || 0} chunks</p>}
                             {doc.status === 'error' && <p className="text-xs text-red-500 truncate max-w-xs" title={doc.error_message}>{doc.error_message}</p>}
                        </div>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}