const Database = require('better-sqlite3');
const db = new Database('pharmacy.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    quantity INTEGER,
    reorder_threshold INTEGER,
    expiry_date DATE,
    price REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    med_id INTEGER,
    type TEXT, -- 'LOW_STOCK', 'EXPIRY', 'STOCKOUT'
    message TEXT,
    severity TEXT, -- 'CRITICAL', 'WARNING', 'INFO'
    status TEXT DEFAULT 'active'
  );
`);

// Example Seed Data Logic
const seedMeds = [
  { name: 'Amoxicillin 500mg', category: 'Antibiotic', qty: 5, threshold: 20, expiry: '2024-05-20', price: 12.50 },
  { name: 'Lisinopril 10mg', category: 'Cardiovascular', qty: 150, threshold: 50, expiry: '2025-12-01', price: 8.00 },
  { name: 'Insulin Glargine', category: 'Diabetes', qty: 2, threshold: 10, expiry: '2024-04-15', price: 45.00 },
];

// Run seeding...
const insertMed = db.prepare(`
  INSERT INTO medications (name, category, quantity, reorder_threshold, expiry_date, price)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const checkCount = db.prepare('SELECT count(*) as count FROM medications').get();
if (checkCount.count === 0) {
  const transaction = db.transaction((meds) => {
    for (const med of meds) {
      insertMed.run(med.name, med.category, med.qty, med.threshold, med.expiry, med.price);
    }
  });
  transaction(seedMeds);
  console.log('Database seeded with initial medications.');
}

/**
 * Refresh alerts based on current medication stock and expiry dates.
 */
function refreshAlerts() {
  db.prepare("DELETE FROM alerts WHERE status = 'active'").run();
  const meds = db.prepare('SELECT * FROM medications').all();
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const insertAlert = db.prepare('INSERT INTO alerts (med_id, type, message, severity) VALUES (?, ?, ?, ?)');
  meds.forEach(med => {
    if (med.quantity <= 0) {
      insertAlert.run(med.id, 'STOCKOUT', `${med.name} is out of stock!`, 'CRITICAL');
    } else if (med.quantity <= med.reorder_threshold) {
      insertAlert.run(med.id, 'LOW_STOCK', `${med.name} is below reorder threshold.`, 'WARNING');
    }
    const expiryDate = new Date(med.expiry_date);
    if (expiryDate <= today) {
      insertAlert.run(med.id, 'EXPIRY', `${med.name} has expired!`, 'CRITICAL');
    } else if (expiryDate <= thirtyDaysFromNow) {
      insertAlert.run(med.id, 'EXPIRY', `${med.name} expires soon (${med.expiry_date}).`, 'WARNING');
    }
  });
}
db.refreshAlerts = refreshAlerts;
module.exports = db;
