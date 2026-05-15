# Proxy Configuration Guide

## Overview

The server has been updated to support **optional proxy configuration** via environment variables. This allows the same codebase to work in both:
- **Development environments** that require a proxy to access GitHub API
- **Production environments** with direct internet access (no proxy needed)

## Changes Made

### 1. Removed Hardcoded Proxy
**Before:**
```javascript
import { fetch, ProxyAgent } from 'undici';
const proxyAgent = new ProxyAgent('http://192.168.1.128:10810');
// Always used proxy
```

**After:**
```javascript
// No hardcoded proxy
// Uses environment variable HTTP_PROXY if set
// Falls back to native fetch without proxy
```

### 2. Dynamic Proxy Loading
The proxy is now loaded dynamically only when needed:

```javascript
if (HTTP_PROXY) {
  // Development: Use undici with proxy
  const { fetch: undiciFetch, ProxyAgent } = await import('undici');
  const proxyAgent = new ProxyAgent(HTTP_PROXY);
  response = await undiciFetch(url, { headers, dispatcher: proxyAgent });
} else {
  // Production: Use native Node.js fetch (no proxy)
  response = await fetch(url, { headers });
}
```

## Configuration

### Production Deployment (Direct Internet Access)

**No configuration needed!** Simply deploy the code as-is:

```bash
# Install dependencies
npm install

# Start server (no proxy)
npm start
```

The server will use native Node.js fetch to access GitHub API directly.

### Development Environment (Requires Proxy)

Set the `HTTP_PROXY` environment variable:

**Option 1: Environment Variable**
```bash
export HTTP_PROXY=http://your-proxy-host:port
npm run dev
```

**Option 2: .env File**
```bash
# backend/.env
PORT=4000
GITHUB_TOKEN=your_token_here
HTTP_PROXY=http://192.168.1.128:10810
```

**Option 3: Inline**
```bash
HTTP_PROXY=http://192.168.1.128:10810 npm run dev
```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | No | Server port (default: 4000) | `4000` |
| `GITHUB_TOKEN` | No | GitHub API token for higher rate limits | `ghp_xxx...` |
| `HTTP_PROXY` | No | HTTP proxy URL (only if needed) | `http://proxy.example.com:8080` |

## Testing

### Test Without Proxy (Production Mode)
```bash
# Unset proxy variable
unset HTTP_PROXY

# Start server
npm start

# Test
curl -X POST http://localhost:4000/analyze \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/octocat/Hello-World"}'
```

### Test With Proxy (Development Mode)
```bash
# Set proxy
export HTTP_PROXY=http://your-proxy:port

# Start server
npm run dev

# Test
curl -X POST http://localhost:4000/analyze \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/octocat/Hello-World"}'
```

## Deployment Checklist

### For Production Servers (Direct Internet Access)

- [ ] Ensure `HTTP_PROXY` is **NOT** set in environment
- [ ] Verify server can reach `https://api.github.com` directly
- [ ] Test with: `curl -I https://api.github.com`
- [ ] Deploy code as-is (no proxy configuration needed)
- [ ] Optionally set `GITHUB_TOKEN` for higher API rate limits

### For Development Environments (Behind Proxy)

- [ ] Set `HTTP_PROXY` environment variable
- [ ] Ensure proxy allows HTTPS connections
- [ ] Test proxy with: `curl -x $HTTP_PROXY https://api.github.com`
- [ ] Start server with proxy configuration

## Troubleshooting

### Error: "fetch failed" or "SSL routines" error

**Cause:** Proxy configuration issue or network restrictions

**Solutions:**
1. **Production:** Ensure `HTTP_PROXY` is NOT set
   ```bash
   unset HTTP_PROXY
   ```

2. **Development:** Verify proxy URL is correct
   ```bash
   # Test proxy manually
   curl -x http://your-proxy:port https://api.github.com
   ```

3. **Check network access:**
   ```bash
   # Without proxy
   curl -I https://api.github.com
   
   # With proxy
   curl -x $HTTP_PROXY -I https://api.github.com
   ```

### Error: "Cannot find module 'undici'"

**Cause:** Missing dependency

**Solution:**
```bash
npm install
```

### Rate Limiting Issues

**Cause:** GitHub API rate limits (60 requests/hour without token)

**Solution:** Set `GITHUB_TOKEN` environment variable
```bash
# Get token from: https://github.com/settings/tokens
export GITHUB_TOKEN=ghp_your_token_here
```

## Architecture

```
┌─────────────────────────────────────────┐
│         GitHub API Request              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │  HTTP_PROXY?   │
         └────────┬───────┘
                  │
         ┌────────┴────────┐
         │                 │
    YES  │                 │  NO
         ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│  Undici Fetch   │  │  Native Fetch    │
│  + ProxyAgent   │  │  (Direct)        │
└─────────────────┘  └──────────────────┘
         │                 │
         └────────┬────────┘
                  │
                  ▼
         ┌────────────────┐
         │  GitHub API    │
         └────────────────┘
```

## Benefits

✅ **No hardcoded configuration** - Works in any environment
✅ **Production-ready** - No proxy overhead when not needed
✅ **Development-friendly** - Easy proxy configuration when required
✅ **Flexible** - Same codebase for all environments
✅ **Secure** - No sensitive proxy URLs in code

## Migration from Old Code

**Old code (hardcoded proxy):**
```javascript
const proxyAgent = new ProxyAgent('http://192.168.1.128:10810');
// Always used this proxy
```

**New code (configurable):**
```javascript
const HTTP_PROXY = process.env.HTTP_PROXY;
// Uses proxy only if HTTP_PROXY is set
// Otherwise uses native fetch (no proxy)
```

**Action required:** None for production! Just deploy.

For development, set `HTTP_PROXY` environment variable if needed.