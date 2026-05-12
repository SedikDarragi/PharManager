const Database = require('better-sqlite3');
const db = new Database('pharmacy.db');

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'pharmacist',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    category TEXT,
    quantity INTEGER,
    reorder_threshold INTEGER,
    expiry_date DATE,
    price REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    med_id INTEGER,
    type TEXT, -- 'LOW_STOCK', 'EXPIRY', 'STOCKOUT'
    message TEXT,
    severity TEXT, -- 'CRITICAL', 'WARNING', 'INFO'
    status TEXT DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (med_id) REFERENCES medications (id) ON DELETE CASCADE
  );
`);

// Example Seed Data Logic
const seedMeds = [
  { name: 'Amoxicillin 500mg', category: 'Antibiotic', qty: 5, threshold: 20, expiry: '2024-05-20', price: 12.50 },
  { name: 'Lisinopril 10mg', category: 'Cardiovascular', qty: 150, threshold: 50, expiry: '2025-12-01', price: 8.00 },
  { name: 'Insulin Glargine', category: 'Diabetes', qty: 2, threshold: 10, expiry: '2024-04-15', price: 45.00 },
];

// Ensure at least one user exists for seeding
let adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminUser) {
  const info = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', 'admin123', 'admin');
  adminUser = { id: info.lastInsertRowid };
}

// Run seeding...
const insertMed = db.prepare(`
  INSERT INTO medications (user_id, name, category, quantity, reorder_threshold, expiry_date, price)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const checkCount = db.prepare('SELECT count(*) as count FROM medications').get();
if (checkCount.count === 0) {
  const transaction = db.transaction((meds) => {
    for (const med of meds) {
      insertMed.run(adminUser.id, med.name, med.category, med.qty, med.threshold, med.expiry, med.price);
    }
  });
  transaction(seedMeds);
  console.log('Database seeded with initial medications.');
}

/**
 * Refresh alerts based on current medication stock and expiry dates.
 */
function refreshAlerts(userId) {
  if (!userId) return; // Ensure a userId is provided

  db.transaction(() => {
    const meds = db.prepare('SELECT * FROM medications WHERE user_id = ?').all(userId);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const requiredAlerts = [];

    for (const med of meds) {
      if (med.quantity <= 0) {
        requiredAlerts.push({ med_id: med.id, type: 'STOCKOUT', message: `${med.name} is out of stock!`, severity: 'CRITICAL' });
      } else if (med.quantity <= 5) {
        requiredAlerts.push({ med_id: med.id, type: 'LOW_STOCK', message: `${med.name} is low on stock (${med.quantity} remaining).`, severity: 'WARNING' });
      }

      const expiryDate = new Date(med.expiry_date);
      if (expiryDate <= today) {
        requiredAlerts.push({ med_id: med.id, type: 'EXPIRY', message: `${med.name} has expired!`, severity: 'CRITICAL' });
      } else if (expiryDate <= thirtyDaysFromNow) {
        requiredAlerts.push({ med_id: med.id, type: 'EXPIRY', message: `${med.name} expires soon (${med.expiry_date}).`, severity: 'WARNING' });
      }
    }

    // 1. Cleanup: Remove dismissed alerts for medications that are now healthy.
    // This allows them to be re-triggered if they become low/expired again later.
    const currentAlerts = db.prepare("SELECT id, med_id, type, status FROM alerts WHERE user_id = ?").all(userId);
    for (const alert of currentAlerts) {
      const stillRequired = requiredAlerts.some(r => r.med_id === alert.med_id && r.type === alert.type);
      if (!stillRequired && alert.status === 'dismissed') {
        db.prepare("DELETE FROM alerts WHERE id = ?").run(alert.id);
      }
    }

    // 2. Process required alerts
    const insertStmt = db.prepare('INSERT INTO alerts (user_id, med_id, type, message, severity) VALUES (?, ?, ?, ?, ?)');
    const activateStmt = db.prepare("UPDATE alerts SET status = 'active', message = ? WHERE id = ?");
    const updateMsgStmt = db.prepare("UPDATE alerts SET message = ? WHERE id = ?");

    for (const req of requiredAlerts) {
      const existing = db.prepare("SELECT id, status, message FROM alerts WHERE user_id = ? AND med_id = ? AND type = ?").get(userId, req.med_id, req.type);
      
      if (!existing) {
        insertStmt.run(userId, req.med_id, req.type, req.message, req.severity);
      } else if (existing.status === 'active' && existing.message !== req.message) {
        updateMsgStmt.run(req.message, existing.id);
      } else if (existing.status === 'dismissed' && existing.message !== req.message) {
        // Re-activate alert if the condition has changed (e.g. quantity decreased further)
        activateStmt.run(req.message, existing.id);
      }
    }
  })();
}
db.refreshAlerts = refreshAlerts;
module.exports = db;
