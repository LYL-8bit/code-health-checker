/**
 * Enhanced secret detection patterns with entropy analysis
 * Reduces false positives while improving detection coverage
 */

/**
 * Comprehensive secret pattern database
 * Each pattern includes severity, type, and optional entropy requirements
 */
export const SECRET_PATTERNS = {
  // AWS Credentials
  awsAccessKey: {
    pattern: /\b(AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|APKA)[A-Z0-9]{16}\b/,
    severity: 'HIGH',
    type: 'AWS Access Key',
    description: 'AWS Access Key ID detected'
  },
  
  awsSecretKey: {
    pattern: /aws[_-]?secret[_-]?access[_-]?key['"]?\s*[:=]\s*['"]([A-Za-z0-9/+=]{40})['"]]/i,
    severity: 'HIGH',
    type: 'AWS Secret Key',
    description: 'AWS Secret Access Key detected',
    captureGroup: 1
  },
  
  // GitHub Tokens
  githubToken: {
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/,
    severity: 'HIGH',
    type: 'GitHub Token',
    description: 'GitHub Personal Access Token detected'
  },
  
  githubOAuthToken: {
    pattern: /\bgho_[A-Za-z0-9_]{36,}\b/,
    severity: 'HIGH',
    type: 'GitHub OAuth Token',
    description: 'GitHub OAuth Access Token detected'
  },
  
  // Private Keys
  privateKey: {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
    severity: 'HIGH',
    type: 'Private Key',
    description: 'Private cryptographic key detected'
  },
  
  // Generic API Keys (with entropy check)
  genericApiKey: {
    pattern: /\b(?:api[_-]?key|apikey|api_secret|secret[_-]?key)\b\s*[:=]\s*['"]([^'"\n]{16,})['"]]/i,
    severity: 'HIGH',
    type: 'API Key',
    description: 'Potential API key detected',
    requiresEntropyCheck: true,
    minEntropy: 3.5,
    captureGroup: 1
  },
  
  // Database Connection Strings
  databaseUrl: {
    pattern: /\b(?:mongodb|mysql|postgresql|postgres):\/\/[^:]+:([^@\s'"]+)@[^\s'"]+/i,
    severity: 'HIGH',
    type: 'Database Connection String',
    description: 'Database connection string with credentials detected',
    captureGroup: 1
  },
  
  // Slack Tokens
  slackToken: {
    pattern: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,}\b/,
    severity: 'HIGH',
    type: 'Slack Token',
    description: 'Slack API token detected'
  },
  
  // Stripe Keys
  stripeKey: {
    pattern: /\b(sk|pk)_(test|live)_[A-Za-z0-9]{24,}\b/,
    severity: 'HIGH',
    type: 'Stripe API Key',
    description: 'Stripe API key detected'
  },
  
  // Generic Passwords (with entropy check)
  genericPassword: {
    pattern: /\b(?:password|passwd|pwd)\b\s*[:=]\s*['"]([^'"\n]{8,})['"]]/i,
    severity: 'MEDIUM',
    type: 'Password',
    description: 'Potential hardcoded password detected',
    requiresEntropyCheck: true,
    minEntropy: 3.0,
    captureGroup: 1
  },
  
  // JWT Tokens
  jwtToken: {
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    severity: 'HIGH',
    type: 'JWT Token',
    description: 'JSON Web Token detected'
  },
  
  // Generic Tokens (with entropy check)
  genericToken: {
    pattern: /\b(?:token|auth[_-]?token|access[_-]?token|bearer)\b\s*[:=]\s*['"]([^'"\n]{20,})['"]]/i,
    severity: 'MEDIUM',
    type: 'Token',
    description: 'Potential authentication token detected',
    requiresEntropyCheck: true,
    minEntropy: 3.5,
    captureGroup: 1
  },
  
  // Google API Keys
  googleApiKey: {
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
    severity: 'HIGH',
    type: 'Google API Key',
    description: 'Google API key detected'
  },
  
  // Azure Keys
  azureKey: {
    pattern: /\b[0-9a-zA-Z]{88}==\b/,
    severity: 'HIGH',
    type: 'Azure Key',
    description: 'Potential Azure storage key detected',
    requiresEntropyCheck: true,
    minEntropy: 4.0
  }
};

/**
 * Common false positive patterns to filter out
 */
export const FALSE_POSITIVE_PATTERNS = [
  /\b(?:example|sample|test|demo|placeholder|your[_-]?key|my[_-]?key|dummy)\b/i,
  /\b(?:xxx+|yyy+|zzz+|aaa+|111+|000+)\b/i,
  /^[*]+$/,
  /^[x]+$/i,
  /^[.]+$/,
  /\b(?:replace|change|insert|enter|put|add)[_-]?(?:this|here|your|key|token|password)\b/i,
  /\b(?:to[_-]?be[_-]?replaced|fill[_-]?in|update[_-]?this)\b/i,
  /^(test|admin|password|secret|key)123+$/i
];

/**
 * Calculate Shannon entropy of a string
 * Higher entropy indicates more randomness (likely a real secret)
 * 
 * @param {string} str - String to analyze
 * @returns {number} Entropy value (typically 0-5 for text)
 */
export function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;
  
  const frequencies = {};
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  
  for (const freq of Object.values(frequencies)) {
    const probability = freq / len;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Check if a string has sufficient entropy to be considered a secret
 * 
 * @param {string} str - String to check
 * @param {number} minEntropy - Minimum entropy threshold (default: 3.5)
 * @returns {boolean} True if entropy is high enough
 */
export function hasHighEntropy(str, minEntropy = 3.5) {
  const entropy = calculateEntropy(str);
  return entropy >= minEntropy;
}

/**
 * Check if string matches common placeholder patterns
 * 
 * @param {string} str - String to check
 * @returns {boolean} True if it's likely a placeholder
 */
export function isPlaceholder(str) {
  if (!str) return false;
  
  // Check against known false positive patterns
  if (FALSE_POSITIVE_PATTERNS.some(pattern => pattern.test(str))) {
    return true;
  }
  
  // Check for repeated characters (e.g., "xxxxxxxx")
  if (/^(.)\1{7,}$/.test(str)) {
    return true;
  }
  
  // Check for sequential patterns
  if (/^(abc|123|xyz)+$/i.test(str)) {
    return true;
  }
  
  return false;
}

/**
 * Analyze the context around a potential secret to reduce false positives
 * 
 * @param {string} line - The line containing the match
 * @returns {object} Context analysis result
 */
export function analyzeContext(line) {
  const context = {
    isEnvironmentVariable: false,
    isConfigImport: false,
    isTestData: false,
    hasComment: false,
    commentText: ''
  };
  
  // Check if value comes from environment
  if (/process\.env|os\.getenv|ENV\[|getenv\(|System\.getenv/i.test(line)) {
    context.isEnvironmentVariable = true;
  }
  
  // Check if it's a config import or function call
  if (/require\(['"].*config|import.*from.*config|config\.|getConfig\(|loadConfig\(/i.test(line)) {
    context.isConfigImport = true;
  }
  
  // Check for test-related keywords
  if (/\b(test|mock|stub|fake|fixture|example|dummy)\b/i.test(line)) {
    context.isTestData = true;
  }
  
  // Check for explanatory comments
  const commentMatch = line.match(/\/\/\s*(.+)$|\/\*\s*(.+?)\s*\*\//);
  if (commentMatch) {
    context.hasComment = true;
    context.commentText = commentMatch[1] || commentMatch[2] || '';
    
    // If comment mentions it's an example/placeholder
    if (/\b(example|placeholder|replace|change|sample|todo|fixme)\b/i.test(context.commentText)) {
      context.isTestData = true;
    }
  }
  
  return context;
}

/**
 * Determine if a match should be filtered based on context
 * 
 * @param {object} context - Context analysis result
 * @returns {boolean} True if should be filtered out
 */
export function shouldFilterByContext(context) {
  // Filter out environment variables
  if (context.isEnvironmentVariable) return true;
  
  // Filter out config imports
  if (context.isConfigImport) return true;
  
  return false;
}

/**
 * Default allowlist for known safe values
 */
export const DEFAULT_ALLOWLIST = [
  // Common example values
  'your-api-key-here',
  'your_api_key',
  'example_key',
  'test_key',
  'sample_token',
  'placeholder',
  'insert-key-here',
  
  // Common test values
  'test123',
  'password123',
  'admin123',
  
  // Documentation examples (official examples from providers)
  'sk_test_4eC39HqLyjWDarjtT1zdp7dc', // Stripe test key format
  'AKIAIOSFODNN7EXAMPLE', // AWS example key
  'AKIAJ5GZCMXYZ7EXAMPLE', // AWS example key variant
  'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // GitHub placeholder
  'example', // Generic example marker
];

/**
 * Check if a value is in the allowlist
 * 
 * @param {string} value - Value to check
 * @param {string[]} customAllowlist - Additional allowlist items
 * @returns {boolean} True if value is allowlisted
 */
export function isAllowlisted(value, customAllowlist = []) {
  if (!value) return false;
  
  const fullAllowlist = [...DEFAULT_ALLOWLIST, ...customAllowlist];
  const normalizedValue = value.toLowerCase();
  
  return fullAllowlist.some(item => 
    normalizedValue.includes(item.toLowerCase()) ||
    item.toLowerCase().includes(normalizedValue)
  );
}

// Made with Bob
