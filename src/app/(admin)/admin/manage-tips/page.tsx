// src/app/(admin)/admin/manage-tips/page.tsx
"use client"; // For form handling

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, PlusCircle, Edit2, Trash2 } from "lucide-react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"; // To fetch existing tips

// Import actions
import {
  createAppContentSnippetAction,
  updateAppContentSnippetAction,
  deleteAppContentSnippetAction,
} from "@/app/actions/adminActions"; // Adjust path if needed

interface Snippet extends AppContentSnippet { id: string; created_at: string; } // AppContentSnippet from action payload type
interface AppContentSnippet {
    snippet_type: string;
    title?: string | null;
    content: string;
    link_url?: string | null;
    is_active: boolean;
}


export default function ManageTipsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for new/editing tip
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(true); // Default to active for new tip
  const snippetType = "tip_of_the_day"; // Hardcoded for this page

  const supabase = createPagesBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchSnippets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
        .from("app_content_snippets")
        .select("*")
        .eq("snippet_type", snippetType)
        .order("created_at", { ascending: false });
    if (error) toast.error("Failed to fetch tips", { description: error.message });
    else setSnippets(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSnippets();
  }, []);

  const resetForm = () => {
    setCurrentId(null); setTitle(""); setContent(""); setLinkUrl(""); setIsActive(true);
  };

  const handleEdit = (snippet: Snippet) => {
    setCurrentId(snippet.id);
    setTitle(snippet.title || "");
    setContent(snippet.content);
    setLinkUrl(snippet.link_url || "");
    setIsActive(snippet.is_active);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to form
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tip?")) return;
    setIsSubmitting(true); // Use same loading state or a specific one
    const result = await deleteAppContentSnippetAction(id);
    if (result.success) {
        toast.success("Tip deleted!");
        fetchSnippets(); // Refresh list
    } else {
        toast.error("Delete failed", { description: result.error });
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) {
      toast.error("Content is required for the tip.");
      return;
    }
    setIsSubmitting(true);
    const payload = {
      snippet_type: snippetType,
      title: title.trim() || null,
      content: content.trim(),
      link_url: linkUrl.trim() || null,
      is_active: isActive,
    };

    let result;
    if (currentId) { // Update existing
      result = await updateAppContentSnippetAction({ ...payload, id: currentId });
    } else { // Create new
      result = await createAppContentSnippetAction(payload);
    }

    if (result.success) {
      toast.success(currentId ? "Tip updated!" : "Tip created!");
      resetForm();
      fetchSnippets(); // Refresh the list
    } else {
      toast.error(currentId ? "Update Failed" : "Creation Failed", { description: result.error });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Manage Tips of the Day</h1>
      <Card>
        <CardHeader><CardTitle>{currentId ? "Edit Tip" : "Create New Tip"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label htmlFor="tipTitle">Title (Optional)</Label><Input id="tipTitle" value={title} onChange={e => setTitle(e.target.value)} disabled={isSubmitting} /></div>
            <div><Label htmlFor="tipContent">Content (Markdown supported) <span className="text-red-500">*</span></Label><Textarea id="tipContent" value={content} onChange={e => setContent(e.target.value)} required className="min-h-[100px]" disabled={isSubmitting} /></div>
            <div><Label htmlFor="tipLink">Link URL (Optional)</Label><Input id="tipLink" type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://example.com" disabled={isSubmitting} /></div>
            <div className="flex items-center space-x-2"><Checkbox id="tipIsActive" checked={isActive} onCheckedChange={checked => setIsActive(Boolean(checked))} disabled={isSubmitting} /><Label htmlFor="tipIsActive">Set this tip as active (will deactivate others)</Label></div>
            <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (currentId ? <Save className="mr-2 h-4 w-4"/> : <PlusCircle className="mr-2 h-4 w-4"/>)}
                    {currentId ? "Save Changes" : "Create Tip"}
                </Button>
                {currentId && <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel Edit</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
    
      <Card>
        <CardHeader><CardTitle>Existing Tips</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <Loader2 className="mx-auto h-8 w-8 animate-spin" />}
          {!isLoading && snippets.length === 0 && <p>No tips found.</p>}
          <div className="space-y-3">
            {snippets.map(snippet => (
              <div key={snippet.id} className={`p-3 border rounded-md ${snippet.is_active ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-card'}`}>
                <h4 className="font-semibold">{snippet.title || "Tip"} {snippet.is_active && <span className="text-xs text-green-600 dark:text-green-400 ml-2 p-1 bg-green-200 dark:bg-green-700 rounded">ACTIVE</span>}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{snippet.content.substring(0,100)}{snippet.content.length > 100 && "..."}</p>
                {snippet.link_url && <a href={snippet.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Learn More</a>}
                <div className="mt-2 flex gap-2">
                  <Button size="xs" variant="outline" onClick={() => handleEdit(snippet)}><Edit2 className="mr-1 h-3 w-3"/>Edit</Button>
                  <Button size="xs" variant="destructive-outline" onClick={() => handleDelete(snippet.id)}><Trash2 className="mr-1 h-3 w-3"/>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}