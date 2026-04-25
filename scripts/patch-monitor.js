#!/usr/bin/env node
/**
 * Properly patches API routes to add Discord monitoring.
 * Reads the actual catch variable name from each file.
 * Only adds import + monitor.critical line. No structural changes.
 */
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'app', 'api');
const SKIP = ['monitor/alert', 'stripe/webhook', 'health'];

function getRouteName(fp) {
  return path.relative(API_DIR, fp).replace(/\/route\.ts$/, '');
}

function patchFile(fp) {
  const name = getRouteName(fp);
  if (SKIP.some(s => name.includes(s))) { console.log(`  SKIP: ${name}`); return 0; }

  let src = fs.readFileSync(fp, 'utf-8');
  if (src.includes("monitor.critical")) { console.log(`  DONE: ${name}`); return 0; }

  // Find catch blocks with their variable names
  // Pattern: } catch (varName) {  or  } catch (varName: type) {
  const catchPattern = /\}\s*catch\s*\((\w+)(?::\s*\w+)?\)\s*\{/g;
  const matches = [...src.matchAll(catchPattern)];
  
  if (matches.length === 0) { console.log(`  SKIP: ${name} (no catch)`); return 0; }

  // Add import if missing
  if (!src.includes("from '@/lib/monitor'")) {
    const lines = src.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, "import { monitor } from '@/lib/monitor';");
      src = lines.join('\n');
    }
  }

  // For each catch block, find the console.error line inside it and add monitor.critical after
  let changes = 0;
  for (const m of matches) {
    const varName = m[1]; // 'error', 'err', 'e', etc.
    const catchIdx = m.index;
    
    // Find the console.error line within the next ~200 chars after the catch
    const searchRegion = src.substring(catchIdx, catchIdx + 500);
    const consoleMatch = searchRegion.match(/(\n(\s*)console\.error\([^)]*\);?)/);
    
    if (consoleMatch) {
      const indent = consoleMatch[2];
      const consoleLine = consoleMatch[1];
      const monitorLine = `\n${indent}monitor.critical('Tool: ${name}', String(${varName}));`;
      
      // Only add if not already there
      if (!searchRegion.includes(`monitor.critical('Tool: ${name}'`)) {
        const insertPoint = catchIdx + searchRegion.indexOf(consoleLine) + consoleLine.length;
        src = src.substring(0, insertPoint) + monitorLine + src.substring(insertPoint);
        changes++;
      }
    }
  }

  if (changes > 0) {
    fs.writeFileSync(fp, src, 'utf-8');
    console.log(`  ✅ ${name} (${changes} catch blocks)`);
  }
  return changes;
}

function findRoutes(dir) {
  const r = [];
  try {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) r.push(...findRoutes(p));
      else if (d.name === 'route.ts') r.push(p);
    }
  } catch {}
  return r;
}

console.log('Patching routes with monitor.critical...\n');
let total = 0;
for (const f of findRoutes(API_DIR)) total += patchFile(f);
console.log(`\nDone! ${total} catch blocks patched.`);
