"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import * as chrono from 'chrono-node';
import { Mic, StopCircle, Loader2, AlertTriangle, AudioLines, Edit3, Trash2, Send, TimerIcon, Brain, Calendar as CalendarIconLucide } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { TaskFormData, DisplayTask, SettingsValues, TaskCategory, PriorityLevel } from '@/lib/types';
import { createTaskWithAIPrioritization } from '@/app/actions'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid, addDays, nextDay, Day } from 'date-fns';
import { parseVoiceTranscript } from '@/ai/flows/parse-voice-transcript';
import type { ParseVoiceTranscriptInput, ParsedVoiceTask as AIParsedTask } from '@/ai/schemas'; 


interface EditableParsedVoiceTask {
  id: string; 
  title: string;
  dueDate?: Date;
  description: string; 
  category: TaskCategory;
  priority: PriorityLevel;
}

interface VoiceTaskInputProps {
  onTasksCreated: (newTasks: DisplayTask[]) => void; 
  settings: SettingsValues;
  isEmbedded?: boolean;
}

export interface VoiceTaskInputRef {
  // Methods exposed by the ref, if any are needed by parent.
  // For now, let's assume it's self-contained for triggering.
  // If CollapsibleTaskCreator *still* needs to trigger something, it can be added here.
  // Example: clearTranscript: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const RECORDING_DURATION_SECONDS = 30;

const VoiceTaskInput = forwardRef<VoiceTaskInputRef, VoiceTaskInputProps>(
  ({ onTasksCreated, settings, isEmbedded = false }, ref) => {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editableVoiceTasks, setEditableVoiceTasks] = useState<EditableParsedVoiceTask[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessingTranscript, setIsProcessingTranscript] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTimer, setRecordingTimer] = useState(RECORDING_DURATION_SECONDS);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionInstanceRef = useRef<any>(null); 
  const isListeningRef = useRef(isListening); // To get current state in callbacks

  const { toast } = useToast();

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Expose methods via ref if needed by parent (e.g., to clear state from parent)
  // For now, it's mostly self-contained for starting voice/recording.
  useImperativeHandle(ref, () => ({
    // Example: clearAll: () => resetState() 
  }));


  const isSpeechRecognitionSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const resetState = (keepTranscript: boolean = false) => {
    if (recognitionInstanceRef.current) {
      recognitionInstanceRef.current.abort(); 
      recognitionInstanceRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];

    if (!keepTranscript) setTranscript('');
    setEditableVoiceTasks([]);
    setAudioBlob(null);
    setError(null);
    setIsListening(false);
    setIsRecording(false); 
    setIsProcessingTranscript(false);
    setRecordingTimer(RECORDING_DURATION_SECONDS);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
  };

  const handleParseTextWithAI = async (fullTranscript: string) => {
    if (!fullTranscript || !fullTranscript.trim()) {
      setEditableVoiceTasks([]);
      return;
    }
    setTranscript(fullTranscript);
    setIsProcessingTranscript(true);
    setError(null);
    toast({ title: "AI Parsing Transcript...", description: "Please wait while AI processes the voice input."});

    try {
      const aiInput: ParseVoiceTranscriptInput = {
        fullTranscript,
        modelId: settings.selectedAIModel,
        apiKey: settings.apiKey,
      };
      const aiOutput = await parseVoiceTranscript(aiInput);

      if (aiOutput.parsedTasks && aiOutput.parsedTasks.length > 0) {
        const newEditableTasks: EditableParsedVoiceTask[] = aiOutput.parsedTasks.map((aiTask: AIParsedTask) => {
          let parsedDate: Date | undefined = undefined;
          if (aiTask.dueDate && aiTask.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) { 
            try {
              const dateCandidate = parseISO(aiTask.dueDate + "T00:00:00Z");
              if (isValid(dateCandidate) ) {
                 parsedDate = dateCandidate;
              } else {
                 console.warn("AI returned an invalid date string:", aiTask.dueDate);
              }
            } catch (e) {
              console.error("Error parsing date from AI:", aiTask.dueDate, e);
              parsedDate = undefined;
            }
          } else if (aiTask.dueDate) {
            console.warn("AI returned dueDate in unexpected format:", aiTask.dueDate, ". Expected YYYY-MM-DD.");
          }
          return {
            id: crypto.randomUUID(),
            title: aiTask.title || "Untitled Task",
            description: aiTask.description || (aiTask.title || "No description provided"), 
            dueDate: parsedDate,
            category: "Personal", 
            priority: "Medium", 
          };
        });
        setEditableVoiceTasks(newEditableTasks);
        toast({ title: "AI Parsing Complete", description: `${newEditableTasks.length} task(s) identified.`});
      } else {
        setError("AI could not identify any tasks from the transcript. Please try rephrasing or being more specific.");
        toast({ title: "AI Parsing Issue", description: "No tasks identified by AI. Try again or use manual input.", variant: "destructive"});
        setEditableVoiceTasks([]);
      }
      if(aiOutput.inputTokens !== undefined && aiOutput.outputTokens !== undefined) {
        console.log(`AI Transcript Parsing - Input Tokens: ${aiOutput.inputTokens}, Output Tokens: ${aiOutput.outputTokens}`);
      }
    } catch (err: any) {
      console.error("Error calling AI for transcript parsing:", err);
      setError(`AI parsing failed: ${err.message || "Unknown error"}. Falling back to simpler parsing or try manual input.`);
      toast({ title: "AI Parsing Error", description: `AI could not parse: ${err.message || "Unknown"}.`, variant: "destructive"});
      setEditableVoiceTasks([{
        id: crypto.randomUUID(),
        title: fullTranscript.substring(0, 70) + (fullTranscript.length > 70 ? "..." : ""),
        description: fullTranscript,
        dueDate: undefined,
        category: "Personal",
        priority: "Medium",
      }]);
    } finally {
      setIsProcessingTranscript(false);
    }
  };


  const handleVoiceTaskChange = (id: string, field: keyof EditableParsedVoiceTask, value: string | Date | undefined | TaskCategory | PriorityLevel) => {
    setEditableVoiceTasks(prev => prev.map(task => {
      if (task.id === id) {
        if (field === 'dueDate' && (value instanceof Date || value === undefined)) {
          return { ...task, dueDate: value };
        }
        if (typeof value === 'string' && (field === 'title' || field === 'description' || field === 'category' || field === 'priority')) {
          return { ...task, [field]: value };
        }
      }
      return task;
    }));
  };
  
  const removeEditableVoiceTask = (id: string) => {
    setEditableVoiceTasks(prev => prev.filter(task => task.id !== id));
  };

  const startAudioRecording = async () => {
    resetState(); 
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Audio recording (getUserMedia) is not supported by your browser.');
      toast({ title: "Unsupported Feature", description: "Audio recording is not supported by your browser.", variant: "destructive"});
      return;
    }
    setIsRecording(true);
    setRecordingTimer(RECORDING_DURATION_SECONDS);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setRecordingTimer(prev => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        const completeAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(completeAudioBlob);
        setIsRecording(false);
        if (completeAudioBlob.size > 0) transcribeRecordedAudio(completeAudioBlob);
        else {
          setError("Recording was empty. Please try recording again.");
          toast({ title: "Empty Recording", description: "No audio was captured.", variant: "destructive" });
        }
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.onerror = (event: any) => { 
        console.error("MediaRecorder error:", event);
        const errorEvent = event as ErrorEvent; 
        setError(`Recording error: ${errorEvent.error?.name || 'Unknown recording error'}. Please try again.`);
        toast({ title: "Recording Error", description: `An error occurred during recording: ${errorEvent.error?.name || 'Unknown error'}.`, variant: "destructive"});
        setIsRecording(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      toast({ title: "Recording Started", description: `Recording audio for up to ${RECORDING_DURATION_SECONDS} seconds...` });
      
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
      }, RECORDING_DURATION_SECONDS * 1000); 
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      let micError = 'Could not access microphone. Please check permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') micError = 'Microphone access denied. Please enable it in your browser settings.';
      else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') micError = 'No microphone found. Please ensure a microphone is connected and enabled.';
      setError(micError);
      toast({ title: "Microphone Error", description: micError, variant: "destructive"});
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };


  const initiateVoiceCapture = async () => {
    resetState();
    if (!isSpeechRecognitionSupported) {
      toast({ title: "Web Speech Unavailable", description: "Web Speech API not supported. Using audio recording for Whisper.", variant: "default" });
      startAudioRecording(); // Fallback to whisper if web speech not available
      return;
    }

    setIsListening(true);
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionInstanceRef.current = new Recognition();
    recognitionInstanceRef.current.lang = 'en-US';
    recognitionInstanceRef.current.interimResults = false;
    recognitionInstanceRef.current.maxAlternatives = 1;

    recognitionInstanceRef.current.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      handleParseTextWithAI(speechResult);
      setIsListening(false);
    };

    recognitionInstanceRef.current.onerror = (event: any) => {
      console.error('Web Speech API recognition error:', event.error);
      const errorType = event.error;
      setIsListening(false);
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'no-speech'].includes(errorType)) {
        toast({ title: `Web Speech Error: ${errorType}`, description: "Falling back to audio recording for Whisper.", variant: "default" });
        startAudioRecording(); // Fallback to whisper on common errors
      } else {
        setError(`Web Speech API error: ${errorType}.`);
        toast({ title: "Speech Recognition Error", description: `Web Speech API error: ${errorType}. Try audio recording.`, variant: "destructive" });
      }
    };
    
    recognitionInstanceRef.current.onend = () => {
      if (isListeningRef.current) { 
        setIsListening(false);
        if (!transcript && !error && !isRecording) { 
             toast({title: "Web Speech Ended", description: "No speech detected or process ended. Try audio recording if needed.", variant:"default"})
        }
      }
    };

    try {
      recognitionInstanceRef.current.start();
    } catch(e: any) {
      console.error("Failed to start Web Speech Recognition:", e);
      setIsListening(false);
      toast({ title: "Recognition Start Failed", description: `Could not start Web Speech API: ${e.message}. Falling back to audio recording for Whisper.`, variant: "default" });
      startAudioRecording(); // Fallback to whisper if start fails
    }
  };


  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    setIsRecording(false); 
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (recognitionInstanceRef.current) {
        recognitionInstanceRef.current.abort();
      }
    };
  }, []);

  const transcribeRecordedAudio = async (blobToTranscribe: Blob | null) => {
    const currentAudioBlob = blobToTranscribe || audioBlob;
    if (!currentAudioBlob || currentAudioBlob.size === 0) {
      setError('No audio recorded or recording is empty.');
      toast({ title: "Transcription Error", description: "No audio data to transcribe.", variant: "destructive"});
      return;
    }
    setIsProcessingTranscript(true); 
    setError(null);
    const formData = new FormData();
    formData.append('audio', currentAudioBlob, `recording-${Date.now()}.webm`);

    const headers: Record<string, string> = {};
    const clientSideOpenAIKey = settings.openaiApiKey;
    
    // Check if server-side key is indicated by an env var (passed during build time)
    // Note: NEXT_PUBLIC_ prefix is needed for client-side access to env vars.
    // If your check is meant for the server-side logic within the API route, this client-side check isn't the main gatekeeper.
    // If your check is meant for the server-side logic within the API route, this client-side check isn't the main gatekeeper.
    const serverSideOpenAIKeyIsLikelySet = process.env.NEXT_PUBLIC_OPENAI_API_KEY_SERVER_CONFIGURED === 'true';

    if (clientSideOpenAIKey) {
      headers['X-OpenAI-Key'] = clientSideOpenAIKey;
      console.log("Using client-provided OpenAI API Key from settings for transcription.");
    } else if (serverSideOpenAIKeyIsLikelySet){ 
       console.log("Client-side OpenAI API key not provided in settings. API route /api/transcribe will attempt to use server-configured OPENAI_API_KEY.");
    } else {
      console.warn("OpenAI API Key not found in client settings, and server does not indicate a key is set via NEXT_PUBLIC_OPENAI_API_KEY_SERVER_CONFIGURED. Transcription may fail if server also lacks the key.");
       setError('OpenAI API key not configured. Please add it in app settings or ensure OPENAI_API_KEY is set on the server for the API route.');
       toast({ title: "Configuration Error", description: "OpenAI API key missing for transcription.", variant: "destructive" });
       setIsProcessingTranscript(false);
       return;
    }
    
    try {
      toast({ title: "Transcribing with Whisper...", description: "Sending audio for transcription."});
      const response = await axios.post('/api/transcribe', formData, { headers });
      toast({ title: "Whisper Transcription Successful", description: "Audio transcribed. Now parsing with AI..."});
      handleParseTextWithAI(response.data.text); 
    } catch (err: any) {
      console.error('Error transcribing audio (client):', err);
      let displayMessage = 'An unknown transcription error occurred. Check console.';
       if (err.response) {
        let serverError = err.response.data?.error; 
        if (serverError) {
             displayMessage = serverError;
        } else {
            displayMessage = `Request failed with status code ${err.response.status}. ${err.message || ''}`.trim();
        }
      } else if (err.request) {
        displayMessage = "Transcription request made but no response received. Check network or server status."
      } else {
        displayMessage = err.message || displayMessage;
      }
      setError(`Transcription failed: ${displayMessage}`);
      toast({ title: "Transcription Error", description: `Details: ${displayMessage}`, variant: "destructive", duration: 10000 });
    } finally {
      setIsProcessingTranscript(false); 
    }
  };

  const handleSaveAllTasks = async () => {
    if (editableVoiceTasks.length === 0) {
      setError('No task details found. Please speak or record your task(s).');
      toast({ title: "Validation Error", description: "No task details to save.", variant: "destructive"});
      return;
    }
    setIsSaving(true);
    setError(null);

    if (editableVoiceTasks.some(t => !t.title.trim())) {
        setError('One or more tasks have no title. Please ensure titles are parsed correctly or edit them.');
        toast({ title: "Validation Error", description: "One or more tasks are missing a title.", variant: "destructive" });
        setIsSaving(false);
        return;
    }

    let createdTasksBatch: DisplayTask[] = [];
    let creationErrors: string[] = [];
    let totalAICostForBatch = 0;

    for (const pTask of editableVoiceTasks) {
      const taskData: TaskFormData = {
        title: pTask.title,
        description: pTask.description || "Recorded via voice input.", 
        dueDate: pTask.dueDate || new Date(), 
        priority: pTask.priority || 'Medium', 
        category: pTask.category || 'Personal', 
        tags: [], 
      };

      try {
        const result = await createTaskWithAIPrioritization(taskData, settings);
        if (result.task) {
          createdTasksBatch.push(result.task);
          totalAICostForBatch += result.task.aiData?.lastOperationCost || 0;
        } else {
          const errorMessage = result.error || result.aiError || `Failed to create task "${pTask.title}".`;
          creationErrors.push(errorMessage);
          console.error(`Error creating task "${pTask.title}":`, errorMessage);
        }
      } catch (err: any) {
        const errorMessage = `Failed to save task "${pTask.title}": ${err.message || 'Unknown error'}`;
        creationErrors.push(errorMessage);
        console.error(errorMessage, err);
      }
    }
    
    let finalToastTitle = "Processing Complete";
    let finalToastDescription = "";
    if (createdTasksBatch.length > 0) {
        onTasksCreated(createdTasksBatch); 
        finalToastDescription = `${createdTasksBatch.length} task(s) created. Total AI cost for this batch: $${totalAICostForBatch.toFixed(6)}. `;
    }
    if (creationErrors.length > 0) {
        finalToastTitle = createdTasksBatch.length > 0 ? "Partial Success" : "Error Saving Tasks";
        finalToastDescription += `${creationErrors.length} task(s) failed. ${creationErrors.join('; ')}`;
    }
    if (!finalToastDescription && createdTasksBatch.length === 0 && creationErrors.length === 0) {
        finalToastDescription = "No tasks were processed or found to save.";
    }

    toast({ title: finalToastTitle, description: finalToastDescription, variant: creationErrors.length > 0 ? "destructive" : "default", duration: 8000 });

    resetState(); 
    setIsSaving(false);
  };
  
  const activeButtonStyle = "bg-primary text-primary-foreground hover:bg-primary/90";

  const VoiceInputContent = (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap gap-2 items-center">
          {isSpeechRecognitionSupported && (
            <Button onClick={initiateVoiceCapture} disabled={isListening || isRecording || isProcessingTranscript || isSaving} className={cn(isListening && activeButtonStyle, "flex-1 sm:flex-none")} aria-label="Start voice recognition using Web Speech API">
              <Mic className="mr-2 h-4 w-4" />
              {isListening ? 'Listening...' : 'Speak (Web API)'}
            </Button>
          )}
          <Button onClick={isRecording ? stopAudioRecording : startAudioRecording} disabled={isListening || isProcessingTranscript || isSaving} variant={isRecording ? "destructive" : "outline"} className={cn(isRecording && "!bg-red-500 !text-white", "flex-1 sm:flex-none")} aria-label={isRecording ? "Stop audio recording" : "Start audio recording for Whisper transcription"}>
            {isRecording ? <StopCircle className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
            {isRecording ? 'Stop Recording' : 'Record (Whisper)'}
          </Button>
        </div>
      
      {isRecording && (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground p-2 rounded-md bg-muted">
          <TimerIcon className="h-4 w-4 animate-pulse" />
          <span>Time left: {recordingTimer}s</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-center">
          <AlertTriangle className="mr-2 h-4 w-4" /> {error}
        </div>
      )}

      {transcript && (
         <div>
           <Label htmlFor="voice-full-transcript" className="text-sm font-medium">Full Transcript (AI will parse this):</Label>
           <Textarea id="voice-full-transcript" value={transcript} readOnly rows={3} className="mt-1 bg-muted/30 resize-none text-sm"/>
         </div>
      )}
      
      {isProcessingTranscript && (
          <div className="flex items-center justify-center p-4 bg-muted rounded-md">
              <Brain className="mr-3 h-6 w-6 animate-pulse text-primary" />
              <p className="text-sm text-muted-foreground">AI is parsing transcript... This may take a moment.</p>
          </div>
      )}


      {editableVoiceTasks.length > 0 && !isProcessingTranscript && (
        <div className="space-y-4 p-4 border rounded-md bg-background">
          <h4 className="text-md font-semibold">Parsed Tasks ({editableVoiceTasks.length}):</h4>
          {editableVoiceTasks.map((task, index) => (
            <Card key={task.id} className="p-3 bg-muted/30 shadow-sm">
              <div className="space-y-2">
                <div>
                  <Label htmlFor={`voice-task-title-${index}`} className="text-xs font-medium">Task Title</Label>
                  <Input id={`voice-task-title-${index}`} value={task.title} onChange={(e) => handleVoiceTaskChange(task.id, 'title', e.target.value)} className="mt-1 h-8 text-sm bg-background" />
                </div>
                <div>
                  <Label htmlFor={`voice-task-description-${index}`} className="text-xs font-medium">Description (AI Context)</Label>
                  <Textarea id={`voice-task-description-${index}`} value={task.description} onChange={(e) => handleVoiceTaskChange(task.id, 'description', e.target.value)} rows={2} className="mt-1 text-xs resize-none bg-background" />
                </div>
                <div>
                  <Label htmlFor={`voice-due-date-${index}`} className="text-xs font-medium">Due Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal mt-1 h-8 text-xs bg-background">
                         <CalendarIconLucide className="mr-2 h-3.5 w-3.5" />
                        {task.dueDate ? format(task.dueDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[60]" side="bottom" align="start"> 
                      <Calendar mode="single" selected={task.dueDate} onSelect={(date) => handleVoiceTaskChange(task.id, 'dueDate', date ?? undefined)} initialFocus 
                       disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => removeEditableVoiceTask(task.id)} className="h-7 w-7" aria-label="Remove this parsed task">
                      <Trash2 className="h-4 w-4 text-destructive"/>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
           <Button variant="outline" size="sm" onClick={() => resetState(true)} className="mt-2">
              Clear Parsed Tasks
          </Button>
        </div>
      )}
      {(editableVoiceTasks.length > 0 || audioBlob) && !isProcessingTranscript && !isRecording && (
         <Button onClick={handleSaveAllTasks} disabled={isSaving || isListening || isRecording || editableVoiceTasks.length === 0} className="w-full !mt-6" aria-label="Save all parsed tasks">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving Tasks...' : `Add ${editableVoiceTasks.length} Task(s) with AI`}
          </Button>
      )}
    </div>
  );


  if (isEmbedded) {
    return VoiceInputContent;
  }

  return (
    <Card className="w-full shadow-md mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center">
          <AudioLines className="mr-2 h-5 w-5 text-primary"/> Add Task(s) by Voice
        </CardTitle>
        <CardDescription>
          Speak or record tasks. AI will attempt to parse into multiple tasks. Uses Web Speech API (if supported) or OpenAI Whisper. Recording is up to {RECORDING_DURATION_SECONDS} seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {VoiceInputContent}
      </CardContent>
    </Card>
  );
});

VoiceTaskInput.displayName = "VoiceTaskInput";
export { VoiceTaskInput };
