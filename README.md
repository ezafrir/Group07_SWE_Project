## LLM Web Interface Prototype
SOFTWARE ENGINEERING | (14:332:452) Section 01 | [17380] at Rutgers University

**Authors:** Pravalika Chintakindi, Siddartha Tamma, Ruchi Kapse, Emma Zafrir, Srinidhi Ganeshan, Eileen Rashduni

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

## Project Structure
Group07_SWE_Project
│
├── server.js            # Express backend server
├── llmService.js        # Simulated LLM response generator
│
├── public               # Frontend files
│   ├── index.html
│   ├── landing.html
│   ├── app.js
│   ├── landing.js
│   └── style.css
│
├── spec                 # Jasmine unit tests
│   └── appSpec.js
│
└── README.md

## How to Run the Project
1. Clone the repository
   git clone <repo-url>
3. Navigate into the project folder
   cd Group07_SWE_Project-main
5. Install dependencies
   npm install
7. Start the server
   node server.js
9. Open the application in a browser: http://localhost:3000
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

