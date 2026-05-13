const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('pharmacy.db');

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'pharmacist',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations (id)
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER,
    supplier_id INTEGER,
    name TEXT,
    category TEXT,
    quantity INTEGER,
    reorder_threshold INTEGER,
    expiry_date DATE,
    price REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations (id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER,
    name TEXT,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER,
    med_id INTEGER,
    type TEXT, -- 'LOW_STOCK', 'EXPIRY', 'STOCKOUT'
    message TEXT,
    severity TEXT, -- 'CRITICAL', 'WARNING', 'INFO'
    status TEXT DEFAULT 'active',
    FOREIGN KEY (org_id) REFERENCES organizations (id),
    FOREIGN KEY (med_id) REFERENCES medications (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER,
    user_id INTEGER,
    action TEXT, -- 'ADD', 'UPDATE', 'DELETE', 'CLEAR'
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER,
    med_id INTEGER,
    user_id INTEGER,
    quantity INTEGER,
    price_at_sale REAL,
    total REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE,
    FOREIGN KEY (med_id) REFERENCES medications (id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
  );
`);

// Example Seed Data Logic
const seedMeds = [
  { name: 'Amoxicillin 500mg', category: 'Antibiotic', qty: 5, threshold: 20, expiry: '2024-05-20', price: 12.50 },
  { name: 'Lisinopril 10mg', category: 'Cardiovascular', qty: 150, threshold: 50, expiry: '2025-12-01', price: 8.00 },
  { name: 'Insulin Glargine', category: 'Diabetes', qty: 2, threshold: 10, expiry: '2024-04-15', price: 45.00 },
];

// Ensure at least one organization and user exists for seeding
let seedOrg = db.prepare('SELECT id FROM organizations WHERE name = ?').get('Default Pharmacy');
if (!seedOrg) {
  const info = db.prepare('INSERT INTO organizations (name) VALUES (?)').run('Default Pharmacy');
  seedOrg = { id: info.lastInsertRowid };
}

let seedSupplier = db.prepare('SELECT id FROM suppliers WHERE name = ?').get('Global Med Distrib');
if (!seedSupplier) {
  const info = db.prepare('INSERT INTO suppliers (org_id, name, contact_name, email, phone) VALUES (?, ?, ?, ?, ?)')
    .run(seedOrg.id, 'Global Med Distrib', 'John Doe', 'orders@globalmed.com', '555-0199');
  seedSupplier = { id: info.lastInsertRowid };
}

let adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminUser) {
  const hashedAdminPassword = bcrypt.hashSync('admin123', 10);
  const info = db.prepare('INSERT INTO users (username, password, role, org_id) VALUES (?, ?, ?, ?)').run('admin', hashedAdminPassword, 'admin', seedOrg.id);
  adminUser = { id: info.lastInsertRowid };
}

let testAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('test_admin');
if (!testAdmin) {
  const hashedTestPassword = bcrypt.hashSync('testadmin2024', 10);
  db.prepare('INSERT INTO users (username, password, role, org_id) VALUES (?, ?, ?, ?)').run('test_admin', hashedTestPassword, 'admin', seedOrg.id);
}

// Run seeding...
const insertMed = db.prepare(`
  INSERT INTO medications (org_id, supplier_id, name, category, quantity, reorder_threshold, expiry_date, price)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const checkCount = db.prepare('SELECT count(*) as count FROM medications').get();
if (checkCount.count === 0) {
  const transaction = db.transaction((meds) => {
    for (const med of meds) {
      insertMed.run(seedOrg.id, seedSupplier.id, med.name, med.category, med.qty, med.threshold, med.expiry, med.price);
    }
  });
  transaction(seedMeds);
  console.log('Database seeded with initial medications.');
}

/**
 * Refresh alerts based on current medication stock and expiry dates.
 */
function refreshAlerts(orgId) {
  if (!orgId) return; // Ensure an orgId is provided

  db.transaction(() => {
    const meds = db.prepare('SELECT * FROM medications WHERE org_id = ?').all(orgId);
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
    const currentAlerts = db.prepare("SELECT id, med_id, type, status FROM alerts WHERE org_id = ?").all(orgId);
    for (const alert of currentAlerts) {
      const stillRequired = requiredAlerts.some(r => r.med_id === alert.med_id && r.type === alert.type);
      if (!stillRequired && alert.status === 'dismissed') {
        db.prepare("DELETE FROM alerts WHERE id = ?").run(alert.id);
      }
    }

    // 2. Process required alerts
    const insertStmt = db.prepare('INSERT INTO alerts (org_id, med_id, type, message, severity) VALUES (?, ?, ?, ?, ?)');
    const activateStmt = db.prepare("UPDATE alerts SET status = 'active', message = ? WHERE id = ?");
    const updateMsgStmt = db.prepare("UPDATE alerts SET message = ? WHERE id = ?");

    for (const req of requiredAlerts) {
      const existing = db.prepare("SELECT id, status, message FROM alerts WHERE org_id = ? AND med_id = ? AND type = ?").get(orgId, req.med_id, req.type);
      
      if (!existing) {
        insertStmt.run(orgId, req.med_id, req.type, req.message, req.severity);
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
