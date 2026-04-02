## LLM Web Interface Prototype
SOFTWARE ENGINEERING | (14:332:452) Section 01 | [17380] at Rutgers University

**Authors:** Pravalika Chintakindi, Siddhartha Tamma, Ruchi Kapse, Emma Zafrir, Srinidhi Ganeshan, Eileen Rashduni

## Project Description
This project is a web-based interface for interacting with a simulated LLM. Users can create accounts, log in, submit prompts, and receive generated responses. Conversations can be saved, bookmarked, searched, and revisited later.

## Features
- User account creation (signup)
- User login and logout
- Prompt submission to simulated LLM
- Generated responses to prompts
- Conversation history
- Bookmark conversations
- Remove bookmarks
- Search conversations
- Adjustable response length settings

## Technologies Used
Frontend
- HTML
- CSS
- JavaScript
Backend
- Node.js
- Express.js
- Express Session
Testing
- Jasmine (unit testing)
Other Tools
- GitHub
- Git

## How to Run the Project
1. Install Ollama if not already downloaded: https://ollama.com/download
2. Run llama3.2: 
   ollama pull llama3.2
3. Clone the repository:
   git clone <repo-url>
4. Navigate into the project folder:
   cd Group07_SWE_Project-main
5. Install dependencies:
   npm install
6. Start the server:
   node server.js
4. Open the application in a browser: http://localhost:3000

## Running Unit Tests
The project uses Jasmine for unit testing. Run tests using: npx jasmine
Example output: 13 specs, 0 failures

## REST API Endpoints
GET /api/me  
POST /api/signup  
POST /api/login  
POST /api/logout  
GET /api/conversations  
GET /api/conversations/:id  
POST /api/conversations  
DELETE /api/conversations/:id  
GET /api/bookmarks  
POST /api/bookmarks/:id  
DELETE /api/bookmarks/:id  
GET /api/settings  
PUT /api/settings/response-length  
GET /api/search?q=query

