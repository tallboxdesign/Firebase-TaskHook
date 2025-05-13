"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TaskFormData } from '@/lib/types';
import { format } from 'date-fns';

interface ConfirmTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (taskData: TaskFormData) => void;
  taskData: TaskFormData;
}

export function ConfirmTaskDialog({ isOpen, onClose, onConfirm, taskData }: ConfirmTaskDialogProps) {
  if (!taskData) return null;

  const handleConfirm = () => {
    onConfirm(taskData);
    onClose(); 
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Task Creation</DialogTitle>
          <DialogDescription>
            Review the task details below before adding it to your list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-sm font-medium text-right text-muted-foreground">Title:</span>
            <span className="text-sm">{taskData.title}</span>
          </div>
          <div className="grid grid-cols-[100px_1fr] items-start gap-4">
            <span className="text-sm font-medium text-right text-muted-foreground pt-1">Description:</span>
            <span className="text-sm whitespace-pre-wrap">{taskData.description}</span>
          </div>
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-sm font-medium text-right text-muted-foreground">Due Date:</span>
            <span className="text-sm">{format(taskData.dueDate, 'PPp')}</span> {/* Format date nicely */}
          </div>
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-sm font-medium text-right text-muted-foreground">Priority:</span>
            <span className="text-sm">{taskData.priority}</span>
          </div>
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-sm font-medium text-right text-muted-foreground">Category:</span>
            <span className="text-sm">{taskData.category}</span>
          </div>
          {taskData.tags && taskData.tags.length > 0 && (
            <div className="grid grid-cols-[100px_1fr] items-center gap-4">
              <span className="text-sm font-medium text-right text-muted-foreground">Tags:</span>
              <span className="text-sm">{taskData.tags.join(', ')}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Approve & Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
