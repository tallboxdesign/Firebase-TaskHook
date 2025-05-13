
"use client";

import React, { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DisplayTask, PriorityLevel, TaskFormData, TaskCategory, SettingsValues } from "@/lib/types";
import { PREDEFINED_CATEGORIES } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const editTaskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long.").max(100),
  description: z.string().min(5, "Description must be at least 5 characters long.").max(500),
  dueDate: z.date({ required_error: "Due date is required." }),
  priority: z.enum(["Low", "Medium", "High"], { required_error: "Priority is required." }),
  category: z.enum(PREDEFINED_CATEGORIES as [TaskCategory, ...TaskCategory[]], { required_error: "Category is required." }),
  tags: z.array(z.string()).optional(), // Tags might not be directly editable here but good to keep consistent
});

interface EditTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit: DisplayTask | null;
  onSave: (taskId: string, formData: TaskFormData) => Promise<void>;
  settings: SettingsValues; // Needed if AI reprocessing happens on edit
}

export function EditTaskDialog({ isOpen, onClose, taskToEdit, onSave, settings }: EditTaskDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<TaskFormData>({
    resolver: zodResolver(editTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: new Date(),
      priority: "Medium",
      category: "Personal",
      tags: [],
    },
  });

  useEffect(() => {
    if (taskToEdit) {
      let dateForForm: Date;
      if (taskToEdit.dueDate === null || taskToEdit.dueDate === undefined) {
        dateForForm = new Date(); // Default to now if dueDate is null or undefined
      } else {
        const parsedDate = new Date(taskToEdit.dueDate);
        // Check if parsedDate is a valid Date object and not "Invalid Date"
        // An invalid date object will have its time value as NaN
        if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
          dateForForm = parsedDate;
        } else {
          dateForForm = new Date(); // Default to now if parsing failed or resulted in an invalid date
        }
      }

      form.reset({
        title: taskToEdit.title,
        description: taskToEdit.description,
        dueDate: dateForForm,
        priority: taskToEdit.priority,
        category: taskToEdit.category,
        tags: taskToEdit.tags || [],
      });
    }
  }, [taskToEdit, form, isOpen]); // Reset form when dialog opens or taskToEdit changes

  if (!taskToEdit) {
    return null; // Or a loading/error state if isOpen but no task
  }

  const onSubmit: SubmitHandler<TaskFormData> = async (data) => {
    setIsLoading(true);
    try {
      await onSave(taskToEdit.id, data);
      // Toast for success is handled in HomePage after action completes
    } catch (error: any) {
      toast({ title: "Error Updating Task", description: error.message || "Unexpected error.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task: {taskToEdit.title}</DialogTitle>
          <DialogDescription>
            Update the details of your task. Changes will be processed with AI.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              {...form.register("title")}
              className={cn(form.formState.errors.title && "border-destructive")}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              {...form.register("description")}
              className={cn("min-h-[80px]",form.formState.errors.description && "border-destructive")}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="edit-dueDate">Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("dueDate") && "text-muted-foreground",
                      form.formState.errors.dueDate && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("dueDate") ? format(form.watch("dueDate") as Date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch("dueDate")}
                    onSelect={(date) => form.setValue("dueDate", date as Date, { shouldValidate: true })}
                    initialFocus
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.dueDate && (
                <p className="text-xs text-destructive">{form.formState.errors.dueDate.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-priority">Priority</Label>
              <Select
                onValueChange={(value: PriorityLevel) => form.setValue("priority", value, { shouldValidate: true })}
                defaultValue={form.watch("priority")}
              >
                <SelectTrigger id="edit-priority" className={cn(form.formState.errors.priority && "border-destructive")}>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {(["Low", "Medium", "High"] as PriorityLevel[]).map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.priority && (
                <p className="text-xs text-destructive">{form.formState.errors.priority.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-category">Category</Label>
            <Select
              onValueChange={(value: TaskCategory) => form.setValue("category", value, { shouldValidate: true })}
              defaultValue={form.watch("category")}
            >
              <SelectTrigger id="edit-category" className={cn(form.formState.errors.category && "border-destructive")}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category && (
              <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
