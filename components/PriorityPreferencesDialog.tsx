
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { SettingsValues, PriorityPreferences, PriorityFocus, UrgencyThresholdPreset, ImportanceAspectPreset, TaskCategory } from '@/lib/types';
import { DEFAULT_PRIORITY_PREFERENCES, PREDEFINED_CATEGORIES } from '@/lib/types';
import { ArrowRight, ArrowLeft, CheckCircle, Clock, Star, FolderKanban, Info, Settings2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '@/lib/utils';

interface PriorityPreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: SettingsValues;
  onSettingsChange: (newSettings: SettingsValues) => void;
}

type WizardStep = "focus" | "focusDetails" | "keywords" | "summary";

const focusOptions: { value: PriorityFocus; label: string; description: string; icon: React.ElementType }[] = [
  { value: "Deadlines", label: "Deadlines Matter Most", description: "Prioritize tasks based on how soon they are due.", icon: Clock },
  { value: "Importance", label: "Impact is Key", description: "Prioritize tasks by their overall significance or consequence.", icon: Star },
  { value: "Categories", label: "Focus on Life Areas", description: "Prioritize tasks based on specific categories like Work or Personal.", icon: FolderKanban },
  { value: "Balanced", label: "A Balanced Approach", description: "Give equal weight to deadlines, importance, and task content.", icon: Settings2 },
];

const urgencyOptions: { value: UrgencyThresholdPreset; label: string }[] = [
  { value: "1 day", label: "Tasks due in 1 day" },
  { value: "3 days", label: "Tasks due in 3 days" },
  { value: "1 week", label: "Tasks due in 1 week" },
];

const importanceAspectOptions: { value: ImportanceAspectPreset; label: string }[] = [
  { value: "Work/Career", label: "Tasks affecting work/career" },
  { value: "Affecting Others", label: "Tasks affecting others (family, team)" },
  { value: "High Stakes", label: "Tasks with high stakes (e.g., penalties)" },
];


export function PriorityPreferencesDialog({ isOpen, onClose, currentSettings, onSettingsChange }: PriorityPreferencesDialogProps) {
  const [step, setStep] = useState<WizardStep>("focus");
  const [preferences, setPreferences] = useState<PriorityPreferences>(
    currentSettings.priorityPreferences || DEFAULT_PRIORITY_PREFERENCES
  );
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setPreferences(currentSettings.priorityPreferences || DEFAULT_PRIORITY_PREFERENCES);
      setStep("focus"); // Reset to first step when dialog opens
    }
  }, [currentSettings, isOpen]);

  const handleFocusChange = (focus: PriorityFocus) => {
    let newPrefs: PriorityPreferences = { ...DEFAULT_PRIORITY_PREFERENCES, focus }; // Start with defaults for the new focus

    // Assign weights based on focus
    if (focus === "Deadlines") {
      newPrefs.urgencyWeight = 0.7;
      newPrefs.importanceWeight = 0.3;
    } else if (focus === "Importance") {
      newPrefs.urgencyWeight = 0.3;
      newPrefs.importanceWeight = 0.7;
    } else if (focus === "Categories") {
      // For categories, AI context is more important, specific weighting is tricky
      // Keep weights balanced but acknowledge category focus in context
      newPrefs.urgencyWeight = 0.4;
      newPrefs.importanceWeight = 0.4; 
    } else { // Balanced
      newPrefs.urgencyWeight = 0.5;
      newPrefs.importanceWeight = 0.5;
    }
    setPreferences(newPrefs);
  };
  
  const handleSave = () => {
    onSettingsChange({ ...currentSettings, priorityPreferences: preferences });
    toast({
      title: "Priority Preferences Saved",
      description: "Your preferences have been updated.",
    });
    onClose();
  };

  const handleNext = () => {
    if (step === "focus") {
      if (preferences.focus === "Deadlines" || preferences.focus === "Importance" || preferences.focus === "Categories") {
        setStep("focusDetails");
      } else { // Balanced or other focuses that skip details
        setStep("keywords");
      }
    } else if (step === "focusDetails") {
      setStep("keywords");
    } else if (step === "keywords") {
      setStep("summary");
    }
  };

  const handleBack = () => {
    if (step === "summary") {
      setStep("keywords");
    } else if (step === "keywords") {
       if (preferences.focus === "Deadlines" || preferences.focus === "Importance" || preferences.focus === "Categories") {
        setStep("focusDetails");
      } else {
        setStep("focus");
      }
    } else if (step === "focusDetails") {
      setStep("focus");
    }
  };
  
  const handleResetDefaults = () => {
    setPreferences(DEFAULT_PRIORITY_PREFERENCES);
    toast({ title: "Preferences Reset", description: "Priority preferences have been reset to default." });
  };

  const renderStepContent = () => {
    switch (step) {
      case "focus":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">What’s most important to you when prioritizing tasks?</h3>
            <RadioGroup value={preferences.focus} onValueChange={handleFocusChange} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {focusOptions.map(opt => (
                <Label key={opt.value} htmlFor={`focus-${opt.value}`} 
                       className={cn(
                         "flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                         preferences.focus === opt.value ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-2" : "bg-card border-border"
                       )}>
                   <RadioGroupItem value={opt.value} id={`focus-${opt.value}`} className="sr-only" />
                   <opt.icon className="h-8 w-8 mb-2" />
                   <span className="font-semibold text-sm text-center">{opt.label}</span>
                   <span className="text-xs text-center mt-1 text-muted-foreground">{opt.description}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        );
      case "focusDetails":
        if (preferences.focus === "Deadlines") {
          return (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">How urgent is "urgent" for you?</h3>
              <RadioGroup
                value={preferences.urgencyThresholdPreset}
                onValueChange={(val) => setPreferences(p => ({ ...p, urgencyThresholdPreset: val as UrgencyThresholdPreset }))}
              >
                {urgencyOptions.map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`urgency-${opt.value}`} />
                    <Label htmlFor={`urgency-${opt.value}`}>{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          );
        }
        if (preferences.focus === "Importance") {
          return (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">What makes a task impactful to you?</h3>
              <RadioGroup
                value={preferences.importanceAspectPreset}
                onValueChange={(val) => setPreferences(p => ({ ...p, importanceAspectPreset: val as ImportanceAspectPreset }))}
              >
                {importanceAspectOptions.map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`importance-${opt.value}`} />
                    <Label htmlFor={`importance-${opt.value}`}>{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          );
        }
        if (preferences.focus === "Categories") {
          return (
            <div className="space-y-3">
              <h3 className="text-lg font-medium">Which areas of life matter most? (Select up to 3)</h3>
              <div className="grid grid-cols-2 gap-2">
                {PREDEFINED_CATEGORIES.map(cat => (
                  <div key={cat} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${cat}`}
                      checked={(preferences.preferredCategories || []).includes(cat)}
                      onCheckedChange={(checked) => {
                        setPreferences(p => {
                          const currentSelected = p.preferredCategories || [];
                          if (checked) {
                            return { ...p, preferredCategories: [...currentSelected, cat].slice(0, 3) };
                          } else {
                            return { ...p, preferredCategories: currentSelected.filter(c => c !== cat) };
                          }
                        });
                      }}
                    />
                    <Label htmlFor={`category-${cat}`}>{cat}</Label>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return null; // Should not happen if logic is correct
      case "keywords":
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Any specific keywords? (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              Enter words that indicate urgency or importance for you (e.g., urgent, client, emergency). Separate with commas.
            </p>
            <Input
              id="customKeywords"
              value={(preferences.customKeywords || []).join(", ")}
              onChange={(e) => setPreferences(p => ({ ...p, customKeywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) }))}
              placeholder="e.g., urgent, critical, ASAP"
            />
          </div>
        );
       case "summary":
        return (
          <div className="space-y-3">
            <h3 className="text-lg font-medium">Preferences Summary</h3>
            <Card className="bg-muted/50">
              <CardContent className="text-sm space-y-1 pt-4">
                <p><strong>Main Focus:</strong> {focusOptions.find(f => f.value === preferences.focus)?.label || 'N/A'}</p>
                {preferences.focus === "Deadlines" && preferences.urgencyThresholdPreset && (
                  <p><strong>Urgency Definition:</strong> {preferences.urgencyThresholdPreset}</p>
                )}
                {preferences.focus === "Importance" && preferences.importanceAspectPreset && (
                  <p><strong>Impact Definition:</strong> {preferences.importanceAspectPreset}</p>
                )}
                {preferences.focus === "Categories" && (preferences.preferredCategories || []).length > 0 && (
                  <p><strong>Key Categories:</strong> {(preferences.preferredCategories || []).join(", ")}</p>
                )}
                {(preferences.customKeywords || []).length > 0 && (
                  <p><strong>Keywords:</strong> {(preferences.customKeywords || []).join(", ")}</p>
                )}
                <p className="pt-2 text-xs italic">These preferences will guide AI task prioritization.</p>
              </CardContent>
            </Card>
          </div>
        );
      default: return null;
    }
  };

  const canGoNext = () => {
    if (step === "focus") return !!preferences.focus;
    // Add validation for other steps if necessary
    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="h-5 w-5 mr-2 text-primary" />
            Set Your Priority Preferences
          </DialogTitle>
          <DialogDescription>
            Help the AI understand what matters most to you. This will refine task prioritization.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 min-h-[250px]">
          {renderStepContent()}
        </div>

        <DialogFooter className="justify-between items-center">
          <div>
            {step !== "focus" && (
              <Button variant="outline" onClick={handleBack} size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-2">
             <Button variant="ghost" onClick={handleResetDefaults} size="sm">Reset to Defaults</Button>
            {step === "summary" ? (
              <Button onClick={handleSave} size="sm">
                <CheckCircle className="mr-2 h-4 w-4" /> Save Preferences
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canGoNext()} size="sm">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
         <DialogClose asChild>
            <button className="sr-only">Close</button>
         </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
