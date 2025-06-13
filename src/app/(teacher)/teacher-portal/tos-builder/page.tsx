// src/app/(teacher)/teacher-portal/tos-builder/page.tsx
"use client";

import { useState, FormEvent, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Loader2,
  Wand2,
  Save,
  Edit,
  Trash2,
  FilePlus2,
  ListChecks,
  Percent,
  Hash,
  Palette,
} from "lucide-react"; // Added icons
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { TagInput, type Tag as TagType } from "@/components/ui/tag-input"; // Assuming you have this

// Server Actions to be created
import {
  classifyObjectivesAction, // AI to classify objectives by Bloom's
  saveTOSTemplateAction,
  getSavedTOSTemplatesAction,
  getTOSTemplateByIdAction,
  deleteTOSTemplateAction,
} from "@/app/actions/tosActions"; // New actions file
// NEW import for lesson plan actions:
import {
  getSavedLessonPlansAction,
  getLearningObjectivesForPlanAction,
} from "@/app/actions/lessonPlanActions";

// Types for TOS structure
const BLOOM_LEVELS_DEFAULT = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

interface ContentArea {
  id: string; // client-side unique id
  name: string;
}
interface TOSCell {
  contentAreaName: string;
  cognitiveSkillLevel: string;
  item_count_or_percent: number | string; // string to allow empty input initially
  learning_objectives_covered?: string[];
}
export interface TOSTemplateData {
  id?: string; // DB ID if saved
  title: string;
  description?: string;
  cognitive_skill_levels: string[];
  content_areas: ContentArea[]; // Just names for UI simplicity, or objects with more detail
  cells: TOSCell[]; // Represents the grid data
  total_items_or_percent: number | string; // For target total
  is_percentage_based: boolean; // To toggle between counts and percentages
}
interface SavedTOSMeta {
  id: string;
  title: string;
  updated_at: string;
}

interface LessonPlanMeta {
  // For dropdown
  id: string;
  title: string;
}

interface ClassifiedObjective {
  objective_text: string;
  suggested_cognitive_level: string;
  reasoning?: string;
}

export default function TOSBuilderPage() {
  const router = useRouter();
  // Form states
  const [tosTitle, setTosTitle] = useState("");
  const [tosDescription, setTosDescription] = useState("");
  const [cognitiveLevels, setCognitiveLevels] = useState<TagType[]>(
    BLOOM_LEVELS_DEFAULT.map((l) => ({ id: l, text: l }))
  );
  const [contentAreas, setContentAreas] = useState<TagType[]>([]);
  const [totalValue, setTotalValue] = useState<number | string>(100); // Default to 100% or e.g., 50 items
  const [isPercentageBased, setIsPercentageBased] = useState(true);

  const [learningObjectivesInput, setLearningObjectivesInput] = useState(""); // For manual paste
  const [importedObjectives, setImportedObjectives] = useState<string[]>([]); // Objectives from selected lesson plan
  const [classifiedImportedObjectives, setClassifiedImportedObjectives] =
    useState<ClassifiedObjective[]>([]); // AI classified
  const [isClassifying, setIsClassifying] = useState(false);
  const [availableLessonPlans, setAvailableLessonPlans] = useState<
    LessonPlanMeta[]
  >([]);
  const [selectedLessonPlanId, setSelectedLessonPlanId] =
    useState<string>("none");
  const [isLoadingLessonPlans, setIsLoadingLessonPlans] = useState(false);
  const [isLoadingObjectives, setIsLoadingObjectives] = useState(false);

  // Grid data
  const [gridData, setGridData] = useState<TOSCell[]>([]);

  // Management
  const [currentEditingTOSId, setCurrentEditingTOSId] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  // const [savedTOS, setSavedTOS] = useState<SavedTOSMeta[]>([]);
  // const [isLoadingTOSList, setIsLoadingTOSList] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoadingLessonPlans(true);
      const result = await getSavedLessonPlansAction(); // This action returns id and title
      if (result.success && result.plans) {
        setAvailableLessonPlans(
          result.plans.map((p) => ({ id: p.id, title: p.title }))
        );
      } else {
        toast.error("Failed to load lesson plans for import.");
      }
      setIsLoadingLessonPlans(false);
    };
    fetchPlans();
    // ... (existing useEffect for fetchSavedTOS if any)
  }, []);

  const handleLessonPlanSelect = async (planId: string) => {
    setSelectedLessonPlanId(planId);
    if (!planId || planId === "none") {
      setImportedObjectives([]);
      setClassifiedImportedObjectives([]);
      return;
    }
    setIsLoadingObjectives(true);
    setClassifiedImportedObjectives([]); // Clear previous classifications
    try {
      const result = await getLearningObjectivesForPlanAction(planId);
      if (result.success && result.objectives) {
        setImportedObjectives(result.objectives);
        // Optionally, set learningObjectivesInput too if you want them in the textarea
        setLearningObjectivesInput(result.objectives.join("\n"));
      } else {
        toast.error("Failed to load objectives", { description: result.error });
        setImportedObjectives([]);
      }
    } catch (e: any) {
      toast.error("Error loading objectives", { description: e.message });
      setImportedObjectives([]);
    } finally {
      setIsLoadingObjectives(false);
    }
  };

  // Recalculate grid when contentAreas or cognitiveLevels change
  useEffect(() => {
    const newGridData: TOSCell[] = [];
    contentAreas.forEach((ca) => {
      cognitiveLevels.forEach((cl) => {
        // Preserve existing values if possible, otherwise default to 0 or ""
        const existingCell = gridData.find(
          (cell) =>
            cell.contentAreaName === ca.text &&
            cell.cognitiveSkillLevel === cl.text
        );
        newGridData.push({
          contentAreaName: ca.text,
          cognitiveSkillLevel: cl.text,
          item_count_or_percent: existingCell
            ? existingCell.item_count_or_percent
            : isPercentageBased
            ? 0
            : "",
        });
      });
    });
    setGridData(newGridData);
  }, [contentAreas, cognitiveLevels, isPercentageBased]); // Removed gridData from deps to avoid loop

  const handleGridCellChange = (
    contentAreaName: string,
    cognitiveSkillLevel: string,
    value: string
  ) => {
    const numericValue = isPercentageBased
      ? parseFloat(value)
      : parseInt(value, 10);
    setGridData((prevGrid) =>
      prevGrid.map((cell) =>
        cell.contentAreaName === contentAreaName &&
        cell.cognitiveSkillLevel === cognitiveSkillLevel
          ? {
              ...cell,
              item_count_or_percent: isNaN(numericValue)
                ? isPercentageBased
                  ? 0
                  : ""
                : numericValue,
            }
          : cell
      )
    );
  };

  const handleClassifyObjectives = async () => {
    // Use importedObjectives if available, otherwise use manually pasted text
    const objectivesToClassify =
      importedObjectives.length > 0
        ? importedObjectives
        : learningObjectivesInput.split("\n").filter((o) => o.trim() !== "");

    if (objectivesToClassify.length === 0) {
      toast.error("No learning objectives to classify.", {
        description:
          "Please import from a lesson plan or paste objectives manually.",
      });
      return;
    }
    setIsClassifying(true);
    try {
      const result = await classifyObjectivesAction(objectivesToClassify);
      if (result.success && result.classified_objectives) {
        setClassifiedImportedObjectives(result.classified_objectives);
        toast.success("Objectives classified by AI!");
        // Teacher now needs to use this info to populate Content Areas / Cognitive Skills manually,
        // or we could add a feature to "auto-populate TOS grid based on classification" (more advanced)
      } else {
        toast.error("Classification Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Classification Error", { description: e.message });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleUseSuggestedCognitiveLevels = () => {
    if (classifiedImportedObjectives.length > 0) {
      // Debug: Log the classified objectives to see their structure
      console.log("Classified objectives:", classifiedImportedObjectives);

      try {
        const uniqueLevels = Array.from(
          new Set(
            classifiedImportedObjectives.map(
              (obj) => obj.suggested_cognitive_level
            )
          )
        );

        // Debug: Log the unique levels extracted
        console.log("Unique cognitive levels:", uniqueLevels);

        // Convert to TagType format. Ensure no duplicates if cognitiveLevels state already has some.
        const newCognitiveLevelTags: TagType[] = uniqueLevels.map((level) => ({
          id: level,
          text: level,
        }));

        // Debug: Log the new tags
        console.log("New cognitive level tags:", newCognitiveLevelTags);

        // Option 2: Add to existing, ensuring uniqueness (more user-friendly)
        setCognitiveLevels((prevLevels) => {
          const existingLevelTexts = prevLevels.map((tag) => tag.text);
          console.log("Existing cognitive levels:", existingLevelTexts);

          const levelsToAdd = newCognitiveLevelTags.filter(
            (tag) => !existingLevelTexts.includes(tag.text)
          );
          console.log("Levels to add:", levelsToAdd);

          const updatedLevels = [...prevLevels, ...levelsToAdd];
          console.log("Updated cognitive levels:", updatedLevels);

          // Force a re-render by updating a state variable
          setTimeout(() => {
            // This will trigger a re-render after the state update has been processed
            setTosTitle((prev) => {
              console.log("Forcing re-render");
              return prev;
            });
          }, 100);

          return updatedLevels;
        });

        // Also remind the user to add content areas if they haven't already
        if (contentAreas.length === 0) {
          toast.info("Don't forget to add Content Areas to see the TOS grid!", {
            description:
              "The grid will appear once you have both Cognitive Levels and Content Areas.",
            duration: 5000,
          });
        }

        toast.success(
          "Suggested cognitive levels added to your TOS structure!"
        );
      } catch (error) {
        console.error("Error processing cognitive levels:", error);
        toast.error(
          "Failed to process cognitive levels. Check console for details."
        );
      }
    } else {
      toast.error(
        "No classified objectives available to extract cognitive levels from."
      );
    }
  };

  const handleSaveTOS = async () => {
    if (
      !tosTitle.trim() ||
      contentAreas.length === 0 ||
      cognitiveLevels.length === 0
    ) {
      toast.error(
        "Missing critical TOS data (Title, Content Areas, Cognitive Skills)."
      );
      return;
    }
    setIsSaving(true);
    const tosToSave: TOSTemplateData = {
      id: currentEditingTOSId || undefined,
      title: tosTitle,
      description: tosDescription,
      cognitive_skill_levels: cognitiveLevels.map((t) => t.text),
      content_areas: contentAreas.map((t) => ({ id: t.id, name: t.text })), // Store names for now
      cells: gridData.map((cell) => ({
        ...cell,
        item_count_or_percent: Number(cell.item_count_or_percent) || 0,
      })),
      total_items_or_percent:
        Number(totalValue) || (isPercentageBased ? 100 : 0),
      is_percentage_based: isPercentageBased,
    };

    try {
      const result = await saveTOSTemplateAction(tosToSave);
      if (result.success && result.tosId) {
        setCurrentEditingTOSId(result.tosId);
        toast.success(
          `Table of Specifications ${
            currentEditingTOSId ? "updated" : "saved"
          }!`
        );
        // fetchSavedTOS();
      } else {
        toast.error("Save Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Save Error", { description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate totals for display
  const rowTotals = contentAreas.map((ca) =>
    cognitiveLevels.reduce(
      (sum, cl) =>
        sum +
        (Number(
          gridData.find(
            (cell) =>
              cell.contentAreaName === ca.text &&
              cell.cognitiveSkillLevel === cl.text
          )?.item_count_or_percent
        ) || 0),
      0
    )
  );
  const colTotals = cognitiveLevels.map((cl) =>
    contentAreas.reduce(
      (sum, ca) =>
        sum +
        (Number(
          gridData.find(
            (cell) =>
              cell.contentAreaName === ca.text &&
              cell.cognitiveSkillLevel === cl.text
          )?.item_count_or_percent
        ) || 0),
      0
    )
  );
  const grandTotal = colTotals.reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">
        Dynamic Table of Specification Builder
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Define Your TOS Structure</CardTitle>
          <CardDescription>
            Set up content areas, cognitive skills, and target totals for your
            assessment blueprint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="tosTitle">
              TOS Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tosTitle"
              value={tosTitle}
              onChange={(e) => setTosTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="tosDesc">Description (Optional)</Label>
            <Textarea
              id="tosDesc"
              value={tosDescription}
              onChange={(e) => setTosDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cognitiveLevels">
                Cognitive Skill Levels (e.g., Bloom's)
              </Label>
              <TagInput
                tags={cognitiveLevels}
                setTags={setCognitiveLevels}
                placeholder="Add skill level & press Enter"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contentAreas">
                Content Areas / Topics <span className="text-red-500">*</span>
              </Label>
              <TagInput
                tags={contentAreas}
                setTags={setContentAreas}
                placeholder="Add content area & press Enter"
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="totalValue">Target Total for Assessment</Label>
              <Input
                id="totalValue"
                type="number"
                value={totalValue}
                onChange={(e) => setTotalValue(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="isPercentage"
                checked={isPercentageBased}
                onCheckedChange={(checked) =>
                  setIsPercentageBased(Boolean(checked))
                }
              />
              <Label htmlFor="isPercentage">
                Use Percentages (instead of item counts)
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section for Importing/Classifying Learning Objectives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ListChecks className="mr-2 h-5 w-5 text-blue-500" /> Learning
            Objectives Helper
          </CardTitle>
          <CardDescription>
            Import learning objectives from a saved lesson plan or paste them
            manually. Then, let Nova Pro help classify them by cognitive level
            to inform your TOS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="lessonPlanSelect">
              Import Objectives from Lesson Plan (Optional)
            </Label>
            <Select
              value={selectedLessonPlanId}
              onValueChange={handleLessonPlanSelect}
              disabled={isLoadingLessonPlans || isLoadingObjectives}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a lesson plan..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingLessonPlans ? (
                  <SelectItem value="loading" disabled>
                    Loading plans...
                  </SelectItem>
                ) : null}
                <SelectItem value="none">
                  -- Do Not Import / Clear --
                </SelectItem>
                {availableLessonPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isLoadingObjectives && <Loader2 className="h-5 w-5 animate-spin" />}
          {importedObjectives.length > 0 && !isLoadingObjectives && (
            <div className="p-3 border rounded-md bg-muted/30">
              <h4 className="text-sm font-semibold mb-1">
                Imported Objectives from "
                {
                  availableLessonPlans.find(
                    (p) => p.id === selectedLessonPlanId
                  )?.title
                }
                ":
              </h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                {importedObjectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Label htmlFor="learningObjectivesInput">
              Or Paste Learning Objectives Manually (one per line)
            </Label>
            <Textarea
              id="learningObjectivesInput"
              value={learningObjectivesInput}
              onChange={(e) => {
                setLearningObjectivesInput(e.target.value);
                if (selectedLessonPlanId && selectedLessonPlanId !== "none")
                  setSelectedLessonPlanId("none"); // Clear import if manually typing
                if (importedObjectives.length > 0) setImportedObjectives([]);
                if (classifiedImportedObjectives.length > 0)
                  setClassifiedImportedObjectives([]);
              }}
              placeholder="e.g., Students will be able to define osmosis.
Students will be able to apply the Pythagorean theorem..."
              className="min-h-[100px] mt-1"
              disabled={isClassifying}
            />
          </div>
          <Button
            onClick={handleClassifyObjectives}
            variant="outline"
            className="mt-2"
            disabled={
              isClassifying ||
              (!learningObjectivesInput.trim() &&
                importedObjectives.length === 0)
            }
          >
            {isClassifying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            AI Classify Objectives by Cognitive Level
          </Button>
          {classifiedImportedObjectives.length > 0 && !isClassifying && (
            <div className="mt-4 p-3 border rounded-md bg-green-50 dark:bg-green-900/20">
              <h4 className="text-sm font-semibold mb-2 text-green-700 dark:text-green-300">
                AI Suggested Classifications:
              </h4>
              <ul className="space-y-2 text-sm">
                {classifiedImportedObjectives.map((cObj, i) => (
                  <li key={i} className="border-b pb-1 last:border-b-0">
                    <strong>Objective:</strong> {cObj.objective_text} <br />
                    <span className="ml-2">
                      ↳{" "}
                      <strong className="text-green-600 dark:text-green-400">
                        Suggested Level:
                      </strong>{" "}
                      {cObj.suggested_cognitive_level}
                    </span>
                    {cObj.reasoning && (
                      <span className="ml-2 text-xs text-muted-foreground italic">
                        ({cObj.reasoning})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {/* === NEW BUTTON === */}
              <Button
                onClick={handleUseSuggestedCognitiveLevels}
                variant="outline"
                size="sm"
                className="mt-3 bg-green-100 hover:bg-green-200 dark:bg-green-800/50 dark:hover:bg-green-700/50 border-green-300 dark:border-green-600 text-green-700 dark:text-green-300"
              >
                Use These Suggested Levels in My TOS Columns
              </Button>
              {/* === END NEW BUTTON === */}
              <p className="text-xs text-muted-foreground mt-3">
                Use these suggestions to help you fill out the Cognitive Skill
                Levels and Content Areas in your TOS grid above/below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TOS Grid Input Table */}
      {contentAreas.length > 0 && cognitiveLevels.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Table of Specification Grid</CardTitle>
            <CardDescription>
              Enter the number of items or percentage for each cell.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">
                    Content Area \ Cognitive Skill
                  </TableHead>
                  {cognitiveLevels.map((cl) => (
                    <TableHead
                      key={cl.id}
                      className="text-center min-w-[120px]"
                    >
                      {cl.text}
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[100px]">
                    {isPercentageBased ? "Topic %" : "Topic Total"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentAreas.map((ca, rowIndex) => (
                  <TableRow key={ca.id}>
                    <TableCell className="font-medium">{ca.text}</TableCell>
                    {cognitiveLevels.map((cl) => (
                      <TableCell key={cl.id} className="text-center p-1">
                        <Input
                          type="number"
                          value={
                            gridData.find(
                              (cell) =>
                                cell.contentAreaName === ca.text &&
                                cell.cognitiveSkillLevel === cl.text
                            )?.item_count_or_percent || ""
                          }
                          onChange={(e) =>
                            handleGridCellChange(
                              ca.text,
                              cl.text,
                              e.target.value
                            )
                          }
                          className="w-20 mx-auto text-center"
                          min={0}
                          step={isPercentageBased ? 1 : 1}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold">
                      {rowTotals[rowIndex]}
                      {isPercentageBased ? "%" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">
                    {isPercentageBased
                      ? "Cognitive Skill %"
                      : "Cognitive Skill Total"}
                  </TableCell>
                  {colTotals.map((total, index) => (
                    <TableCell key={index} className="text-center font-bold">
                      {total}
                      {isPercentageBased ? "%" : ""}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-extrabold text-lg">
                    {grandTotal}
                    {isPercentageBased ? "%" : ""}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            {isPercentageBased && grandTotal !== 100 && (
              <p className="text-red-500 text-xs mt-2 text-center">
                Warning: Percentages do not add up to 100% (Currently{" "}
                {grandTotal}%).
              </p>
            )}
            {!isPercentageBased &&
              totalValue &&
              Number(totalValue) !== grandTotal && (
                <p className="text-red-500 text-xs mt-2 text-center">
                  Warning: Item counts ({grandTotal}) do not match target total
                  ({totalValue}).
                </p>
              )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleSaveTOS} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              Save TOS Template
            </Button>
          </CardFooter>
        </Card>
      )}
      {/* Saved TOS List (Placeholder for now) */}
    </div>
  );
}
