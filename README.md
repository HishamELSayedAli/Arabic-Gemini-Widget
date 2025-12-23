# 🤖 Arabic Gemini Chat 

Welcome to the **Arabic-Gemini-Widget** repository!

This project is a fully interactive and self-contained **chat widget** built with a simple, vanilla frontend (HTML, CSS, JS). It connects directly to the **Gemini API** and is specifically designed to support the Arabic language (RTL) with built-in internet search capabilities.

---

## ✨ Core Features

* **Full RTL Support:** CSS styling is configured to fully support Right-to-Left (RTL) text direction, ideal for Arabic and other RTL languages.
* **Direct AI Connection:** Uses the **Gemini API** (`gemini-2.5-flash` model) for generating responses.
* **Internet Grounding:** The Google Search tool (`Google Search`) is enabled to provide the model with up-to-date and contextual information. 
* **Robust Error Handling:** Implements an **Exponential Backoff** mechanism to gracefully handle rate limit (429) and network errors during API calls.
* **Vanilla Frontend:** Built exclusively using **HTML, CSS, and plain JavaScript**, requiring no external frontend frameworks.

---

## 🛠 Tech Stack

| Technology | Role |
| :--- | :--- |
| **HTML5 & CSS3** | Frontend structure and styling (including RTL layout). |
| **JavaScript (ES6+)** | Interaction logic, DOM manipulation, and API integration. |
| **Google Gemini API** | AI model used for generating chat responses. |
| **Google Search Grounding** | Enables real-time information retrieval for answers. |

---

## ⚙️ Getting Started

To get the chat widget working locally, you must obtain and configure your Gemini API key.

### 1. Clone the Repository
---

### 2. Get Your Gemini API Key
Visit the official Google AI Studio website to generate and copy your API key.
---
### 3. Configure the Key in script.js
Open the script.js file and replace the placeholder value in the apiKey variable with your actual key:
JavaScript

// script.js
const apiKey = "AIzaSy...YOUR_FULL_API_KEY_GOES_HERE"; 
---
### 4. Run the Widget
Simply open the chat.html file directly in your web browser.
---
🔒 Security Notice (Critical)
This project, in its current form, exposes your API key directly in the client-side JavaScript code.

⚠️ This approach is highly insecure and is strictly for local development and testing purposes only.

DO NOT deploy this code to a public production environment without taking the following security measures:

Use a Backend Proxy: Implement a server-side proxy (e.g., using Node.js, Python Flask) to store the API key securely as an environment variable and handle all calls to the Gemini API.

Restrict the Key: Limit the API key's capabilities in the Google Cloud settings to accept requests only from specific IP addresses or domains.
---
📂 Project Structure
The project has a simple structure focused on frontend components:

Arabic-Gemini-Widget/
            
            ├── chat.html           # Main HTML structure for the chat interface.
            
            ├── style.css           # Styling for the widget (includes RTL adjustments).
            
            ├── script.js           # Core logic, API interaction, and error handling.
            
            ├── jquery-3.6.1.min.js # Helper library (if used).
            
            ├── img/                # Image assets folder.
            
            └── README.md           # Project documentation.


---

> **Developed by [HishamELSayedAli](https://github.com/HishamELSayedAli)**
