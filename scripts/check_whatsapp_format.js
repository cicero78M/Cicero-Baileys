// Script to check WhatsApp number formats in the database
// This will help identify if there are any numbers stored with @c.us or @s.whatsapp.net suffixes

import { query } from '../src/repository/db.js';

async function checkWhatsAppFormats() {
  console.log('Checking WhatsApp number formats in database...\n');
  
  try {
    // Get all users with WhatsApp numbers
    const { rows: allUsers } = await query(
      'SELECT user_id, nama, whatsapp FROM "user" WHERE whatsapp IS NOT NULL AND whatsapp != \'\' LIMIT 20'
    );
    
    console.log(`Found ${allUsers.length} users with WhatsApp numbers (showing first 20):\n`);
    
    let hasOldFormat = false;
    let hasSuffix = false;
    
    for (const user of allUsers) {
      const wa = user.whatsapp;
      let status = '✓ Clean';
      
      if (wa.includes('@c.us')) {
        status = '❌ OLD FORMAT (@c.us)';
        hasOldFormat = true;
        hasSuffix = true;
      } else if (wa.includes('@s.whatsapp.net')) {
        status = '❌ HAS SUFFIX (@s.whatsapp.net)';
        hasSuffix = true;
      } else if (wa.includes('@')) {
        status = '⚠️ HAS @ SYMBOL';
        hasSuffix = true;
      } else if (!wa.startsWith('62')) {
        status = '⚠️ NO 62 PREFIX';
      }
      
      console.log(`${user.user_id.padEnd(15)} | ${(user.nama || '').substring(0, 20).padEnd(20)} | ${wa.padEnd(30)} | ${status}`);
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total users checked: ${allUsers.length}`);
    console.log(`Has old format (@c.us): ${hasOldFormat ? 'YES ⚠️' : 'NO ✓'}`);
    console.log(`Has any suffix: ${hasSuffix ? 'YES ⚠️' : 'NO ✓'}`);
    
    if (hasOldFormat || hasSuffix) {
      console.log('\n⚠️ MIGRATION NEEDED: Some WhatsApp numbers have old formats or suffixes.');
      console.log('These need to be normalized to pure digits with 62 prefix.');
    } else {
      console.log('\n✓ All WhatsApp numbers are in correct format.');
    }
    
    // Check if there are any users with @c.us specifically
    const { rows: oldFormatUsers } = await query(
      'SELECT COUNT(*) as count FROM "user" WHERE whatsapp LIKE \'%@c.us%\''
    );
    console.log(`\nUsers with @c.us format: ${oldFormatUsers[0].count}`);
    
    // Check if there are any users with @s.whatsapp.net
    const { rows: baileysFormatUsers } = await query(
      'SELECT COUNT(*) as count FROM "user" WHERE whatsapp LIKE \'%@s.whatsapp.net%\''
    );
    console.log(`Users with @s.whatsapp.net format: ${baileysFormatUsers[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking WhatsApp formats:', error);
    process.exit(1);
  }
}

checkWhatsAppFormats();
