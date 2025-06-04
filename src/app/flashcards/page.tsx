"use client";

import { useState, useEffect } from "react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Play, BookOpen, Calendar, Layers } from "lucide-react";
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="container mx-auto py-6 md:py-12 px-4">
                {/* Header Section */}
                <div className="text-center mb-8 md:mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#fd6a3e] to-[#ff8c69] shadow-lg mb-6">
                        <BookOpen className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-[#022e7d] via-[#fd6a3e] to-[#022e7d] bg-clip-text text-transparent">
                            My Flashcard Sets
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        Organize your learning with personalized flashcard collections
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8 md:mb-12">
                    <Button 
                        onClick={handleStudySelected} 
                        disabled={selectedSetIds.length === 0}
                        className="w-full sm:w-auto h-12 px-8 text-base font-semibold rounded-full bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] hover:from-[#e55a35] hover:to-[#fd6a3e] text-white shadow-xl hover:shadow-2xl hover:shadow-[#fd6a3e]/30 transition-all duration-300 hover:scale-105 disabled:scale-100 disabled:opacity-50 disabled:hover:shadow-xl border-0"
                    >
                        <Play className="mr-2 h-5 w-5" /> 
                        Study Selected ({selectedSetIds.length})
                    </Button>
                    <Button 
                        onClick={() => router.push('/flashcards/create')}
                        variant="outline"
                        className="w-full sm:w-auto h-12 px-8 text-base font-semibold rounded-full border-2 border-[#022e7d]/30 text-[#022e7d] hover:bg-[#022e7d] hover:text-white hover:border-[#022e7d] transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#022e7d]/25"
                    >
                        <PlusCircle className="mr-2 h-5 w-5" /> 
                        Create New Set
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <Card key={i} className="animate-pulse bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-0 shadow-lg">
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                        <div className="flex-1 space-y-3">
                                            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                                            <div className="flex justify-between items-center">
                                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : flashcardSets && flashcardSets.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {flashcardSets.map((set) => (
                            <Card 
                                key={set.id} 
                                className="group bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-800/50 hover:shadow-2xl hover:shadow-[#fd6a3e]/20 transition-all duration-300 hover:scale-[1.02] overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69]"></div>
                                
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <Checkbox
                                            checked={selectedSetIds.includes(set.id)}
                                            onCheckedChange={() => handleSetSelect(set.id)}
                                            className="mt-1 data-[state=checked]:bg-[#fd6a3e] data-[state=checked]:border-[#fd6a3e] border-2 border-slate-300 dark:border-slate-600"
                                        />
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <h3 className="text-lg font-bold text-[#022e7d] dark:text-slate-100 group-hover:text-[#fd6a3e] transition-colors duration-200 leading-tight">
                                                    {set.title}
                                                </h3>
                                                {set.description && (
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                                                        {set.description}
                                                    </p>
                                                )}
                                            </div>
                                            
                                            <div className="flex justify-between items-center pt-2">
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-[#fd6a3e]/10 to-[#ff8c69]/10 text-[#fd6a3e]">
                                                        <Layers className="h-3 w-3" />
                                                        <span>{set.card_count} cards</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{new Date(set.updated_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                
                                {/* Hover Effect Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-r from-[#fd6a3e]/0 to-[#fd6a3e]/0 group-hover:from-[#fd6a3e]/5 group-hover:to-[#ff8c69]/5 transition-all duration-300 pointer-events-none"></div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="max-w-2xl mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-0 shadow-2xl shadow-slate-200/50 dark:shadow-slate-800/50">
                        <CardContent className="py-16 px-8 text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#fd6a3e]/20 to-[#ff8c69]/20 mb-6">
                                <BookOpen className="h-10 w-10 text-[#fd6a3e]" />
                            </div>
                            <h2 className="text-2xl font-bold text-[#022e7d] dark:text-slate-100 mb-3">
                                No Flashcard Sets Yet
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg leading-relaxed max-w-md mx-auto">
                                Create your first flashcard set to start your learning journey!
                            </p>
                            <Button 
                                onClick={() => router.push('/flashcards/create')}
                                className="h-12 px-8 text-base font-semibold rounded-full bg-gradient-to-r from-[#fd6a3e] to-[#ff8c69] hover:from-[#e55a35] hover:to-[#fd6a3e] text-white shadow-xl hover:shadow-2xl hover:shadow-[#fd6a3e]/30 transition-all duration-300 hover:scale-105 border-0"
                            >
                                <PlusCircle className="mr-2 h-5 w-5" /> 
                                Create Your First Set
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Summary Stats */}
                {flashcardSets.length > 0 && (
                    <div className="mt-12 text-center">
                        <div className="inline-flex items-center gap-6 px-8 py-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 shadow-lg">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-[#fd6a3e]">
                                    {flashcardSets.length}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Total Sets
                                </div>
                            </div>
                            <div className="w-px h-8 bg-slate-300 dark:bg-slate-600"></div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-[#022e7d] dark:text-slate-200">
                                    {flashcardSets.reduce((sum, set) => sum + set.card_count, 0)}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Total Cards
                                </div>
                            </div>
                            <div className="w-px h-8 bg-slate-300 dark:bg-slate-600"></div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-[#fd6a3e]">
                                    {selectedSetIds.length}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Selected
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}