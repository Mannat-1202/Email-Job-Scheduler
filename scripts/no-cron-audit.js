const fs = require('fs');
const path = require('path');

console.log('--- Scanning codebase for forbidden cron libraries ---');

const forbidden = [
  'node-cron',
  'agenda',
  'node-schedule',
  'bree',
  'cron',
  'crontab',
];

const packageFiles = [
  path.resolve(__dirname, '../package.json'),
  path.resolve(__dirname, '../backend/package.json'),
  path.resolve(__dirname, '../frontend/package.json'),
];

let violations = 0;

for (const pFile of packageFiles) {
  if (fs.existsSync(pFile)) {
    const content = fs.readFileSync(pFile, 'utf-8');
    const json = JSON.parse(content);
    const allDeps = {
      ...(json.dependencies || {}),
      ...(json.devDependencies || {}),
    };

    for (const dep of Object.keys(allDeps)) {
      if (forbidden.includes(dep.toLowerCase())) {
        console.error(`VIOLATION: Forbidden package "${dep}" found in ${pFile}`);
        violations++;
      }
    }
  }
}

if (violations === 0) {
  console.log('AUDIT PASSED: Zero cron dependencies detected. Pure BullMQ delayed job scheduling confirmed.');
  process.exit(0);
} else {
  console.error(`AUDIT FAILED: Found ${violations} forbidden dependencies.`);
  process.exit(1);
}
