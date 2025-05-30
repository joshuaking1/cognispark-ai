"use client";

import { useState, useEffect } from "react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Play } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface FlashcardSet {
    id: string;
    title: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    card_count: number;
}

export default function FlashcardsListPage() {
    const router = useRouter();
    const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
    const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const supabase = createPagesBrowserClient();

    useEffect(() => {
        const fetchFlashcardSets = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push("/login?message=Please login to view your flashcards.");
                    return;
                }

                // Fetch flashcard sets
                const { data: setsData, error: setsError } = await supabase
                    .from("flashcard_sets")
                    .select("id, title, description, created_at, updated_at")
                    .eq("user_id", user.id)
                    .order("updated_at", { ascending: false });

                if (setsError) throw setsError;
                if (!setsData) return;

                // For each set, fetch its card count
                const setsWithCounts = await Promise.all(
                    setsData.map(async (set) => {
                        const { count, error: countError } = await supabase
                            .from("flashcards")
                            .select("*", { count: "exact", head: true })
                            .eq("set_id", set.id)
                            .eq("user_id", user.id);

                        if (countError) throw countError;
                        return { ...set, card_count: count || 0 };
                    })
                );

                setFlashcardSets(setsWithCounts);
            } catch (error) {
                console.error("Error fetching flashcard sets:", error);
                toast.error("Failed to load flashcard sets");
            } finally {
                setIsLoading(false);
            }
        };

        fetchFlashcardSets();
    }, [supabase, router]);

    const handleSetSelect = (setId: string) => {
        setSelectedSetIds(prev => 
            prev.includes(setId) 
                ? prev.filter(id => id !== setId)
                : [...prev, setId]
        );
    };

    const handleStudySelected = () => {
        if (selectedSetIds.length === 0) return;
        router.push(`/flashcards/study-session?sets=${selectedSetIds.join(',')}`);
    };

    return (
        <div className="container mx-auto py-4 md:py-8 px-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    My Flashcard Sets
                </h1>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                    {selectedSetIds.length > 0 && (
                        <Button 
                            onClick={handleStudySelected} 
                            variant="default"
                            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                        >
                            <Play className="mr-2 h-4 w-4 md:h-5 md:w-5" /> 
                            Study Selected ({selectedSetIds.length})
                        </Button>
                    )}
                    <Link href="/flashcards/create" className="w-full sm:w-auto">
                        <Button 
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                        >
                            <PlusCircle className="mr-2 h-4 w-4 md:h-5 md:w-5" /> 
                            Create New Set
                        </Button>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <div className="flex items-start p-6">
                                <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded mr-4 mt-1" />
                                <div className="flex-grow space-y-3">
                                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : flashcardSets && flashcardSets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {flashcardSets.map((set) => (
                        <Card 
                            key={set.id} 
                            className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02] bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50"
                        >
                            <div className="flex items-start p-4 md:p-6">
                                <Checkbox
                                    checked={selectedSetIds.includes(set.id)}
                                    onCheckedChange={() => handleSetSelect(set.id)}
                                    className="mr-4 mt-1"
                                />
                                <Link href={`/flashcards/set/${set.id}`} className="flex-grow">
                                    <CardHeader className="p-0">
                                        <CardTitle className="text-lg md:text-xl font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {set.title}
                                        </CardTitle>
                                        {set.description && (
                                            <CardDescription className="text-sm h-10 overflow-hidden text-ellipsis line-clamp-2">
                                                {set.description}
                                            </CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-0 mt-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <span className="font-medium">{set.card_count || 0}</span>
                                                <span>card{set.card_count !== 1 ? 's' : ''}</span>
                                            </span>
                                            <span>•</span>
                                            <span>Updated {new Date(set.updated_at).toLocaleDateString()}</span>
                                        </div>
                                    </CardContent>
                                </Link>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 px-4">
                    <div className="max-w-md mx-auto space-y-4">
                        <h3 className="text-xl text-muted-foreground">You haven't created any flashcard sets yet.</h3>
                        <p className="text-sm text-muted-foreground">Create your first set to start learning!</p>
                        <Link href="/flashcards/create" className="inline-block">
                            <Button 
                                variant="default" 
                                size="lg"
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                            >
                                Create Your First Set
                            </Button>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}