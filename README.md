# Code Health Checker

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
```

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
