import { type NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import os from 'os';
import path from 'path';

export async function POST(request: NextRequest) {
  const clientProvidedApiKey = request.headers.get('X-OpenAI-Key');
  const serverApiKey = process.env.OPENAI_API_KEY;

  let effectiveApiKey: string | undefined = undefined;
  let apiKeySource: string = "none";

  if (clientProvidedApiKey) {
    effectiveApiKey = clientProvidedApiKey;
    apiKeySource = "client_settings";
  } else if (serverApiKey) {
    effectiveApiKey = serverApiKey;
    apiKeySource = "server_env";
  }

  if (!effectiveApiKey) {
    console.error("OpenAI API Key not found. Source attempted:", apiKeySource, "Client provided:", !!clientProvidedApiKey, "Server env set:", !!serverApiKey);
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Please set it on the server via OPENAI_API_KEY environment variable or provide it in the app settings.' },
      { status: 500 }
    );
  }
  
  console.log(`Using OpenAI API Key from: ${apiKeySource}`);
  const openai = new OpenAI({
    apiKey: effectiveApiKey,
  });

  let tempFilePath: string | undefined = undefined; 

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file uploaded' }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    // Ensure a file extension is present, default to webm
    const fileExtension = audioFile.name.includes('.') ? audioFile.name.split('.').pop() : 'webm';
    const tempFileName = `audio-${Date.now()}.${fileExtension}`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    
    console.log(`Writing temporary audio file to: ${tempFilePath}`);
    await fs.promises.writeFile(tempFilePath, audioBuffer);
    console.log(`Temporary audio file written successfully: ${tempFilePath}`);
    
    console.log(`Attempting to transcribe audio file: ${tempFilePath} with model whisper-1`);
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });
    console.log("Transcription successful via OpenAI.");

    // Clean up temporary file on success
    if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath);
        console.log(`Temporary audio file ${tempFilePath} cleaned up on success.`);
    } else {
        console.warn(`Temporary audio file ${tempFilePath} not found for cleanup on success.`);
    }

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error('Detailed Transcription Error (Server):', error);
    
    // Log structured error information if available
    if (error.response && error.response.data) { // Axios-like error from a dependency (OpenAI client might use this)
      console.error('Error Response Data (e.g., from OpenAI HTTP client):', JSON.stringify(error.response.data, null, 2));
    }
    if (error.status) { // OpenAI SDK specific error structure
        console.error(`OpenAI SDK Error Details: Status: ${error.status}, Message: ${error.message}, Type: ${error.type}, Code: ${error.code}`);
    }
    if (error.stack) {
        console.error("Error Stack:", error.stack);
    }

    let errorMessage = `Failed to transcribe audio. Please check server logs for more details.`; // Default user-facing message
    
    if (error.status === 401) {
        errorMessage = "OpenAI API key is invalid or has insufficient permissions. Please verify the key used by the server or provided in settings.";
    } else if (error.status === 429) {
        errorMessage = "OpenAI API rate limit exceeded or quota is full. Please check your OpenAI account status and try again later.";
    } else if (error.status === 400) { 
        errorMessage = `OpenAI API Bad Request: ${error.message || 'Invalid audio data or request format. Ensure the audio is not empty and is in a supported format.'}`;
    } else if (error.status && error.message) { // Other OpenAI SDK errors
        errorMessage = `OpenAI API error (${error.status}): ${error.message}`;
    } else if (error.message) { // Generic error with a message
        errorMessage = `Transcription service error: ${error.message}`;
    }

    // Attempt to clean up temp file even on error, if it was created and path is known
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
        console.log(`Temporary audio file ${tempFilePath} cleaned up after error.`);
      } catch (cleanupError) {
        console.error(`Error cleaning up temp file ${tempFilePath} during error handling:`, cleanupError);
      }
    } else if (tempFilePath) {
        console.warn(`Temporary audio file ${tempFilePath} not found for cleanup during error handling.`);
    } else {
        console.log("Temporary audio file path was not defined; skipping cleanup on error.");
    }
    
    console.error(`Server returning 500 to client. Error message for client: "${errorMessage}"`);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
