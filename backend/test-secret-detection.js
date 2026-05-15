/**
 * Test script for enhanced secret detection
 * Run with: node test-secret-detection.js
 */

import {
  SECRET_PATTERNS,
  calculateEntropy,
  hasHighEntropy,
  isPlaceholder,
  analyzeContext,
  shouldFilterByContext,
  isAllowlisted
} from './src/analyzers/secretPatterns.js';

console.log('🧪 Testing Enhanced Secret Detection\n');

// Test 1: Entropy Calculation
console.log('Test 1: Entropy Calculation');
console.log('----------------------------');
const testStrings = [
  { str: 'password', expected: 'low' },
  { str: 'aK9$mP2#vL8@qR5!', expected: 'high' },
  { str: 'test123', expected: 'low' },
  { str: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', expected: 'high' }
];

testStrings.forEach(({ str, expected }) => {
  const entropy = calculateEntropy(str);
  const isHigh = hasHighEntropy(str, 3.5);
  console.log(`  "${str}"`);
  console.log(`    Entropy: ${entropy.toFixed(2)} (${isHigh ? 'HIGH' : 'LOW'}) - Expected: ${expected}`);
});

// Test 2: Placeholder Detection
console.log('\nTest 2: Placeholder Detection');
console.log('----------------------------');
const placeholders = [
  'your-api-key-here',
  'example_key',
  'xxxxxxxx',
  'AKIAIOSFODNN7EXAMPLE',
  'real_secret_key_abc123xyz'
];

placeholders.forEach(str => {
  const isPlaceholderResult = isPlaceholder(str);
  const isAllowlistedResult = isAllowlisted(str);
  console.log(`  "${str}": ${isPlaceholderResult || isAllowlistedResult ? '✓ FILTERED' : '✗ NOT FILTERED'}`);
});

// Test 3: Context Analysis
console.log('\nTest 3: Context Analysis');
console.log('----------------------------');
const contextTests = [
  'const apiKey = process.env.API_KEY;',
  'const secret = "hardcoded_secret_123";',
  'const testKey = "test_key_for_testing"; // example only',
  'const key = config.getApiKey();'
];

contextTests.forEach(line => {
  const context = analyzeContext(line);
  const shouldFilter = shouldFilterByContext(context);
  console.log(`  "${line.substring(0, 50)}..."`);
  console.log(`    Environment var: ${context.isEnvironmentVariable}`);
  console.log(`    Config import: ${context.isConfigImport}`);
  console.log(`    Test data: ${context.isTestData}`);
  console.log(`    Should filter: ${shouldFilter ? 'YES' : 'NO'}`);
});

// Test 4: Pattern Matching
console.log('\nTest 4: Pattern Matching');
console.log('----------------------------');
const patternTests = [
  { line: 'const key = "AKIAIOSFODNN7EXAMPLE";', expected: 'AWS Access Key' },
  { line: 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";', expected: 'GitHub Token' },
  { line: 'const stripe = "sk_live_abcdefghijklmnopqrstuvwxyz";', expected: 'Stripe API Key' },
  { line: 'const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";', expected: 'JWT Token' }
];

patternTests.forEach(({ line, expected }) => {
  let matched = false;
  let matchedType = '';
  
  for (const [name, config] of Object.entries(SECRET_PATTERNS)) {
    if (config.pattern.test(line)) {
      matched = true;
      matchedType = config.type;
      break;
    }
  }
  
  console.log(`  "${line.substring(0, 50)}..."`);
  console.log(`    Expected: ${expected}`);
  console.log(`    Detected: ${matched ? matchedType : 'NONE'} ${matched && matchedType === expected ? '✓' : '✗'}`);
});

// Test 5: False Positive Reduction
console.log('\nTest 5: False Positive Reduction');
console.log('----------------------------');
const falsePositiveTests = [
  { line: 'const apiKey = getApiKeyFromEnv();', shouldDetect: false },
  { line: 'const password = "your-password-here";', shouldDetect: false },
  { line: 'const secret = "AKIAIOSFODNN7EXAMPLE"; // AWS example', shouldDetect: false },
  { line: 'const realKey = "AKIAJ5GZCMXYZ7EXAMPLE";', shouldDetect: false }, // Contains EXAMPLE - should be filtered
  { line: 'const realKey = "AKIAJ5GZCMXYZ7ABCDE";', shouldDetect: true } // Real-looking AWS key format
];

falsePositiveTests.forEach(({ line, shouldDetect }) => {
  let detected = false;
  
  for (const [name, config] of Object.entries(SECRET_PATTERNS)) {
    const match = line.match(config.pattern);
    if (match) {
      const value = config.captureGroup ? match[config.captureGroup] : match[0];
      const context = analyzeContext(line);
      
      if (!isPlaceholder(value) && 
          !isAllowlisted(value) && 
          !shouldFilterByContext(context)) {
        if (!config.requiresEntropyCheck || hasHighEntropy(value, config.minEntropy || 3.5)) {
          detected = true;
          break;
        }
      }
    }
  }
  
  const result = detected === shouldDetect ? '✓' : '✗';
  console.log(`  ${result} "${line.substring(0, 60)}..."`);
  console.log(`    Expected: ${shouldDetect ? 'DETECT' : 'SKIP'}, Got: ${detected ? 'DETECT' : 'SKIP'}`);
});

console.log('\n✅ Test suite completed!\n');

// Made with Bob
