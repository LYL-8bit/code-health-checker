import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  SECRET_PATTERNS,
  calculateEntropy,
  hasHighEntropy,
  isPlaceholder,
  analyzeContext,
  shouldFilterByContext,
  isAllowlisted
} from './analyzers/secretPatterns.js';

const app = express();
const PORT = process.env.PORT || 4000;
const GITHUB_API = 'https://api.github.com';

// Optional: Use HTTP_PROXY environment variable if set (for development)
// In production with direct internet access, leave HTTP_PROXY unset
const HTTP_PROXY = process.env.HTTP_PROXY;

const CODE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py',
  '.java',
  '.go',
  '.rb',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.rs',
  '.swift',
  '.kt',
  '.scala',
  '.sh'
]);

const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const MAX_FILES_TO_SCAN = 250;
const MAX_FILE_BYTES = 250_000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/analyze', async (req, res) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      return res.status(400).json({ error: 'repoUrl is required.' });
    }

    const repo = parseGitHubRepoUrl(repoUrl);

    if (!repo) {
      return res.status(400).json({ error: 'Please provide a valid GitHub repository URL.' });
    }

    const report = await analyzeRepository(repo);
    res.json(report);
  } catch (error) {
    console.error('Analyze failed:', error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Repository analysis failed.',
      cause: error.cause?.message,
      stack: error.stack
    });
  }
});

async function analyzeRepository(repo) {
  const repository = await githubFetch(`/repos/${repo.owner}/${repo.name}`);
  const branch = repository.default_branch;
  const tree = await githubFetch(
    `/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );

  if (tree.truncated) {
    throw createHttpError(
      422,
      'Repository tree is too large for a complete scan. Try a smaller repository.'
    );
  }

  const candidateFiles = tree.tree
    .filter((item) => item.type === 'blob')
    .filter((item) => isScannableFile(item.path))
    .filter((item) => !isIgnoredPath(item.path))
    .filter((item) => !item.size || item.size <= MAX_FILE_BYTES)
    .slice(0, MAX_FILES_TO_SCAN);

  const files = await mapWithConcurrency(candidateFiles, 8, async (file) => ({
      path: file.path,
      content: await fetchFileContent(repo, file.path, branch)
    }));

  const issues = [];

  for (const file of files) {
    issues.push(...checkHardcodedSecrets(file));
    issues.push(...checkTodoComments(file));
    issues.push(...checkConsoleLogs(file));
    issues.push(...checkMissingTryCatch(file));
  }

  issues.push(...checkMissingTests(files));

  return {
    repository: `${repo.owner}/${repo.name}`,
    defaultBranch: branch,
    scannedAt: new Date().toISOString(),
    summary: summarizeIssues(issues, files.length),
    issues
  };
}

function parseGitHubRepoUrl(repoUrl) {
  try {
    const url = new URL(repoUrl.trim());

    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
      return null;
    }

    const [owner, repoName] = url.pathname.replace(/^\/+/, '').split('/');

    if (!owner || !repoName) {
      return null;
    }

    return {
      owner,
      name: repoName.replace(/\.git$/, '')
    };
  } catch {
    return null;
  }
}

async function githubFetch(path) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'code-health-checker',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {})
  };

  let response;
  
  // Use proxy if HTTP_PROXY environment variable is set
  // This allows the same code to work in both development (with proxy) and production (direct access)
  if (HTTP_PROXY) {
    // Use undici's fetch with ProxyAgent when proxy is configured
    const { fetch: undiciFetch, ProxyAgent } = await import('undici');
    const proxyAgent = new ProxyAgent(HTTP_PROXY);
    response = await undiciFetch(`${GITHUB_API}${path}`, {
      headers,
      dispatcher: proxyAgent
    });
  } else {
    // Use native Node.js fetch when no proxy is needed (production)
    response = await fetch(`${GITHUB_API}${path}`, { headers });
  }

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const message = details.message || `GitHub API request failed with ${response.status}.`;
    throw createHttpError(response.status, message);
  }

  return response.json();
}

async function fetchFileContent(repo, path, branch) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const data = await githubFetch(
    `/repos/${repo.owner}/${repo.name}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
  );

  if (!data.content || data.encoding !== 'base64') {
    return '';
  }

  return Buffer.from(data.content, 'base64').toString('utf8');
}

function isScannableFile(path) {
  return CODE_EXTENSIONS.has(getExtension(path));
}

function isIgnoredPath(path) {
  return /(^|\/)(node_modules|dist|build|coverage|vendor|\.git|\.next|out|target)\//.test(path);
}

function getExtension(path) {
  const match = path.match(/\.[^.\/]+$/);
  return match ? match[0].toLowerCase() : '';
}

function checkHardcodedSecrets(file) {
  const issues = [];
  const lines = file.content.split(/\r?\n/);
  
  // Iterate through each secret pattern
  for (const [patternName, patternConfig] of Object.entries(SECRET_PATTERNS)) {
    const {
      pattern,
      severity,
      type,
      description,
      requiresEntropyCheck,
      minEntropy,
      captureGroup
    } = patternConfig;
    
    lines.forEach((line, index) => {
      const match = line.match(pattern);
      
      if (!match) return;
      
      // Extract the actual secret value (use capture group if specified)
      const secretValue = captureGroup ? match[captureGroup] : match[0];
      
      // Skip if it's a known placeholder pattern
      if (isPlaceholder(secretValue)) return;
      
      // Skip if it's in the allowlist
      if (isAllowlisted(secretValue)) return;
      
      // Analyze the context of the line
      const context = analyzeContext(line);
      
      // Filter based on context (e.g., environment variables)
      if (shouldFilterByContext(context)) return;
      
      // If entropy check is required, verify the value has sufficient randomness
      if (requiresEntropyCheck) {
        const entropyThreshold = minEntropy || 3.5;
        if (!hasHighEntropy(secretValue, entropyThreshold)) {
          return; // Skip low-entropy values (likely not real secrets)
        }
      }
      
      // Calculate confidence level based on various factors
      const confidence = calculateConfidence(secretValue, context, requiresEntropyCheck);
      
      issues.push({
        severity,
        type,
        file: file.path,
        line: index + 1,
        message: description,
        confidence
      });
    });
  }
  
  return issues;
}

/**
 * Calculate confidence level for a detected secret
 * @param {string} secretValue - The detected secret value
 * @param {object} context - Context analysis result
 * @param {boolean} hasEntropyCheck - Whether entropy was checked
 * @returns {string} Confidence level: 'HIGH', 'MEDIUM', or 'LOW'
 */
function calculateConfidence(secretValue, context, hasEntropyCheck) {
  let confidence = 'HIGH';
  
  // Lower confidence if no entropy check was performed
  if (!hasEntropyCheck) {
    confidence = 'MEDIUM';
  }
  
  // Lower confidence if it appears to be test data
  if (context.isTestData) {
    confidence = confidence === 'HIGH' ? 'MEDIUM' : 'LOW';
  }
  
  // Lower confidence for short values (less likely to be real secrets)
  if (secretValue.length < 20) {
    confidence = confidence === 'HIGH' ? 'MEDIUM' : 'LOW';
  }
  
  // Increase confidence if entropy is very high
  if (hasEntropyCheck && calculateEntropy(secretValue) > 4.5) {
    confidence = 'HIGH';
  }
  
  return confidence;
}

function checkTodoComments(file) {
  return findLineIssues(file, [/\b(TODO|FIXME|HACK)\b/i], {
    severity: 'LOW',
    type: 'TODO Comment',
    message: 'Outstanding TODO-style comment found.'
  });
}

function checkConsoleLogs(file) {
  if (!JAVASCRIPT_EXTENSIONS.has(getExtension(file.path))) {
    return [];
  }

  return findLineIssues(file, [/\bconsole\.log\s*\(/], {
    severity: 'LOW',
    type: 'Console Log',
    message: 'console.log statement should be removed or replaced with structured logging.'
  });
}

function checkMissingTryCatch(file) {
  if (!JAVASCRIPT_EXTENSIONS.has(getExtension(file.path))) {
    return [];
  }

  const content = stripComments(file.content);
  const hasRiskyAsyncCode = /\b(await|fetch\s*\(|axios\.|Promise\.all\s*\(|async\s+function)\b/.test(content);
  const hasTryCatch = /\btry\s*\{[\s\S]*?\}\s*catch\s*\(/.test(content);

  if (!hasRiskyAsyncCode || hasTryCatch) {
    return [];
  }

  return [
    {
      severity: 'MEDIUM',
      type: 'Missing Try/Catch',
      file: file.path,
      line: firstMatchingLine(file.content, /\b(await|fetch\s*\(|axios\.|Promise\.all\s*\(|async\s+function)\b/),
      message: 'Risky async code found without an apparent try/catch block.'
    }
  ];
}

function checkMissingTests(files) {
  const testFiles = new Set(files.filter((file) => isTestFile(file.path)).map((file) => file.path));

  if (testFiles.size === 0) {
    return [
      {
        severity: 'MEDIUM',
        type: 'Missing Tests',
        file: null,
        line: null,
        message: 'No test files were found in the scanned repository files.'
      }
    ];
  }

  const issues = [];

  for (const file of files) {
    if (!JAVASCRIPT_EXTENSIONS.has(getExtension(file.path)) || isTestFile(file.path)) {
      continue;
    }

    const expectedNames = buildExpectedTestNames(file.path);
    const hasMatchingTest = expectedNames.some((name) => testFiles.has(name));

    if (!hasMatchingTest && !file.path.includes('/__tests__/')) {
      issues.push({
        severity: 'MEDIUM',
        type: 'Missing Tests',
        file: file.path,
        line: null,
        message: 'No nearby test file found for this source file.'
      });
    }
  }

  return issues.slice(0, 50);
}

function isTestFile(path) {
  return /(^|\/)(__tests__|test|tests|spec)\//i.test(path) || /\.(test|spec)\.[jt]sx?$/.test(path);
}

function buildExpectedTestNames(path) {
  const extension = getExtension(path);
  const base = path.slice(0, -extension.length);
  const fileName = base.split('/').pop();
  const directory = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : '';
  const prefix = directory ? `${directory}/` : '';

  return [
    `${base}.test${extension}`,
    `${base}.spec${extension}`,
    `${prefix}__tests__/${fileName}.test${extension}`,
    `${prefix}__tests__/${fileName}.spec${extension}`
  ];
}

function findLineIssues(file, patterns, issue) {
  const issues = [];
  const lines = file.content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      issues.push({
        ...issue,
        file: file.path,
        line: index + 1
      });
    }
  });

  return issues;
}

function firstMatchingLine(content, pattern) {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index === -1 ? null : index + 1;
}

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function summarizeIssues(issues, filesScanned) {
  return {
    totalIssues: issues.length,
    high: issues.filter((issue) => issue.severity === 'HIGH').length,
    medium: issues.filter((issue) => issue.severity === 'MEDIUM').length,
    low: issues.filter((issue) => issue.severity === 'LOW').length,
    filesScanned
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

app.listen(PORT, () => {
  console.log(`Code health checker API listening on http://localhost:${PORT}`);
});
