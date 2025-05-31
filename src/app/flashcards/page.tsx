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
                <div className="flex gap-2">
                    <Button onClick={handleStudySelected} disabled={selectedSetIds.length === 0}>
                        <Play className="mr-2 h-4 w-4" /> Study Selected
                    </Button>
                    <Button onClick={() => router.push('/flashcards/create')}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Create New Set
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                                <div className="h-3 bg-muted rounded w-1/2"></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : flashcardSets && flashcardSets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {flashcardSets.map((set) => (
                        <Card 
                            key={set.id} 
                            className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                        >
                            <div className="flex items-start p-4 md:p-6">
                                <Checkbox
                                    checked={selectedSetIds.includes(set.id)}
                                    onCheckedChange={() => handleSetSelect(set.id)}
                                    className="mr-4 mt-1"
                                />
                                <div className="flex-1">
                                    <CardTitle className="text-lg font-semibold mb-2">
                                        {set.title}
                                    </CardTitle>
                                    {set.description && (
                                        <CardDescription className="text-sm mb-4">
                                            {set.description}
                                        </CardDescription>
                                    )}
                                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                                        <span>{set.card_count} cards</span>
                                        <span>Updated {new Date(set.updated_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="max-w-2xl mx-auto">
                    <CardContent className="py-12 text-center">
                        <h2 className="text-xl font-semibold mb-2">No Flashcard Sets Yet</h2>
                        <p className="text-muted-foreground mb-6">
                            Create your first flashcard set to start learning!
                        </p>
                        <Button onClick={() => router.push('/flashcards/create')}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Set
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}