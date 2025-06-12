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

  const [learningObjectivesInput, setLearningObjectivesInput] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);

  // Grid data
  const [gridData, setGridData] = useState<TOSCell[]>([]);

  // Management
  const [currentEditingTOSId, setCurrentEditingTOSId] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  // const [savedTOS, setSavedTOS] = useState<SavedTOSMeta[]>([]);
  // const [isLoadingTOSList, setIsLoadingTOSList] = useState(true);
  // useEffect(() => { fetchSavedTOS(); }, []);
  // const fetchSavedTOS = async () => { /* ... */ };

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
    if (!learningObjectivesInput.trim()) {
      toast.error("Please paste some learning objectives to classify.");
      return;
    }
    setIsClassifying(true);
    try {
      const result = await classifyObjectivesAction(
        learningObjectivesInput.split("\n")
      );
      if (result.success && result.classified_objectives) {
        // This is advanced: use this data to pre-populate content areas or map objectives to cells
        // For V1, maybe just show the classified list as a suggestion to the teacher
        toast.success("Objectives classified (display logic TBD).");
        console.log("Classified Objectives:", result.classified_objectives);
        // Example: Update contentAreas based on classified objectives (if unique topics are derived)
        // Or display them for teacher to manually add to TOS.
      } else {
        toast.error("Classification Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Classification Error", { description: e.message });
    } finally {
      setIsClassifying(false);
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

      {/* AI Assistance for Objectives (Optional V1 Feature) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Palette className="mr-2 h-5 w-5 text-purple-500" /> AI Assist:
            Classify Learning Objectives (Optional)
          </CardTitle>
          <CardDescription>
            Paste your learning objectives (one per line). Nova Pro can help
            classify them by cognitive level to inform your TOS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={learningObjectivesInput}
            onChange={(e) => setLearningObjectivesInput(e.target.value)}
            placeholder="Paste learning objectives here, one per line..."
            className="min-h-[100px]"
          />
          <Button
            onClick={handleClassifyObjectives}
            variant="outline"
            className="mt-2"
            disabled={isClassifying || !learningObjectivesInput.trim()}
          >
            {isClassifying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}{" "}
            Classify Objectives
          </Button>
          {/* Display classified objectives (if any) here */}
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
