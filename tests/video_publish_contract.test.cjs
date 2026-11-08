'use strict';
// Source-level regression check for 42P08. Live PostgreSQL test must still be performed on Ayazhan's Mac.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
test('Publish parameter $1 has explicit SQL type at comparison and update',()=>{
 assert.match(server,/UPDATE product_videos SET status=\$1::(?:varchar|text)/);
 assert.match(server,/CASE WHEN \$1::(?:varchar|text)='published'/);
 assert.doesNotMatch(server,/CASE WHEN \$1='published'/);
});
test('Publish route is restricted to Administrator on server',()=>{
 assert.match(server,/app\.patch\('\/api\/videos\/:id\/status', admin,/);
});
test('Video review preserves audit event and transaction',()=>{
 assert.match(server,/INSERT INTO video_review_events/);
 assert.match(server,/await c\.query\('COMMIT'\)/);
 assert.match(server,/await c\.query\('ROLLBACK'\)/);
});
test('Only approved status values are allowed',()=>{
 assert.match(server,/\['published', 'rejected', 'archived'\]\.includes\(status\)/);
});
