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

let chatHistoryData = []; // لتخزين سجل الدردشة (مطلوب للحفاظ على السياق في المستقبل)

// --- Utility Functions ---

/**
 * يحسب زمن التأخير لآلية المحاولات المتزايدة.
 * @param {number} attempt - رقم المحاولة الحالي (0, 1, 2, ...).
 * @returns {number} - زمن التأخير بالمللي ثانية.
 */
function getDelay(attempt) {
    // 1000ms * 2^attempt
    return Math.pow(2, attempt) * 1000;
}

/**
 * يضيف رسالة إلى سجل الدردشة ويعرضها في الواجهة.
 * @param {string} text - نص الرسالة.
 * @param {string} sender - مرسل الرسالة ('user' أو 'gemini').
 * @param {Array<{uri: string, title: string}>} [sources=[]] - مصادر الاستدلال (فقط لـ gemini).
 */
function addMessage(text, sender, sources = []) {
    const row = document.createElement('div');
    row.classList.add('message-row', `message-${sender}`);

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble', `bubble-${sender}`);

    // استخدام innerHTML لدعم تنسيق Markdown (مثل **bold** و *italics*)
    bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    row.appendChild(bubble);

    // إضافة مصادر الاستدلال في حالة رسائل Gemini
    if (sender === 'gemini' && sources.length > 0) {
        const sourcesList = document.createElement('div');
        sourcesList.classList.add('sources-list');
        sourcesList.innerHTML = '<strong>المصادر:</strong>';

        sources.forEach(source => {
            const link = document.createElement('a');
            link.href = source.uri;
            link.target = '_blank';
            // عرض عنوان المصدر
            link.textContent = source.title || source.uri;
            sourcesList.appendChild(link);
        });
        bubble.appendChild(sourcesList);
    }

    chatHistory.appendChild(row);
    chatHistory.scrollTop = chatHistory.scrollHeight; // التمرير إلى الأسفل
}

/**
 * يضيف مؤشر التحميل (النقاط المتحركة) لرسالة Gemini.
 */
function appendLoadingDots() {
    removeLoadingDots(); // التأكد من إزالة أي مؤشر سابق

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

    // تعطيل الإدخال وزر الإرسال لمنع الإرسال المتعدد
    sendBtn.disabled = true;
    chatInput.disabled = true;
}

/**
 * يزيل مؤشر التحميل.
 */
function removeLoadingDots() {
    const loadingIndicator = chatHistory.querySelector('.loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
    // تفعيل الإدخال وزر الإرسال
    sendBtn.disabled = false;
    chatInput.disabled = false;
}

// --- API Interaction ---

/**
 * يتفاعل مع Gemini API لجلب الرد.
 * @param {string} prompt - استعلام المستخدم.
 */
async function fetchGeminiResponse(prompt) {
    // NOTE: The API key is assumed to be available in the environment or set up correctly
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // إعداد حمولة الطلب (Payload)
    const payload = {
        // نستخدم فقط الاستعلام الحالي في هذا التصميم البسيط
        contents: [{ parts: [{ text: prompt }] }],

        // تفعيل ميزة البحث (Grounding) - للاتصال بالإنترنت
        tools: [{ "google_search": {} }],

        // توجيه النموذج للرد باللغة العربية
        systemInstruction: {
            parts: [{ text: "You are a concise and helpful chat assistant. Answer the user's questions clearly based on the provided search results. The answer must be in Arabic." }]
        },
    };

    let response;
    let attempt = 0;

    // تطبيق آلية المحاولات المتزايدة (Exponential Backoff)
    while (attempt < MAX_ATTEMPTS) {
        try {
            console.log(`Attempt ${attempt + 1}: Fetching response from Gemini...`);
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // إذا كانت الاستجابة ناجحة (OK) نخرج من الحلقة
            if (response.ok) {
                break;
            } else if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
                // خطأ معدل الطلبات (Rate limit)، الانتظار وإعادة المحاولة
                const delay = getDelay(attempt);
                console.warn(`Rate limit (429) hit. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;
            } else {
                // خطأ آخر (4xx, 5xx) غير قابل للاسترداد
                const errorBody = await response.text();
                console.error(`API returned status ${response.status}: ${response.statusText}`, "Error Details:", errorBody);
                throw new Error(`API returned status ${response.status} (${response.statusText})`);
            }
        } catch (error) {
            console.error("Fetch/Network Error:", error);
            // إذا كانت هذه هي المحاولة الأخيرة، نطلق الخطأ
            if (attempt === MAX_ATTEMPTS - 1) {
                throw new Error("Failed to connect to the AI service after multiple retries.");
            }
            // الانتظار قبل المحاولة التالية لخطأ شبكة
            const delay = getDelay(attempt);
            console.warn(`Network failure. Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
        }
    }

    if (!response || !response.ok) {
        // إذا خرجنا من الحلقة دون استجابة ناجحة
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
                .filter(source => source.uri); // تصفية المصادر التي لا تحتوي على رابط
        }

        return { text, sources };

    } else {
        // حالة عدم وجود نص في الاستجابة (مثل حظر المحتوى)
        const blockReason = candidate?.finishReason || 'UNKNOWN';
        console.error("AI response lacked text content. Reason:", blockReason, result);
        throw new Error("AI did not provide a text response. Content was likely blocked or response was empty.");
    }
}

/**
 * معالج إرسال رسالة المستخدم.
 */
async function handleSend() {
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    // 1. إضافة رسالة المستخدم إلى الواجهة
    addMessage(prompt, 'user');
    chatHistoryData.push({ text: prompt, sender: 'user' });

    // 2. مسح حقل الإدخال
    chatInput.value = '';

    // 3. إضافة مؤشر التحميل
    appendLoadingDots();

    try {
        // 4. جلب الرد من Gemini
        const { text, sources } = await fetchGeminiResponse(prompt);

        // 5. إزالة مؤشر التحميل وإضافة رسالة Gemini
        removeLoadingDots();
        addMessage(text, 'gemini', sources);
        chatHistoryData.push({ text: text, sender: 'gemini' });

    } catch (error) {
        // 6. التعامل مع الأخطاء
        console.error("Critical Error during Gemini response:", error);

        // إظهار رسالة الخطأ للمستخدم
        addMessage(
            "عذراً، حدث خطأ أثناء جلب الرد. يرجى المحاولة مرة أخرى. (تفاصيل الخطأ: تحقق من Console)",
            'gemini'
        );
        chatHistoryData.push({ text: "Error: Failed to fetch response.", sender: 'gemini' });

    } finally {
        // 7. التأكد من إزالة مؤشر التحميل وتفعيل الإدخال
        removeLoadingDots();
        // إعادة التركيز على حقل الإدخال لسهولة الكتابة
        chatInput.focus();
    }
}

// --- Event Listeners and Initialization ---

// فتح/إغلاق نافذة الدردشة
chatIcon.addEventListener('click', () => {
    chatWindow.classList.toggle('open');
    if (chatWindow.classList.contains('open')) {
        chatInput.focus(); // التركيز عند الفتح
    }
});

// إغلاق نافذة الدردشة
closeChatBtn.addEventListener('click', () => {
    chatWindow.classList.remove('open');
});

// إرسال الرسالة عند النقر على الزر
sendBtn.addEventListener('click', handleSend);

// إرسال الرسالة عند الضغط على مفتاح Enter
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        e.preventDefault(); // منع الإضافة إلى سطر جديد
        handleSend();
    }
});

// وظيفة لتشغيل التعليمات البرمجية فور تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    console.log("Chat widget initialized. Ready to interact with Gemini API.");
});