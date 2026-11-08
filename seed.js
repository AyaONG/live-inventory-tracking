// Loads realistic test data. Safe to re-run: it empties the tables first.
const bcrypt = require('bcryptjs');
const pool = require('./db');

// Small deterministic random generator, so everyone gets the same data
let state = 12345;
function rnd() { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; }
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const categories = [
  ['Cables', 'CAB', 2500, 9000, [
    'USB-C to USB-C cable 1 m', 'USB-C to USB-C cable 2 m', 'USB-A to USB-C cable 1 m', 'USB-A to Lightning cable 1 m',
    'USB-C to Lightning cable 1 m', 'USB-A to micro-USB cable 1 m', 'HDMI cable 2 m', 'HDMI cable 5 m',
    'DisplayPort cable 1.8 m', 'Ethernet cable Cat6 3 m', 'Aux 3.5 mm audio cable 1 m', 'Braided USB-C cable 3 m']],
  ['Chargers', 'CHG', 3000, 18000, [
    'Wall charger 20 W USB-C', 'Wall charger 30 W USB-C', 'Wall charger 65 W GaN', 'Wall charger 2-port 12 W',
    'Car charger 36 W dual USB', 'Car charger 20 W USB-C', 'Wireless charger pad 15 W', 'Wireless charger stand 10 W',
    'Travel charger 4-port 40 W', 'Laptop charger 65 W USB-C', 'Magnetic charger 15 W', 'Charging station 6-port 60 W']],
  ['Phone cases', 'CAS', 1500, 8000, [
    'iPhone 15 silicone case', 'iPhone 15 Pro clear case', 'iPhone 14 silicone case', 'iPhone 13 clear case',
    'Samsung Galaxy S24 case', 'Samsung Galaxy S23 clear case', 'Samsung Galaxy A54 case', 'Xiaomi Redmi Note 13 case',
    'Xiaomi 13T case', 'Honor 90 case', 'Universal waterproof pouch', 'Phone case with card holder']],
  ['Screen protectors', 'SCR', 1000, 5000, [
    'iPhone 15 tempered glass', 'iPhone 14 tempered glass', 'iPhone 13 tempered glass', 'Samsung Galaxy S24 glass',
    'Samsung Galaxy A54 glass', 'Xiaomi Redmi Note 13 glass', 'Xiaomi 13T glass', 'Honor 90 glass',
    'iPad 10.9 screen protector', 'Camera lens protector iPhone 15', 'Privacy glass iPhone 15', 'Matte film universal 6.5 in']],
  ['Headphones', 'HDP', 1500, 25000, [
    'Wired earphones 3.5 mm', 'Wired earphones USB-C', 'Bluetooth earbuds basic', 'Bluetooth earbuds ANC',
    'Over-ear headphones wired', 'Over-ear Bluetooth headphones', 'Gaming headset USB', 'Gaming headset 3.5 mm',
    'Sport earbuds neckband', 'Kids headphones volume limited', 'Earbuds case silicone', 'Headphone splitter 3.5 mm']],
  ['Power banks', 'PWR', 6000, 35000, [
    'Power bank 5000 mAh', 'Power bank 10000 mAh', 'Power bank 10000 mAh 20 W', 'Power bank 20000 mAh',
    'Power bank 20000 mAh 65 W', 'Power bank 30000 mAh', 'Magnetic power bank 5000 mAh', 'Slim power bank 10000 mAh',
    'Solar power bank 10000 mAh', 'Power bank 15000 mAh', 'Mini power bank 3000 mAh', 'Power bank 26800 mAh']],
  ['Adapters and hubs', 'ADP', 1500, 15000, [
    'USB-C to USB-A adapter', 'USB-C to HDMI adapter', 'USB-C to 3.5 mm adapter', 'Lightning to 3.5 mm adapter',
    'USB-C hub 4-in-1', 'USB-C hub 7-in-1', 'USB 3.0 hub 4-port', 'Micro-USB to USB-C adapter',
    'USB-C to Ethernet adapter', 'SD/microSD card reader USB-C', 'Multi-socket extension 5 m', 'Travel plug adapter EU-US']],
  ['Memory and storage', 'MEM', 2500, 45000, [
    'microSD card 64 GB', 'microSD card 128 GB', 'microSD card 256 GB', 'SD card 64 GB', 'SD card 128 GB',
    'USB flash drive 32 GB', 'USB flash drive 64 GB', 'USB flash drive 128 GB', 'USB-C flash drive 128 GB',
    'Portable SSD 500 GB', 'Portable SSD 1 TB', 'Card reader USB 3.0']],
  ['Batteries', 'BAT', 500, 6000, [
    'AA batteries 4-pack', 'AA batteries 12-pack', 'AAA batteries 4-pack', 'AAA batteries 12-pack', '9V battery',
    'CR2032 coin battery 2-pack', 'CR2025 coin battery 2-pack', 'AA rechargeable 2-pack', 'AAA rechargeable 2-pack',
    'Battery charger AA/AAA', 'C battery 2-pack', 'D battery 2-pack']],
  ['Holders and mounts', 'HLD', 1500, 12000, [
    'Car phone holder vent', 'Car phone holder dashboard', 'Car phone holder magnetic', 'Desk phone stand',
    'Foldable phone stand', 'Tripod 1.2 m with phone clip', 'Selfie stick Bluetooth', 'Ring light 10 in',
    'Bike phone mount', 'Tablet stand adjustable', 'Laptop stand aluminum', 'Gooseneck phone holder']],
];

const suppliers = [
  'TechSnab KZ', 'Astana Digital Supply', 'Nomad Electronics', 'Altyn Trade', 'Steppe Gadgets', 'Baiterek Wholesale',
  'Silk Road Accessories', 'Kaz Mobile Parts', 'CityCom Distribution', 'Digital Bazaar', 'Eurasia Gadgets', 'Qazaq Tech Import',
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`TRUNCATE alerts, stock_movements, product_suppliers, products,
                        suppliers, categories, users RESTART IDENTITY CASCADE`);

    // users: 1 owner + 9 employees, demo password is hashed (bcrypt, work factor 10)
    const hash = await bcrypt.hash('Demo1234!', 10);
    await client.query(`INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'owner')`, ['owner@shop.example', hash]);
    for (let i = 1; i <= 9; i++) {
      await client.query(`INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'employee')`, [`employee${i}@shop.example`, hash]);
    }

    // categories and products (10 x 12 = 120 products)
    let n = 0;
    for (let c = 0; c < categories.length; c++) {
      const [catName, prefix, minP, maxP, names] = categories[c];
      await client.query('INSERT INTO categories (name) VALUES ($1)', [catName]);
      for (let k = 0; k < names.length; k++) {
        n++;
        const price = Math.round((minP + rnd() * (maxP - minP)) / 100) * 100;
        const threshold = int(5, 15);
        // about one product in seven is already below its threshold, so alerts exist in the data
        const quantity = n % 7 === 0 ? int(0, threshold) : int(threshold + 1, 80);
        await client.query(
          `INSERT INTO products (sku, name, category_id, price, quantity, reorder_threshold)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`${prefix}-${String(k + 1).padStart(3, '0')}`, names[k], c + 1, price, quantity, threshold]
        );
      }
    }

    // suppliers (12)
    for (let i = 0; i < suppliers.length; i++) {
      await client.query('INSERT INTO suppliers (name, phone, email) VALUES ($1, $2, $3)',
        [suppliers[i], `+7 700 000 00${String(i + 1).padStart(2, '0')}`,
         `sales@${suppliers[i].toLowerCase().replace(/[^a-z]/g, '')}.example`]);
    }

    // product_suppliers: 60 first products get one supplier, 10 get a second (70 rows, many-to-many)
    for (let p = 1; p <= 60; p++) {
      await client.query('INSERT INTO product_suppliers VALUES ($1, $2, $3)', [p, ((p - 1) % 12) + 1, int(300, 8000)]);
    }
    for (let p = 1; p <= 10; p++) {
      await client.query('INSERT INTO product_suppliers VALUES ($1, $2, $3)', [p, ((p - 1 + 5) % 12) + 1, int(300, 8000)]);
    }

    // stock_movements (70 rows of history, spread over the last 30 days)
    const reasons = ['sale', 'sale', 'sale', 'delivery', 'correction'];
    for (let i = 0; i < 70; i++) {
      const reason = reasons[int(0, reasons.length - 1)];
      let change = reason === 'sale' ? -int(1, 5) : reason === 'delivery' ? int(10, 40) : (rnd() < 0.5 ? -1 : 1) * int(1, 3);
      await client.query(
        `INSERT INTO stock_movements (product_id, user_id, quantity_change, reason, created_at)
         VALUES ($1, $2, $3, $4, now() - ($5 || ' days')::interval)`,
        [int(1, 120), int(2, 10), change, reason, String(int(0, 30))]
      );
    }

    // alerts for products that are at or below their threshold (max 20)
    await client.query(
      `INSERT INTO alerts (product_id, quantity_at_alert)
       SELECT product_id, quantity FROM products WHERE quantity <= reorder_threshold ORDER BY product_id LIMIT 20`);

    await client.query('COMMIT');
    const counts = await client.query(`
      SELECT 'users' t, count(*) FROM users UNION ALL SELECT 'categories', count(*) FROM categories
      UNION ALL SELECT 'suppliers', count(*) FROM suppliers UNION ALL SELECT 'products', count(*) FROM products
      UNION ALL SELECT 'product_suppliers', count(*) FROM product_suppliers
      UNION ALL SELECT 'stock_movements', count(*) FROM stock_movements UNION ALL SELECT 'alerts', count(*) FROM alerts`);
    console.table(counts.rows);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
main();
