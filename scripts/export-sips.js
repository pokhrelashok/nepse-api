const { getAllSips } = require('../src/database/queries/sip-queries');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('📤 Exporting SIPs from database...');
    const sips = await getAllSips();
    console.log(`Found ${sips.length} SIP records.`);

    const outputPath = path.resolve('sips_export.json');
    fs.writeFileSync(outputPath, JSON.stringify(sips, null, 2));
    console.log(`✅ Exported to ${outputPath}`);

    process.exit(0);
  } catch (e) {
    console.error('❌ Export failed:', e);
    process.exit(1);
  }
})();
