"use client";

import React, { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DisplayTask, PriorityLevel, TaskFormData, TaskCategory, SettingsValues } from "@/lib/types";
import { PREDEFINED_CATEGORIES } from "@/lib/types";
import { createTaskWithAIPrioritization } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


const taskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long.").max(100),
  description: z.string().min(5, "Description must be at least 5 characters long.").max(500),
  dueDate: z.date({ required_error: "Due date is required." }),
  priority: z.enum(["Low", "Medium", "High"], { required_error: "Priority is required." }),
  category: z.enum(PREDEFINED_CATEGORIES as [TaskCategory, ...TaskCategory[]], { required_error: "Category is required." }),
  tags: z.array(z.string()).optional(),
});

interface TaskFormProps {
  onTaskCreated: (newTask: DisplayTask) => void;
  settings: SettingsValues;
  isEmbedded?: boolean; // New prop
  initialValues?: Partial<TaskFormData>; // For pre-filling from templates
}

export function TaskForm({ onTaskCreated, settings, isEmbedded = false, initialValues }: TaskFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false); 

  useEffect(() => {
    setIsMounted(true);
  }, []);


  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: initialValues?.title || "",
      description: initialValues?.description || "",
      dueDate: initialValues?.dueDate || undefined,
      priority: initialValues?.priority || "Medium",
      category: initialValues?.category || "Personal",
      tags: initialValues?.tags || [],
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const onSubmit: SubmitHandler<TaskFormData> = async (data) => {
    setIsLoading(true);
    try {
      const formDataWithTags: TaskFormData = { ...data, tags: data.tags || [] };
      const result = await createTaskWithAIPrioritization(
        formDataWithTags, 
        settings
      );

      if (result.error) {
        toast({ title: "Error Creating Task", description: result.error, variant: "destructive" });
      } else if (result.task) {
        onTaskCreated(result.task);
        form.reset({ // Reset to empty or new initial values if any
             title: "", description: "", dueDate: undefined, priority: "Medium", category: "Personal", tags: []
        });

        let toastMessage = `"${result.task.title}" added.`;
        let toastTitle = "Task Created";
        let duration = 5000;

        if (result.aiProcessed) {
          toastMessage += " AI processing successful.";
          if (result.task.priority !== data.priority) {
            toastMessage += ` Priority adjusted by AI to ${result.task.priority}.`;
          }
           if (result.task.aiData?.isVague) {
            toastMessage += " AI suggests adding more details for clarity.";
          }
        } else {
            toastTitle = "Task Created (AI Issues)";
            duration = 8000;
             if (result.aiError) { 
                toastMessage += ` ${result.aiError}`; 
                console.error("AI Error during task creation:", result.aiError);
            } else if (!result.apiKeyAvailable) {
                 toastMessage += " API Key not available for the selected model. AI features skipped.";
            } else {
                toastMessage += " AI processing was skipped or encountered an issue.";
            }
        }
        toast({ title: toastTitle, description: toastMessage, duration });

      } else {
        toast({ title: "Error", description: "Unexpected response from server.", variant: "destructive" });
        console.error("Unexpected result structure:", result);
      }
    } catch (error: any) {
      toast({ title: "Error Submitting Form", description: error.message || "Unexpected error.", variant: "destructive" });
      console.error("Error in TaskForm onSubmit:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isMounted && !isEmbedded) { // Show skeleton only if not embedded and not mounted
    return (
      <Card className="w-full shadow-lg mb-8">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Create New Task</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 animate-pulse">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
            </div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const FormContent = (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-1">
      <div className="space-y-1">
        <Label htmlFor="title" className="text-sm font-medium">Title</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Enter task title"
          className={cn(form.formState.errors.title && "border-destructive")}
          aria-invalid={form.formState.errors.title ? "true" : "false"}
        />
        {form.formState.errors.title && (
          <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="description" className="text-sm font-medium">Description</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Enter task description"
          className={cn("min-h-[80px]", form.formState.errors.description && "border-destructive")}
          aria-invalid={form.formState.errors.description ? "true" : "false"}
        />
        {form.formState.errors.description && (
          <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="dueDate" className="text-sm font-medium">Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.watch("dueDate") && "text-muted-foreground",
                  form.formState.errors.dueDate && "border-destructive"
                )}
                aria-invalid={form.formState.errors.dueDate ? "true" : "false"}
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
          <Label htmlFor="priority" className="text-sm font-medium">Priority</Label>
          <Select
            onValueChange={(value: PriorityLevel) => form.setValue("priority", value, { shouldValidate: true })}
            value={form.watch("priority")} // Controlled component
          >
            <SelectTrigger
              id="priority"
              className={cn(form.formState.errors.priority && "border-destructive")}
              aria-invalid={form.formState.errors.priority ? "true" : "false"}
            >
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
        <Label htmlFor="category" className="text-sm font-medium">Category</Label>
        <Select
          onValueChange={(value: TaskCategory) => form.setValue("category", value, { shouldValidate: true })}
          value={form.watch("category")} // Controlled component
        >
          <SelectTrigger
            id="category"
            className={cn(form.formState.errors.category && "border-destructive")}
            aria-invalid={form.formState.errors.category ? "true" : "false"}
          >
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
      
      <Button type="submit" className="w-full !mt-6" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Add Task with AI
          </>
        )}
      </Button>
    </form>
  );

  if (isEmbedded) {
    return FormContent;
  }

  return (
    <Card className="w-full shadow-lg mb-8">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Create New Task</CardTitle>
      </CardHeader>
      <CardContent>
        {FormContent}
      </CardContent>
    </Card>
  );
}
