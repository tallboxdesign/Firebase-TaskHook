# Firebase Studio - TaskHook App

This is a Next.js application for managing tasks with AI-powered prioritization and n8n webhook integration.

## Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

2.  **Set up Environment Variables:**

    Create a `.env` file in the root of your project by copying the example:
    ```bash
    cp .env.example .env
    ```
    (If `.env.example` doesn't exist, create `.env` manually).

    You need to configure the following variables in your `.env` file:

    *   `GOOGLE_API_KEY`: Your Google AI (Gemini) API key. This is required for the AI prioritization and tag generation features using Google models. You can obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
        ```env
        GOOGLE_API_KEY="YOUR_GEMINI_API_KEY"
        ```
    *   `XAI_API_KEY`: (Optional) Your XAI API key if you plan to use XAI models (e.g., Grok). This is used by Genkit for XAI models. This should be set if you intend to select XAI models in the application settings.
        ```env
        XAI_API_KEY="YOUR_XAI_API_KEY"
        ```
    *   `OPENAI_API_KEY`: (Optional) Your OpenAI API key. This is required if you want to use the OpenAI Whisper API for audio task input (voice transcription fallback). If not set, audio recording will attempt to use the browser's built-in SpeechRecognition API, which may have limitations. You can obtain an API key from [OpenAI Platform](https://platform.openai.com/api-keys).
        ```env
        OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
        ```
    *   `N8N_WEBHOOK_URL`: (Optional) The URL for your n8n webhook where this application will **send** task data. If you configure this through the application's UI settings, the UI value will take precedence for webhook calls. Setting it here acts as a fallback.
        ```env
        N8N_WEBHOOK_URL="YOUR_N8N_OUTGOING_WEBHOOK_URL"
        ```
    *   `APP_INCOMING_WEBHOOK_HEADER_NAME`: (Recommended for security) The **name** of the HTTP header that your n8n workflow must send when it calls this application's incoming webhook (`/api/webhook/n8n-task-update`). This application will check for this header. Default if not set in settings: `X-TaskHook-Secret`.
        ```env
        APP_INCOMING_WEBHOOK_HEADER_NAME="X-Your-Custom-Header-Name"
        ```
    *   `APP_INCOMING_WEBHOOK_SECRET_VALUE`: (Recommended for security) The **value** for the HTTP header specified by `APP_INCOMING_WEBHOOK_HEADER_NAME`. This application will validate that the incoming header's value matches this secret.
        ```env
        APP_INCOMING_WEBHOOK_SECRET_VALUE="YOUR_STRONG_RANDOM_SECRET_TOKEN"
        ```
        See the "Securing the Incoming Webhook (from n8n)" section and the in-app Settings dialog for more details on how to set these up.

    **Important**: After adding or modifying environment variables in your `.env` file, you **must restart your development server** for the changes to take effect (e.g., stop `npm run dev` and run it again).


3.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```
    The application will be available at `http://localhost:9002` (or the port you configure).

4.  **Run Genkit development server (optional, for flow development/testing):**
    In a separate terminal:
    ```bash
    npm run genkit:dev
    ```

## Features

*   Create, view, complete, and delete tasks.
*   AI-powered task prioritization using Google Gemini or XAI models.
*   AI-powered tag generation for tasks.
*   Voice input for tasks using Web Speech API or OpenAI Whisper.
*   Task data sent to a configurable n8n webhook (outgoing).
*   Ability to receive task updates from n8n via a secured webhook (incoming).
*   Responsive design with light/dark mode support.
*   Tasks saved in browser's `localStorage`.
*   Configurable AI model selection and priority preferences.
*   Estimated AI cost tracking per operation and cumulative.

## Configuration

### AI API Keys
*   **Gemini API Key**: If using Google AI models, set `GOOGLE_API_KEY` in `.env`.
*   **XAI API Key**: If using XAI models, set `XAI_API_KEY` in `.env`.
*   **OpenAI API Key**: If using Whisper for transcription, set `OPENAI_API_KEY` in `.env`.

The application's backend (Genkit flows and API routes) will use these server-side keys. You can also provide an API key for the selected AI provider (Gemini or XAI) via the UI settings. This UI-provided key can be used for client-initiated Genkit flow calls if a corresponding server-side key for the selected provider is not found or if you wish to override it for specific calls originating from the UI. The server-side `OPENAI_API_KEY` is used by the `/api/transcribe` endpoint.

### n8n Webhook Integration

This application supports two-way communication with n8n:

#### 1. Outgoing Webhook (App -> n8n)
This is for sending task data from this application to your n8n workflow (e.g., when a task is created or updated).
*   **Configuration:**
    *   **Via UI:** In the app's Settings dialog, enter your n8n Webhook URL in the "Outgoing Webhook (App &rarr; n8n)" field. This URL is typically the trigger URL of your n8n workflow.
    *   **Via Environment Variable:** Set `N8N_WEBHOOK_URL` in your `.env` file as a fallback.
*   **Usage:** The UI-configured URL takes precedence.

#### 2. Incoming Webhook (n8n -> App)
This is for allowing your n8n workflow to send updates or new instructions back to this application.
*   **Application Endpoint:** This application listens for incoming POST requests at `/api/webhook/n8n-task-update`. The full URL (e.g., `https://your-app-domain.com/api/webhook/n8n-task-update` or `http://localhost:9002/api/webhook/n8n-task-update` during local development) is displayed in the app's Settings dialog under "Incoming Webhook (n8n &rarr; App)".
*   **Security (CRITICAL):** To ensure only your authorized n8n workflow can send data to this endpoint, you **must** secure it:
    1.  **Configure Header Name and Secret Value in App Settings:**
        *   In the app's Settings dialog, under "Incoming Webhook Security", define or generate a "Header Name for Secret" and a "Secret Value".
    2.  **Set Environment Variables on Your Server:**
        *   Set `APP_INCOMING_WEBHOOK_HEADER_NAME` in your `.env` file (or server environment) to the **exact Header Name** you configured in the app settings.
            ```env
            APP_INCOMING_WEBHOOK_HEADER_NAME="Your_Chosen_Or_Generated_Header_Name"
            ```
        *   Set `APP_INCOMING_WEBHOOK_SECRET_VALUE` in your `.env` file (or server environment) to the **exact Secret Value** you configured/generated in the app settings.
            ```env
            APP_INCOMING_WEBHOOK_SECRET_VALUE="Your_Chosen_Or_Generated_Secret_Value"
            ```
        *   Restart your Next.js application server after setting these. You can use the "Generate Secure Values" button in the app's Settings dialog to create these.
    3.  **Configure n8n HTTP Request Node:** In your n8n workflow, the HTTP Request node that sends data to this application's incoming webhook URL must include a header:
        *   Header Name: The exact string you set for `APP_INCOMING_WEBHOOK_HEADER_NAME` (and configured in app settings).
        *   Header Value: The exact secret string you set for `APP_INCOMING_WEBHOOK_SECRET_VALUE` (and configured/generated in app settings).
*   **Usage:** If the server environment variables are not set, or if the header name/value from n8n doesn't match what's expected by the server (based on these environment variables), the application will reject the request from n8n with an "Unauthorized" (401) or "Server Misconfiguration" (500) error.

## Building for Production
```bash
npm run build
npm run start
```
Ensure all required environment variables (`GOOGLE_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY`, `APP_INCOMING_WEBHOOK_HEADER_NAME`, `APP_INCOMING_WEBHOOK_SECRET_VALUE`, and optionally `N8N_WEBHOOK_URL`) are set in your production environment.
