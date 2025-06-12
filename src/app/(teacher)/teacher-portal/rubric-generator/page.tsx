// src/app/(teacher)/teacher-portal/rubric-generator/page.tsx
"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Wand2,
  Save,
  Edit,
  Trash2,
  FilePlus2,
  ListChecks,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // npx shadcn-ui@latest add table

// Server Actions to be created
import {
  generateRubricAction,
  saveRubricAction,
  getSavedRubricsAction,
  getRubricByIdAction,
  deleteRubricAction,
} from "@/app/actions/rubricActions"; // Assuming this new actions file

// Types for Rubric structure
export interface RubricCriterionData {
  // For AI generation and DB
  criterion_title: string;
  criterion_description?: string;
  descriptors_by_level: { [level: string]: string }; // e.g., {"Exemplary": "...", "Proficient": "..."}
  weight?: number;
}
export interface GeneratedRubric {
  id?: string; // If saved
  title: string;
  assignment_description?: string;
  learning_objectives_context?: string;
  performance_levels: string[]; // e.g., ["Exemplary", "Proficient", "Developing"]
  criteria: RubricCriterionData[]; // Array of criteria with their descriptors
}
interface SavedRubricMeta {
  id: string;
  title: string;
  updated_at: string;
}

const performanceLevelOptions = [3, 4, 5]; // Number of levels

export default function RubricGeneratorPage() {
  const router = useRouter();
  // User Inputs for generation
  const [assignmentTitle, setAssignmentTitle] = useState(""); // Used for Rubric title
  const [assignmentDesc, setAssignmentDesc] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [numLevels, setNumLevels] = useState<number>(4); // Default to 4 levels
  const [customLevelNames, setCustomLevelNames] = useState<string[]>([
    "Exemplary",
    "Proficient",
    "Developing",
    "Beginning",
  ]); // Default names for 4 levels

  // AI Output & Management
  const [generatedRubric, setGeneratedRubric] =
    useState<GeneratedRubric | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false); // For editing generated rubric cells
  const [currentEditingRubricId, setCurrentEditingRubricId] = useState<
    string | null
  >(null);

  const [savedRubrics, setSavedRubrics] = useState<SavedRubricMeta[]>([]);
  const [isLoadingRubrics, setIsLoadingRubrics] = useState(true);

  // Update customLevelNames when numLevels changes
  useEffect(() => {
    const defaultLevels = {
      3: ["Exceeds Expectations", "Meets Expectations", "Needs Improvement"],
      4: ["Exemplary", "Proficient", "Developing", "Beginning"],
      5: ["Outstanding", "Excellent", "Good", "Fair", "Poor"],
    };
    // @ts-ignore
    setCustomLevelNames(defaultLevels[numLevels] || defaultLevels[4]);
  }, [numLevels]);

  const fetchSavedRubrics = async () => {
    setIsLoadingRubrics(true);
    try {
      const result = await getSavedRubricsAction();
      if (result.success && result.rubrics) {
        setSavedRubrics(result.rubrics as SavedRubricMeta[]);
      } else {
        toast.error("Failed to load saved rubrics", {
          description: result.error,
        });
      }
    } catch (e: any) {
      toast.error("Error loading rubrics", { description: e.message });
    } finally {
      setIsLoadingRubrics(false);
    }
  };

  useEffect(() => {
    fetchSavedRubrics();
  }, []);

  const handleGenerateRubric = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !assignmentTitle.trim() ||
      !assignmentDesc.trim() ||
      !learningObjectives.trim()
    ) {
      toast.error("Required Fields Missing", {
        description:
          "Please provide Assignment Title, Description, and Learning Objectives.",
      });
      return;
    }
    setIsGenerating(true);
    setGeneratedRubric(null);
    setCurrentEditingRubricId(null);
    try {
      const payload = {
        assignment_title: assignmentTitle,
        assignment_description: assignmentDesc,
        learning_objectives_context: learningObjectives,
        performance_level_names: customLevelNames, // Send the actual names
      };
      const result = await generateRubricAction(payload);
      if (result.success && result.rubric) {
        setGeneratedRubric({
          // Ensure the structure matches GeneratedRubric
          title: assignmentTitle, // Use user input title
          assignment_description: assignmentDesc,
          learning_objectives_context: learningObjectives,
          performance_levels: customLevelNames, // from state
          criteria: result.rubric.criteria || [], // Criteria from AI
        });
        setEditMode(true);
        toast.success("Rubric draft generated!");
        window.scrollTo({
          top: document.getElementById("rubric-output")?.offsetTop || 0,
          behavior: "smooth",
        });
      } else {
        toast.error("Generation Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Generation Error", { description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRubric = async () => {
    if (!generatedRubric || !generatedRubric.title.trim()) {
      toast.error("Title Missing", {
        description: "Please ensure your rubric has a title.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const rubricToSave: GeneratedRubric = {
        // Ensure all required fields for DB are present
        ...generatedRubric,
        id: currentEditingRubricId || undefined, // Pass ID if updating
      };
      const result = await saveRubricAction(rubricToSave);
      if (result.success && result.rubricId) {
        setGeneratedRubric((prev) =>
          prev ? { ...prev, id: result.rubricId } : null
        );
        setCurrentEditingRubricId(result.rubricId);
        setEditMode(false);
        toast.success(
          `Rubric ${currentEditingRubricId ? "updated" : "saved"}!`
        );
        fetchSavedRubrics();
      } else {
        toast.error("Save Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Save Error", { description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Handlers for editing rubric content directly in the table
  const handleCriterionTitleChange = (critIndex: number, newTitle: string) => {
    if (!generatedRubric) return;

    setGeneratedRubric((prev) => {
      if (!prev) return null;
      const newCriteria = [...prev.criteria];
      newCriteria[critIndex] = {
        ...newCriteria[critIndex],
        criterion_title: newTitle,
      };
      return { ...prev, criteria: newCriteria };
    });
  };

  const handleDescriptorChange = (
    critIndex: number,
    levelName: string,
    newDescriptor: string
  ) => {
    if (!generatedRubric) return;

    setGeneratedRubric((prev) => {
      if (!prev) return null;
      const newCriteria = [...prev.criteria];
      newCriteria[critIndex] = {
        ...newCriteria[critIndex],
        descriptors_by_level: {
          ...newCriteria[critIndex].descriptors_by_level,
          [levelName]: newDescriptor,
        },
      };
      return { ...prev, criteria: newCriteria };
    });
  };

  const loadRubricForEditing = async (rubricId: string) => {
    toast.info("Loading rubric for editing...");
    setIsGenerating(true);

    try {
      const result = await getRubricByIdAction(rubricId);
      if (result.success && result.rubric) {
        const rubric = result.rubric as GeneratedRubric;

        // Populate form inputs
        setAssignmentTitle(rubric.title || "");
        setAssignmentDesc(rubric.assignment_description || "");
        setLearningObjectives(rubric.learning_objectives_context || "");

        // Set performance levels
        if (rubric.performance_levels) {
          const levelsCount = rubric.performance_levels.length;
          setNumLevels(levelsCount >= 3 && levelsCount <= 5 ? levelsCount : 4);
          setCustomLevelNames(rubric.performance_levels);
        }

        // Set the rubric data
        setGeneratedRubric(rubric);
        setCurrentEditingRubricId(rubric.id);
        setEditMode(true);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error("Failed to load rubric", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Error loading rubric", { description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteRubric = async (rubricId: string, rubricTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the rubric "${rubricTitle}"? This action cannot be undone.`
      )
    )
      return;

    try {
      const result = await deleteRubricAction(rubricId);
      if (result.success) {
        toast.success(`Rubric "${rubricTitle}" deleted.`);
        fetchSavedRubrics(); // Refresh the list

        // If the deleted rubric was currently loaded, clear the form
        if (
          currentEditingRubricId === rubricId ||
          generatedRubric?.id === rubricId
        ) {
          setGeneratedRubric(null);
          setCurrentEditingRubricId(null);
          setEditMode(false);
          // Optionally reset form inputs too
        }
      } else {
        toast.error("Delete failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Error deleting rubric", { description: e.message });
    }
  };

  const handleCreateNew = () => {
    // Reset all form inputs and generated rubric state
    setAssignmentTitle("");
    setAssignmentDesc("");
    setLearningObjectives("");
    setNumLevels(4);
    setGeneratedRubric(null);
    setCurrentEditingRubricId(null);
    setEditMode(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex justify-between items-center pb-4 border-b">
        <h1 className="text-3xl font-bold text-secondary">
          <span className="text-primary">AI</span> Smart Rubric Generator
        </h1>
        <Button onClick={handleCreateNew} variant="outline">
          <FilePlus2 className="mr-2 h-4 w-4" /> Create New Rubric
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-secondary">
            Design Your Rubric
          </CardTitle>
          <CardDescription>
            Provide details about the assignment, and our AI will draft a
            comprehensive rubric.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateRubric} className="space-y-6">
            <div>
              <Label htmlFor="assignmentTitle">
                Rubric/Assignment Title <span className="text-primary">*</span>
              </Label>
              <Input
                id="assignmentTitle"
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="assignmentDesc">
                Assignment Description/Prompt{" "}
                <span className="text-primary">*</span>
              </Label>
              <Textarea
                id="assignmentDesc"
                value={assignmentDesc}
                onChange={(e) => setAssignmentDesc(e.target.value)}
                required
                className="min-h-[100px]"
              />
            </div>
            <div>
              <Label htmlFor="learningObjectives">
                Key Learning Objectives <span className="text-primary">*</span>
              </Label>
              <Textarea
                id="learningObjectives"
                value={learningObjectives}
                onChange={(e) => setLearningObjectives(e.target.value)}
                placeholder="e.g., Critical thinking, Use of evidence, Clarity of writing..."
                required
                className="min-h-[80px]"
              />
            </div>
            {/* Performance Levels Section */}
            <div className="space-y-2 pt-4 border-t">
              <Label>Performance Levels</Label>
              <Select
                value={String(numLevels)}
                onValueChange={(val) => setNumLevels(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {performanceLevelOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} Levels
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Level Names Section */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 bg-accent p-4 rounded-md">
              <h3 className="col-span-full text-sm font-medium text-muted-foreground">
                Customize Level Names
              </h3>
              {customLevelNames.map((levelName, index) => (
                <div key={index}>
                  <Label htmlFor={`levelName-${index}`} className="text-xs">
                    Level {index + 1}
                  </Label>
                  <Input
                    id={`levelName-${index}`}
                    value={levelName}
                    onChange={(e) => {
                      const newNames = [...customLevelNames];
                      newNames[index] = e.target.value;
                      setCustomLevelNames(newNames);
                    }}
                  />
                </div>
              ))}
            </div>
            {/* Generate Button */}
            <div className="pt-6 border-t flex justify-end">
              <Button type="submit" disabled={isGenerating} size="lg">
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Generate Rubric Draft
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading Indicator */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center text-center py-12 bg-card border rounded-lg my-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 font-medium text-secondary">
            Nova Pro is crafting your rubric...
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            This may take a moment.
          </p>
        </div>
      )}

      {/* Generated Rubric Output */}
      {generatedRubric && !isGenerating && (
        <Card className="mt-8 border-primary" id="rubric-output">
          <CardHeader className="flex-row justify-between items-center bg-accent">
            <div className="w-full">
              <Input
                value={generatedRubric.title}
                onChange={(e) =>
                  setGeneratedRubric((p) =>
                    p ? { ...p, title: e.target.value } : null
                  )
                }
                className="text-2xl font-bold border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring p-1 h-auto"
                placeholder="Rubric Title"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveRubric} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {currentEditingRubricId ? "Update" : "Save"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* The Table component will now inherit the correct styling */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px] font-bold text-secondary">
                    Criteria
                  </TableHead>
                  {generatedRubric.performance_levels.map((level) => (
                    <TableHead key={level} className="font-bold text-secondary">
                      {level}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedRubric.criteria.map((crit, critIndex) => (
                  <TableRow key={`crit-${critIndex}`}>
                    <TableCell className="align-top">
                      <Textarea
                        value={crit.criterion_title}
                        onChange={(e) =>
                          handleCriterionTitleChange(critIndex, e.target.value)
                        }
                        className="font-medium"
                      />
                    </TableCell>
                    {generatedRubric.performance_levels.map((levelName) => (
                      <TableCell key={levelName} className="align-top">
                        <Textarea
                          value={crit.descriptors_by_level[levelName] || ""}
                          onChange={(e) =>
                            handleDescriptorChange(
                              critIndex,
                              levelName,
                              e.target.value
                            )
                          }
                          className="text-sm"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {/* Saved Rubrics List */}
      <Card className="mt-12">
        <CardHeader>
          <div className="flex items-center">
            <ListChecks className="h-6 w-6 text-primary mr-3" />
            <CardTitle className="text-2xl text-secondary">
              My Saved Rubrics
            </CardTitle>
          </div>
          <CardDescription>
            View, edit, or continue working on your previously saved rubrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingRubrics && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {!isLoadingRubrics && savedRubrics.length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-md bg-accent/50">
              <p className="text-muted-foreground">
                You haven't saved any rubrics yet.
              </p>
              <Button
                onClick={handleCreateNew}
                variant="outline"
                className="mt-4"
              >
                <FilePlus2 className="mr-2 h-4 w-4" /> Create Your First Rubric
              </Button>
            </div>
          )}

          {!isLoadingRubrics && savedRubrics.length > 0 && (
            <div className="divide-y">
              {savedRubrics.map((rubric) => (
                <div
                  key={rubric.id}
                  className="py-3 flex items-center justify-between group hover:bg-accent/50 rounded-md px-2 transition-colors"
                >
                  <div>
                    <h3 className="font-medium line-clamp-1">{rubric.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Last updated:{" "}
                      {new Date(rubric.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      onClick={() => loadRubricForEditing(rubric.id)}
                      size="sm"
                      variant="outline"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() =>
                        handleDeleteRubric(rubric.id, rubric.title)
                      }
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
