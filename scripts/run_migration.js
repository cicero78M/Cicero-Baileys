#!/usr/bin/env node
/**
 * Migration Runner Script
 * 
 * This script safely runs SQL migration files with validation and error handling.
 * It prevents common issues like HTML-encoded SQL or syntax errors.
 * 
 * Usage: node scripts/run_migration.js <migration-file>
 * Example: node scripts/run_migration.js sql/migrations/20260209_add_unique_constraint_user_whatsapp.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../src/repository/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function validateSQLContent(content) {
  const issues = [];
  
  // Check for HTML entities
  if (content.includes('&lt;') || content.includes('&gt;') || content.includes('&amp;')) {
    issues.push('SQL contains HTML entities (&lt;, &gt;, &amp;). File may have been copied from a web page.');
  }
  
  // Check for truncated lines (lines ending mid-word without proper punctuation or newline)
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 0 && line.length < 100 && /^[a-z]{2,}$/i.test(line.slice(-10))) {
      // Line looks suspiciously truncated
      issues.push(`Line ${i + 1} may be truncated: "${line}"`);
    }
  }
  
  // Check for proper SQL structure
  const hasUpdate = content.toUpperCase().includes('UPDATE');
  const hasCreate = content.toUpperCase().includes('CREATE');
  const hasFrom = content.toUpperCase().includes('FROM');
  
  if (!hasUpdate && !hasCreate) {
    issues.push('SQL does not contain UPDATE or CREATE statements. May not be a valid migration.');
  }
  
  return issues;
}

async function runMigration(migrationPath) {
  log('\n=== SQL Migration Runner ===\n', colors.cyan);
  
  // Resolve path
  const fullPath = path.isAbsolute(migrationPath) 
    ? migrationPath 
    : path.join(process.cwd(), migrationPath);
  
  log(`Migration file: ${fullPath}`, colors.blue);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    log(`\n❌ Error: Migration file not found: ${fullPath}`, colors.red);
    process.exit(1);
  }
  
  // Read file content
  const content = fs.readFileSync(fullPath, 'utf-8');
  log(`File size: ${content.length} bytes`, colors.blue);
  
  // Validate SQL content
  log('\nValidating SQL content...', colors.yellow);
  const issues = validateSQLContent(content);
  
  if (issues.length > 0) {
    log('\n⚠️  Validation warnings:', colors.yellow);
    issues.forEach(issue => log(`  - ${issue}`, colors.yellow));
    log('\nPlease review the migration file before continuing.', colors.yellow);
    log('Press Ctrl+C to cancel, or wait 5 seconds to continue anyway...\n', colors.yellow);
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else {
    log('✓ No issues detected in SQL content', colors.green);
  }
  
  // Execute migration
  try {
    log('\nExecuting migration...', colors.cyan);
    await query(content);
    log('\n✓ Migration completed successfully!', colors.green);
    process.exit(0);
  } catch (error) {
    log(`\n❌ Migration failed:`, colors.red);
    log(error.message, colors.red);
    if (error.stack) {
      log('\nStack trace:', colors.red);
      log(error.stack, colors.red);
    }
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  log('Usage: node scripts/run_migration.js <migration-file>', colors.yellow);
  log('Example: node scripts/run_migration.js sql/migrations/20260209_add_unique_constraint_user_whatsapp.sql', colors.yellow);
  process.exit(1);
}

runMigration(args[0]);
