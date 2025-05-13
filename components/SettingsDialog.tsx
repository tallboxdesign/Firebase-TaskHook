"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle as SettingsCardTitle } from "@/components/ui/card"; 
import { Switch } from "@/components/ui/switch"; // Import Switch
import { useToast } from "@/hooks/use-toast";
import type { SettingsValues, AIModelId, AIModelInfo } from '@/lib/types';
import { SUPPORTED_AI_MODELS, DEFAULT_AI_MODEL_ID, DEFAULT_SETTINGS } from '@/lib/types';
import { Info, Link, KeyRound, Cpu, DollarSign, BarChartBig, UploadCloud, DownloadCloud, Copy, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react'; // Added AlertTriangle
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: SettingsValues;
  onSettingsChange: (newSettings: SettingsValues) => void;
  lastBatchAICost?: number;
  cumulativeTotalAICost?: number;
}

const formatCurrency = (amount?: number, precision = 6) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '$0.000000';
    return `$${amount.toFixed(precision)}`;
};

const generateRandomString = (length = 32) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
};


export function SettingsDialog({ 
  isOpen, 
  onClose, 
  currentSettings, 
  onSettingsChange,
  lastBatchAICost,
  cumulativeTotalAICost 
}: SettingsDialogProps) {
  const [n8nOutgoingWebhookUrl, setN8nOutgoingWebhookUrl] = useState(currentSettings.n8nWebhookUrl || "");
  const [activeApiKey, setActiveApiKey] = useState(currentSettings.apiKey || ""); 
  const [openaiApiKey, setOpenaiApiKey] = useState(currentSettings.openaiApiKey || ""); 
  const [selectedModel, setSelectedModel] = useState<AIModelId>(currentSettings.selectedAIModel || DEFAULT_AI_MODEL_ID);
  const [appIncomingWebhookUrl, setAppIncomingWebhookUrl] = useState('');
  const [confirmTaskCreation, setConfirmTaskCreation] = useState(currentSettings.confirmTaskCreation ?? false); // Add state for confirmation toggle
  const [disableIncomingWebhookAuth, setDisableIncomingWebhookAuth] = useState(currentSettings.disableIncomingWebhookAuth ?? DEFAULT_SETTINGS.disableIncomingWebhookAuth ?? false); // Add state for disabling webhook auth
  
  // For user-configurable incoming webhook security
  const [n8nUserConfiguredIncomingHeaderName, setN8nUserConfiguredIncomingHeaderName] = useState(
    currentSettings.n8nUserConfiguredIncomingHeaderName || DEFAULT_SETTINGS.n8nUserConfiguredIncomingHeaderName || 'X-TaskHook-Secret' // Updated Default
  );
  const [n8nUserConfiguredIncomingSecret, setN8nUserConfiguredIncomingSecret] = useState(
    currentSettings.n8nUserConfiguredIncomingSecret || ''
  );
  
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setN8nOutgoingWebhookUrl(currentSettings.n8nWebhookUrl || "");
      setActiveApiKey(currentSettings.apiKey || "");
      setOpenaiApiKey(currentSettings.openaiApiKey || "");
      setSelectedModel(currentSettings.selectedAIModel || DEFAULT_AI_MODEL_ID);
      setConfirmTaskCreation(currentSettings.confirmTaskCreation ?? false); // Set state when dialog opens
      setDisableIncomingWebhookAuth(currentSettings.disableIncomingWebhookAuth ?? DEFAULT_SETTINGS.disableIncomingWebhookAuth ?? false); // Set state when dialog opens
      setN8nUserConfiguredIncomingHeaderName(currentSettings.n8nUserConfiguredIncomingHeaderName || DEFAULT_SETTINGS.n8nUserConfiguredIncomingHeaderName || 'X-TaskHook-Secret'); // Updated Default
      setN8nUserConfiguredIncomingSecret(currentSettings.n8nUserConfiguredIncomingSecret || '');

      if (typeof window !== 'undefined') {
        setAppIncomingWebhookUrl(`${window.location.origin}/api/webhook/n8n-task-update`);
      }
    }
  }, [currentSettings, isOpen]);

  const handleSave = () => {
    onSettingsChange({ 
      ...currentSettings, 
      n8nWebhookUrl: n8nOutgoingWebhookUrl, 
      apiKey: activeApiKey, 
      openaiApiKey, 
      selectedAIModel: selectedModel,
      confirmTaskCreation, // Save the confirmation setting
      disableIncomingWebhookAuth, // Save the disable webhook auth setting
      n8nUserConfiguredIncomingHeaderName,
      n8nUserConfiguredIncomingSecret,
    });
    toast({
      title: "Settings Saved",
      description: "Your settings have been updated.",
    });
    onClose();
  };

  const handleUrlValidation = (url: string): boolean => {
    if (!url) return true; 
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };
  
  const isOutgoingUrlValid = handleUrlValidation(n8nOutgoingWebhookUrl);

  const currentModelDetails: AIModelInfo | undefined = useMemo(() => {
    return SUPPORTED_AI_MODELS.find(model => model.id === selectedModel);
  }, [selectedModel]);

  const aiProviderApiKeyFieldLabel = currentModelDetails?.provider === 'XAI' ? 'XAI API Key (Optional)' : 'Gemini API Key (Optional)';
  
  const aiProviderApiKeyFieldDescription = currentModelDetails?.provider === 'XAI'
    ? "Your XAI API key. This is needed if you select an XAI model. Ensure XAI_API_KEY is set as an environment variable on the server."
    : "Your Google AI (Gemini) API key. Primarily, this should be set as GOOGLE_API_KEY environment variable on the server. This UI field allows overriding or providing it if the server variable isn't set AND the current model is NOT Google-provided.";
  
  const aiProviderApiKeyLearnMoreLink = currentModelDetails?.provider === 'XAI'
    ? "https://x.ai/developers" 
    : "https://aistudio.google.com/app/apikey";
   const aiProviderApiKeyLearnMoreText = currentModelDetails?.provider === 'XAI' ? "Get your XAI API Key" : "Get your Gemini API Key";

   const copyToClipboard = (text: string, message: string = "Copied to clipboard") => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({ title: message, description: "Ready to paste." });
      })
      .catch(err => {
        toast({ title: "Copy Failed", description: "Could not copy text.", variant: "destructive" });
        console.error('Failed to copy text: ', err);
      });
  };

  const handleGenerateSecureValues = () => {
    const newSecret = generateRandomString(32);
    const newHeaderName = `X-TaskHook-Secret-${generateRandomString(8)}`; // Updated Generation Logic
    setN8nUserConfiguredIncomingHeaderName(newHeaderName);
    setN8nUserConfiguredIncomingSecret(newSecret);
    const clipboardText = `Header Name: ${newHeaderName}
Secret Value: ${newSecret}`;
    copyToClipboard(clipboardText, "Secure Values Generated & Copied");
    toast({title: "Secure Values Generated", description:"Header name and secret copied. Remember to set these in your server environment variables."})
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]"> 
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
          <DialogDescription>
            Configure API keys, webhook URLs, AI models, and view cost overview. Changes are saved locally.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-3"> 
          
          <Card className="shadow-md">
            <CardHeader>
              <SettingsCardTitle className="text-lg font-semibold flex items-center">
                <BarChartBig className="mr-2 h-5 w-5 text-primary"/>
                AI Cost Overview
              </SettingsCardTitle>
              <DialogDescription>Estimated costs for AI operations based on token usage.</DialogDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col p-3 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">Last Batch Re-Prioritization Cost</span>
                <span className="text-lg font-semibold text-primary">
                  {formatCurrency(lastBatchAICost)}
                </span>
              </div>
              <div className="flex flex-col p-3 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">Cumulative AI Costs (All Tasks)</span>
                 <span className="text-lg font-semibold text-primary">
                  {formatCurrency(cumulativeTotalAICost)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Task Creation Settings Section */}
          <Card className="shadow-md">
             <CardHeader>
               <SettingsCardTitle className="text-lg font-semibold flex items-center">
                 <AlertTriangle className="mr-2 h-5 w-5 text-amber-600"/> {/* Use a suitable icon */}
                 Task Creation Behavior
               </SettingsCardTitle>
               <DialogDescription>Control how tasks are added to your list.</DialogDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                  <div className="space-y-0.5">
                    <Label htmlFor="confirm-task-creation" className="text-base">
                      Confirm Task Creation
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      If enabled, you must approve tasks before they are added.
                    </p>
                  </div>
                  <Switch
                    id="confirm-task-creation"
                    checked={confirmTaskCreation}
                    onCheckedChange={setConfirmTaskCreation}
                    aria-label="Toggle task creation confirmation"
                  />
                </div>
             </CardContent>
           </Card>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-1">
              <KeyRound className="h-5 w-5 text-primary" />
              <Label htmlFor="activeApiKey" className="text-base font-medium text-foreground">{aiProviderApiKeyFieldLabel}</Label>
            </div>
            <Input
              id="activeApiKey"
              type="password"
              value={activeApiKey} 
              onChange={(e) => setActiveApiKey(e.target.value)}
              placeholder={`Enter your ${currentModelDetails?.provider || 'AI Provider'} API Key`}
            />
            <p className="text-xs text-muted-foreground">
              {aiProviderApiKeyFieldDescription}
              {currentModelDetails?.provider === 'Google' && " If you set GOOGLE_API_KEY on the server, this field is optional."}
              {currentModelDetails?.provider === 'XAI' && " If you set XAI_API_KEY on the server, this field is optional."}
            </p>
             <a href={aiProviderApiKeyLearnMoreLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center">
              {aiProviderApiKeyLearnMoreText} <Link className="ml-1 h-3 w-3"/>
            </a>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-1">
              <KeyRound className="h-5 w-5 text-primary" />
              <Label htmlFor="openaiApiKey" className="text-base font-medium text-foreground">OpenAI API Key (Optional)</Label>
            </div>
            <Input
              id="openaiApiKey"
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="Enter your OpenAI API Key for Whisper"
            />
            <p className="text-xs text-muted-foreground">
              Used for audio transcription (Whisper API) if Web Speech API is not supported or for higher accuracy. Server-side `OPENAI_API_KEY` env variable takes precedence.
            </p>
             <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center">
              Get your OpenAI API Key <Link className="ml-1 h-3 w-3"/>
            </a>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2 mb-1">
              <Cpu className="h-5 w-5 text-primary" />
              <Label htmlFor="aiModel" className="text-base font-medium text-foreground">AI Model (Prioritization & Parsing)</Label>
            </div>
            <Select value={selectedModel} onValueChange={(value: AIModelId) => setSelectedModel(value)}>
              <SelectTrigger id="aiModel">
                <SelectValue placeholder="Select AI Model" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_AI_MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} ({model.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentModelDetails && (
              <div className="text-xs text-muted-foreground space-y-0.5 mt-1 bg-muted p-2 rounded-md">
                <p><strong>Provider:</strong> {currentModelDetails.provider}</p>
                <p><strong>Pricing (approx.):</strong></p>
                <ul className="list-disc list-inside pl-1">
                  {currentModelDetails.pricingSummary.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                  {currentModelDetails.pricing.notes && (
                     <li><em>{currentModelDetails.pricing.notes}</em></li>
                  )}\
                </ul>
                <p className="mt-1">{currentModelDetails.notes}</p>
              </div>
            )}\
          </div>
          
          <Card className="shadow-md">
            <CardHeader>
                <SettingsCardTitle className="text-lg font-semibold flex items-center">
                    <Link className="mr-2 h-5 w-5 text-primary"/>
                    n8n Webhook Configuration
                </SettingsCardTitle>
                <DialogDescription>Manage how this app interacts with your n8n workflows.</DialogDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <UploadCloud className="h-5 w-5 text-blue-600" />
                      <Label htmlFor="n8nOutgoingWebhookUrl" className="text-base font-medium text-foreground">Outgoing Webhook (App <span className="font-bold text-blue-600">&rarr;</span> n8n)</Label>
                    </div>
                    <Input
                      id="n8nOutgoingWebhookUrl"
                      value={n8nOutgoingWebhookUrl}
                      onChange={(e) => setN8nOutgoingWebhookUrl(e.target.value)}
                      placeholder="https://your-n8n-instance.com/webhook/your-path"
                      className={cn(!isOutgoingUrlValid && "border-destructive")}
                    />
                    {!isOutgoingUrlValid && (
                        <p className="text-sm text-destructive">Please enter a valid URL.</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enter the webhook URL from your n8n workflow's trigger node. This app will send task data <strong>to</strong> this URL when tasks are created, updated, or reprioritized.
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center space-x-2 mb-1">
                        <DownloadCloud className="h-5 w-5 text-green-600" />
                        <Label htmlFor="appIncomingWebhookUrl" className="text-base font-medium text-foreground">Incoming Webhook (n8n <span className="font-bold text-green-600">&rarr;</span> App)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Input
                            id="appIncomingWebhookUrl"
                            value={appIncomingWebhookUrl}
                            readOnly
                            className="bg-muted cursor-not-allowed flex-grow"
                        />
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(appIncomingWebhookUrl, "Incoming Webhook URL Copied")} aria-label="Copy incoming webhook URL">
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This is the URL your n8n workflow should use to send data <strong>back to this application</strong> (listens at <code>/api/webhook/n8n-task-update</code>).
                    </p>
                </div>

                {/* Disable Incoming Webhook Auth Toggle */}
                <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                  <div className="space-y-0.5">
                    <Label htmlFor="disable-incoming-webhook-auth" className="text-base flex items-center">
                      <AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> Disable Incoming Webhook Authentication
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Warning: If enabled, requests to <code>{appIncomingWebhookUrl || "/api/webhook/n8n-task-update"}</code> will NOT require the secret header.
                    </p>
                     <p className="text-xs text-destructive font-medium">
                      Only enable this if you understand the security risks or are in a trusted, isolated environment.
                    </p>
                  </div>
                  <Switch
                    id="disable-incoming-webhook-auth"
                    checked={disableIncomingWebhookAuth}
                    onCheckedChange={setDisableIncomingWebhookAuth}
                    aria-label="Toggle incoming webhook authentication"
                  />
                </div>

                <div className="space-y-3 p-3 border border-dashed rounded-md bg-muted/30">
                    <div className="flex items-center space-x-2 mb-1">
                        <ShieldCheck className="h-5 w-5 text-orange-600" />
                        <Label className="text-base font-medium text-foreground">Incoming Webhook Security</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        To secure your incoming webhook endpoint (<code>{appIncomingWebhookUrl || "/api/webhook/n8n-task-update"}</code>):
                    </p>
                    
                    <div className="space-y-1">
                        <Label htmlFor="n8nIncomingHeaderName" className="text-sm font-medium">Header Name for Secret</Label>
                        <Input
                            id="n8nIncomingHeaderName"
                            value={n8nUserConfiguredIncomingHeaderName}
                            onChange={(e) => setN8nUserConfiguredIncomingHeaderName(e.target.value)}
                            placeholder="e.g., X-TaskHook-Secret" // Updated Placeholder
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="n8nIncomingSecret" className="text-sm font-medium">Secret Value</Label>
                        <Input
                            id="n8nIncomingSecret"
                            type="password"
                            value={n8nUserConfiguredIncomingSecret}
                            onChange={(e) => setN8nUserConfiguredIncomingSecret(e.target.value)}
                            placeholder="Enter a strong, random secret"
                        />
                    </div>
                     <Button variant="outline" size="sm" onClick={handleGenerateSecureValues} className="mt-2">
                        <RefreshCw className="mr-2 h-4 w-4" /> Generate Secure Values
                    </Button>
                     {n8nUserConfiguredIncomingHeaderName && n8nUserConfiguredIncomingSecret && (
                        <div className="mt-2 p-2 border rounded-md bg-background text-xs">
                            <p className="font-medium">Generated/Configured Values (copied to clipboard if generated):</p>
                            <p><strong>Header Name:</strong> <code className="bg-muted px-1 rounded">{n8nUserConfiguredIncomingHeaderName}</code></p>
                            <p><strong>Secret Value:</strong> <code className="bg-muted px-1 rounded break-all">{n8nUserConfiguredIncomingSecret}</code></p>
                        </div>
                    )}

                   <p className="text-xs text-muted-foreground mt-2 font-semibold">Instructions:</p>
                    <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1.5 pl-2">
                        <li>
                            <strong>In your n8n workflow:</strong> Configure the HTTP Request node that sends data to this app. Add a header with the exact <strong>Header Name</strong> and <strong>Secret Value</strong> you've set above.
                        </li>
                        <li>
                            <strong>On your server (hosting this app):</strong> Set the following environment variables in your <code>.env</code> file (or your server's environment configuration):
                            <ul className="list-disc list-inside pl-4 mt-1 space-y-0.5">
                                <li><code>APP_INCOMING_WEBHOOK_HEADER_NAME="{n8nUserConfiguredIncomingHeaderName}"</code></li>
                                <li><code>APP_INCOMING_WEBHOOK_SECRET_VALUE="{n8nUserConfiguredIncomingSecret}"</code></li>
                            </ul>
                             Restart your application server after setting/changing these environment variables.
                        </li>
                    </ol>
                   <p className="text-xs text-muted-foreground mt-2">
                        If these configurations (n8n request and server environment variables) do not match, incoming requests will be rejected with an "Unauthorized" error.
                    </p>
                </div>
            </CardContent>
          </Card>

        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={!isOutgoingUrlValid}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
