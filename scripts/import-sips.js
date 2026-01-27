const { insertSips } = require('../src/database/queries/sip-queries');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const inputPath = process.argv[2] || 'sips_export.json';
    const resolvedPath = path.resolve(inputPath);

    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ File not found: ${resolvedPath}`);
      process.exit(1);
    }

    console.log(`📥 Reading SIPs from ${resolvedPath}...`);
    const data = fs.readFileSync(resolvedPath, 'utf8');
    const sips = JSON.parse(data);

    if (!Array.isArray(sips)) {
      console.error('❌ Invalid data format. Expected array.');
      process.exit(1);
    }

    console.log(`Processing ${sips.length} records...`);
    console.log('This will:');
    console.log('1. Insert/Update into `sips` table');

    const count = await insertSips(sips);
    console.log(`✅ Successfully processed ${count} records.`);

    process.exit(0);
  } catch (e) {
    console.error('❌ Import failed:', e);
    process.exit(1);
  }
})();
