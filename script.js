// --- Constants and Configuration ---
const model = 'gemini-2.5-flash-preview-09-2025';
// NOTE: The API key is automatically provided in this runtime environment.
// For production, you must use a secure server-side proxy to store your key.
const apiKey = "";
const MAX_ATTEMPTS = 3;

// --- DOM Elements ---
const chatIcon = document.getElementById('chat-icon');
const chatWindow = document.getElementById('chat-window');
const closeChatBtn = document.getElementById('close-chat');
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

let chatHistoryData = []; // Stores chat history (needed for context in future updates)

// --- Utility Functions ---

/**
 * Calculates delay time for exponential backoff mechanism.
 * @param {number} attempt - Current attempt number (0, 1, 2, ...).
 * @returns {number} - Delay time in milliseconds.
 */
function getDelay(attempt) {
    // 1000ms * 2^attempt
    return Math.pow(2, attempt) * 1000;
}

/**
 * Adds a message to the chat history and displays it in the UI.
 * @param {string} text - Message text.
 * @param {string} sender - Message sender ('user' or 'gemini').
 * @param {Array<{uri: string, title: string}>} [sources=[]] - Source attributions (only for gemini).
 */
function addMessage(text, sender, sources = []) {
    const row = document.createElement('div');
    row.classList.add('message-row', `message-${sender}`);

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble', `bubble-${sender}`);

    // Use innerHTML to support Markdown formatting (**bold**, *italics*)
    bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    row.appendChild(bubble);

    // Add source attributions for Gemini messages
    if (sender === 'gemini' && sources.length > 0) {
        const sourcesList = document.createElement('div');
        sourcesList.classList.add('sources-list');
        sourcesList.innerHTML = '<strong>Sources:</strong>';

        sources.forEach(source => {
            const link = document.createElement('a');
            link.href = source.uri;
            link.target = '_blank';
            // Display source title
            link.textContent = source.title || source.uri;
            sourcesList.appendChild(link);
        });
        bubble.appendChild(sourcesList);
    }

    chatHistory.appendChild(row);
    chatHistory.scrollTop = chatHistory.scrollHeight; // Scroll to bottom
}

/**
 * Adds loading indicator (animated dots) for Gemini message.
 */
function appendLoadingDots() {
    removeLoadingDots(); // Make sure to remove any previous indicator

    const row = document.createElement('div');
    row.classList.add('message-row', 'message-gemini', 'loading-indicator');

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble', 'bubble-gemini', 'loading-dots');
    bubble.innerHTML = `
    <div></div>
    <div></div> 
    <div></div> `;

    row.appendChild(bubble);
    chatHistory.appendChild(row);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Disable input and send button to prevent multiple sends
    sendBtn.disabled = true;
    chatInput.disabled = true;
}

/**
 * Removes loading indicator.
 */
function removeLoadingDots() {
    const loadingIndicator = chatHistory.querySelector('.loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    // Enable input and send button
    sendBtn.disabled = false;
    chatInput.disabled = false;
}

// --- API Interaction ---

/**
 * Interacts with Gemini API to fetch a response.
 * @param {string} prompt - User prompt.
 */
async function fetchGeminiResponse(prompt) {
    // NOTE: The API key is assumed to be available in the environment or set up correctly
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Prepare request payload
    const payload = {
        // Only using current prompt in this simple design
        contents: [{ parts: [{ text: prompt }] }],

        // Enable grounding feature for web search
        tools: [{ "google_search": {} }],

        // Direct model to reply in Arabic
        systemInstruction: {
            parts: [{ text: "You are a concise and helpful chat assistant. Answer the user's questions clearly based on the provided search results. The answer must be in Arabic." }]
        },
    };

    let response;
    let attempt = 0;

    // Exponential backoff mechanism
    while (attempt < MAX_ATTEMPTS) {
        try {
            console.log(`Attempt ${attempt + 1}: Fetching response from Gemini...`);
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // If response is OK, break the loop
            if (response.ok) {
                break;
            } else if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
                // Rate limiting error, wait and retry
                const delay = getDelay(attempt);
                console.warn(`Rate limit (429) hit. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;
            } else {
                // Other unrecoverable errors (4xx, 5xx)
                const errorBody = await response.text();
                console.error(`API returned status ${response.status}: ${response.statusText}`, "Error Details:", errorBody);
                throw new Error(`API returned status ${response.status} (${response.statusText})`);
            }
        } catch (error) {
            console.error("Fetch/Network Error:", error);
            // On last attempt, throw error
            if (attempt === MAX_ATTEMPTS - 1) {
                throw new Error("Failed to connect to the AI service after multiple retries.");
            }
            // Wait before next retry on network error
            const delay = getDelay(attempt);
            console.warn(`Network failure. Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }

    if (!response || !response.ok) {
        // If exited loop with no successful response
        throw new Error("Maximum retries reached or unrecoverable error occurred.");
    }

    // --- Process Response ---
    const result = await response.json();
    const candidate = result.candidates?.[0];

    if (candidate && candidate.content?.parts?.[0]?.text) {
        const text = candidate.content.parts[0].text;
        let sources = [];
        const groundingMetadata = candidate.groundingMetadata;

        if (groundingMetadata && groundingMetadata.groundingAttributions) {
            sources = groundingMetadata.groundingAttributions
                .map(attribution => ({
                    uri: attribution.web?.uri,
                    title: attribution.web?.title,
                }))
                .filter(source => source.uri); // Filter out sources without URL
        }

        return { text, sources };

    } else {
        // Case: No response text (e.g. content blocked)
        const blockReason = candidate?.finishReason || 'UNKNOWN';
        console.error("AI response lacked text content. Reason:", blockReason, result);
        throw new Error("AI did not provide a text response. Content was likely blocked or response was empty.");
    }
}

/**
 * Handles sending user messages.
 */
async function handleSend() {
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    // 1. Add user message to UI
    addMessage(prompt, 'user');
    chatHistoryData.push({ text: prompt, sender: 'user' });

    // 2. Clear input field
    chatInput.value = '';

    // 3. Add loading indicator
    appendLoadingDots();

    try {
        // 4. Fetch response from Gemini
        const { text, sources } = await fetchGeminiResponse(prompt);

        // 5. Remove loading indicator and add Gemini message
        removeLoadingDots();
        addMessage(text, 'gemini', sources);
        chatHistoryData.push({ text: text, sender: 'gemini' });

    } catch (error) {
        // 6. Handle errors
        console.error("Critical Error during Gemini response:", error);

        // Show error message to user
        addMessage(
            "Sorry, an error occurred while fetching the response. Please try again. (Error details: Check Console)",
            'gemini'
        );
        chatHistoryData.push({ text: "Error: Failed to fetch response.", sender: 'gemini' });

    } finally {
        // 7. Ensure loading indicator is removed and input is enabled
        removeLoadingDots();
        // Refocus input field for easier typing
        chatInput.focus();
    }
}

// --- Event Listeners and Initialization ---

// Open/Close chat window
chatIcon.addEventListener('click', () => {
    chatWindow.classList.toggle('open');
    if (chatWindow.classList.contains('open')) {
        chatInput.focus(); // Focus on open
    }
});

// Close chat window
closeChatBtn.addEventListener('click', () => {
    chatWindow.classList.remove('open');
});

// Send message on button click
sendBtn.addEventListener('click', handleSend);

// Send message on Enter keypress
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        e.preventDefault(); // Prevent new line
        handleSend();
    }
});

// Function to run code once the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("Chat widget initialized. Ready to interact with Gemini API.");
});