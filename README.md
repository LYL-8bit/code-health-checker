# Code Health Checker

<img width="1494" height="1053" alt="屏幕截图 2026-05-16 235329" src="https://github.com/user-attachments/assets/aea943d6-a2f9-451d-b27b-fa803e3cf50c" />

🌐 **Live Demo:** https://code-health-checker-production-0304.up.railway.app

📦 **Built for IBM Bob Hackathon 2026**

A full-stack app that analyzes a public GitHub repository for common code health issues.

## Features

- Accepts a GitHub repository URL
- Fetches repository files through the GitHub API
- Reports:
  - hardcoded secrets
  - missing `try/catch` around risky async JavaScript/TypeScript code
  - TODO/FIXME comments
  - missing test coverage signals
  - `console.log` usage
- Returns issue severity levels: `HIGH`, `MEDIUM`, `LOW`
- React frontend with color-coded report display

## Project Structure

```text
backend/
  package.json
  src/server.js
frontend/
  package.json
  src/
    App.jsx
    main.jsx
    styles.css
```

## Backend

```bash
cd backend
npm install
npm run dev
```

The backend runs on `http://localhost:4000`.

Optional: create `backend/.env` and set `GITHUB_TOKEN` to increase GitHub API rate limits.

```bash
GITHUB_TOKEN=github_pat_your_token_here
PORT=4000

# Optional: Only needed in development environments without direct internet access
# Leave unset in production with direct internet access
# HTTP_PROXY=http://proxy-host:port
```

**Note:** The server uses native Node.js fetch by default (no proxy). If your development environment requires a proxy to access GitHub API, set the `HTTP_PROXY` environment variable. See `backend/PROXY_CONFIGURATION.md` for details.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## API

`POST /analyze`

Request:

```json
{
  "repoUrl": "https://github.com/owner/repo"
}
```

Response:

```json
{
  "repository": "owner/repo",
  "summary": {
    "totalIssues": 3,
    "high": 1,
    "medium": 1,
    "low": 1,
    "filesScanned": 42
  },
  "issues": [
    {
      "severity": "HIGH",
      "type": "Hardcoded Secret",
      "file": "src/config.js",
      "line": 4,
      "message": "Potential hardcoded secret detected."
    }
  ]
}
```
