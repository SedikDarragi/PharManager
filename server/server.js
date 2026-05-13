// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const Groq = require('groq-sdk'); // Switch to Groq
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db/database');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy-secret-key-2024';

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    
    // Verify user still exists in database (handles DB resets/deletions)
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
    if (!userExists) {
      return res.status(401).json({ error: "User session is invalid. Please log in again." });
    }

    req.user = user;
    next();
  });
};

// Helper to log activity
const logActivity = (orgId, userId, action, details) => {
  const stmt = db.prepare('INSERT INTO activity_logs (org_id, user_id, action, details) VALUES (?, ?, ?, ?)');
  stmt.run(orgId, userId, action, details);
};

// Middleware to check for Admin role
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Access denied. Admin role required." });
  }
  next();
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { username, password, organizationName } = req.body;
  try {
    // Find or create organization
    let org = db.prepare('SELECT id FROM organizations WHERE name = ?').get(organizationName);
    if (!org) {
      const orgInfo = db.prepare('INSERT INTO organizations (name) VALUES (?)').run(organizationName);
      org = { id: orgInfo.lastInsertRowid };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, org_id) VALUES (?, ?, ?)');
    const info = stmt.run(username, hashedPassword, org.id); 
    
    const newUser = { id: info.lastInsertRowid, username, orgId: org.id, role: 'pharmacist' };
    const token = jwt.sign({ 
      id: newUser.id, 
      username: newUser.username,
      orgId: newUser.orgId,
      role: newUser.role
    }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ success: true, user: newUser, token });
  } catch (error) {
    res.status(400).json({ error: "Username already exists." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: "Invalid username or password." });
  }

  const token = jwt.sign({ 
    id: user.id, 
    username: user.username, 
    orgId: user.org_id,
    role: user.role
  }, JWT_SECRET, { expiresIn: '24h' });

  res.json({ token, user: { id: user.id, username: user.username, orgId: user.org_id, role: user.role } });
});

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// THE COPILOT ENDPOINT: The Unique Differentiator
app.post('/api/copilot/chat', authenticateToken, async (req, res) => {
  const { message, history } = req.body;

  try {
    // 1. Context Gathering: Fetch current state of the pharmacy for the authenticated user
    db.refreshAlerts(req.user.orgId);
    const inventory = db.prepare('SELECT m.*, s.name as supplier_name FROM medications m LEFT JOIN suppliers s ON m.supplier_id = s.id WHERE m.org_id = ?').all(req.user.orgId);
    const alerts = db.prepare("SELECT * FROM alerts WHERE org_id = ? AND status = 'active'").all(req.user.orgId);
    const suppliers = db.prepare('SELECT * FROM suppliers WHERE org_id = ?').all(req.user.orgId);
    const recentSales = db.prepare(`
      SELECT s.*, m.name as med_name 
      FROM sales s 
      JOIN medications m ON s.med_id = m.id 
      WHERE s.org_id = ? 
      ORDER BY s.timestamp DESC LIMIT 10
    `).all(req.user.orgId);
    const today = new Date().toISOString().split('T')[0];

    // 2. Build the System Prompt
    const systemPrompt = `You are PharmAI, an expert AI pharmacist assistant. 
    You have real-time access to the pharmacy inventory and supplier list. 
    CURRENT DATE: ${today}
    
    CURRENT INVENTORY DATA:
    ${JSON.stringify(inventory)}
    
    ACTIVE ALERTS:
    ${JSON.stringify(alerts)}

    REGISTERED SUPPLIERS:
    ${JSON.stringify(suppliers)}

    RECENT SALES ACTIVITY:
    ${JSON.stringify(recentSales)}
    
    Instructions:
    - Answer questions based ONLY on the provided data.
    - Be proactive. If the user asks about stock, mention upcoming expiries if relevant.
    - Keep responses professional, concise, and clinical.
    - Use Markdown for tables or lists.`;

    // 3. Call Groq with Llama 3.1
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    const completion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 1024,
      top_p: 1,
      stream: false
    });

    const responseText = completion.choices[0]?.message?.content || "I couldn't process that request.";
    res.json({ reply: responseText });
  } catch (error) {
    console.error("Copilot Error:", error);
    res.status(500).json({ error: "Copilot is having trouble connecting to the AI engine." });
  }
});

// Inventory Routes
app.get('/api/medications', authenticateToken, (req, res) => {
  const meds = db.prepare('SELECT m.*, s.name as supplier_name FROM medications m LEFT JOIN suppliers s ON m.supplier_id = s.id WHERE m.org_id = ?').all(req.user.orgId);
  res.json(meds);
});

app.get('/api/medications/export', authenticateToken, (req, res) => {
  const meds = db.prepare('SELECT m.name, m.category, s.name as supplier_name, m.quantity, m.reorder_threshold, m.expiry_date, m.price FROM medications m LEFT JOIN suppliers s ON m.supplier_id = s.id WHERE m.org_id = ?').all(req.user.orgId);
  res.json(meds);
});

app.post('/api/medications', authenticateToken, (req, res) => {
  const { name, category, quantity, reorder_threshold, expiry_date, price, supplier_id } = req.body;
  const stmt = db.prepare(`
    INSERT INTO medications (org_id, supplier_id, name, category, quantity, reorder_threshold, expiry_date, price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(req.user.orgId, supplier_id || null, name, category, quantity, reorder_threshold, expiry_date, price);
  db.refreshAlerts(req.user.orgId);
  logActivity(req.user.orgId, req.user.id, 'ADD', `Added medication: ${name}`);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/medications/:id', authenticateToken, (req, res) => {
  const { name, category, quantity, reorder_threshold, expiry_date, price, supplier_id } = req.body;
  const medId = req.params.id;
  db.prepare('UPDATE medications SET name = ?, category = ?, quantity = ?, reorder_threshold = ?, expiry_date = ?, price = ?, supplier_id = ? WHERE id = ? AND org_id = ?')
    .run(name, category, quantity, reorder_threshold, expiry_date, price, supplier_id || null, medId, req.user.orgId);
  db.refreshAlerts(req.user.orgId);
  logActivity(req.user.orgId, req.user.id, 'UPDATE', `Updated medication ID: ${medId} (${name})`);
  res.json({ success: true });
});

// Supplier Routes
app.get('/api/suppliers', authenticateToken, (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE org_id = ?').all(req.user.orgId);
  res.json(suppliers);
});

app.post('/api/suppliers', authenticateToken, (req, res) => {
  const { name, contact_name, email, phone } = req.body;
  const stmt = db.prepare('INSERT INTO suppliers (org_id, name, contact_name, email, phone) VALUES (?, ?, ?, ?, ?)');
  const info = stmt.run(req.user.orgId, name, contact_name, email, phone);
  logActivity(req.user.orgId, req.user.id, 'ADD', `Added supplier: ${name}`);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/suppliers/:id', authenticateToken, (req, res) => {
  const supplier = db.prepare('SELECT name FROM suppliers WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  db.prepare('DELETE FROM suppliers WHERE id = ? AND org_id = ?').run(req.params.id, req.user.orgId);
  if (supplier) logActivity(req.user.orgId, req.user.id, 'DELETE', `Deleted supplier: ${supplier.name}`);
  res.json({ success: true });
});

// Clear All Stock Route (Must be above /:id)
app.delete('/api/medications/all/clear', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM alerts WHERE org_id = ?').run(req.user.orgId);
  db.prepare('DELETE FROM medications WHERE org_id = ?').run(req.user.orgId);
  db.refreshAlerts(req.user.orgId);
  logActivity(req.user.orgId, req.user.id, 'CLEAR', 'Wiped entire inventory');
  res.json({ success: true });
});

app.delete('/api/medications/:id', authenticateToken, (req, res) => {
  const med = db.prepare('SELECT name FROM medications WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  if (med) {
    db.prepare('DELETE FROM alerts WHERE med_id = ? AND org_id = ?').run(req.params.id, req.user.orgId);
    db.prepare('DELETE FROM medications WHERE id = ? AND org_id = ?').run(req.params.id, req.user.orgId);
    db.refreshAlerts(req.user.orgId);
    logActivity(req.user.orgId, req.user.id, 'DELETE', `Deleted medication: ${med.name}`);
  }
  res.json({ success: true });
});

app.get('/api/activity-logs', authenticateToken, (req, res) => {
  const logs = db.prepare(`
    SELECT al.*, u.username 
    FROM activity_logs al 
    JOIN users u ON al.user_id = u.id 
    WHERE al.org_id = ? 
    ORDER BY al.timestamp DESC LIMIT 100
  `).all(req.user.orgId);
  res.json(logs);
});

app.get('/api/alerts', authenticateToken, (req, res) => {
  db.refreshAlerts(req.user.orgId);
  const alerts = db.prepare("SELECT * FROM alerts WHERE org_id = ? AND status = 'active'").all(req.user.orgId);
  res.json(alerts);
});

app.post('/api/alerts/:id/dismiss', authenticateToken, (req, res) => {
  const alert = db.prepare('SELECT message FROM alerts WHERE id = ? AND org_id = ?').get(req.params.id, req.user.orgId);
  db.prepare("UPDATE alerts SET status = 'dismissed' WHERE id = ? AND org_id = ?").run(req.params.id, req.user.orgId);
  if (alert) {
    logActivity(req.user.orgId, req.user.id, 'UPDATE', `Dismissed alert: ${alert.message}`);
  }
  res.json({ success: true });
});

// Sales & Dispensing Routes
app.post('/api/sales', authenticateToken, (req, res) => {
  const { medId, quantity } = req.body;

  try {
    const med = db.prepare('SELECT * FROM medications WHERE id = ? AND org_id = ?').get(medId, req.user.orgId);

    if (!med) return res.status(404).json({ error: "Medication not found." });
    if (med.quantity < quantity) return res.status(400).json({ error: "Insufficient stock available." });

    const total = med.price * quantity;

    const processSale = db.transaction(() => {
      // 1. Update Medication Quantity
      db.prepare('UPDATE medications SET quantity = quantity - ? WHERE id = ?').run(quantity, medId);
      // 2. Record Sale
      db.prepare('INSERT INTO sales (org_id, med_id, user_id, quantity, price_at_sale, total) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.user.orgId, medId, req.user.id, quantity, med.price, total);
    });

    processSale();
    db.refreshAlerts(req.user.orgId);
    logActivity(req.user.orgId, req.user.id, 'UPDATE', `Dispensed ${quantity} units of ${med.name}. Total: $${total}`);
    res.json({ success: true, total });
  } catch (error) {
    res.status(500).json({ error: "Failed to process dispensing." });
  }
});

app.get('/api/sales', authenticateToken, (req, res) => {
  const sales = db.prepare(`
    SELECT s.*, m.name as med_name, u.username 
    FROM sales s
    LEFT JOIN medications m ON s.med_id = m.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.org_id = ?
    ORDER BY s.timestamp DESC LIMIT 100
  `).all(req.user.orgId);
  res.json(sales);
});

app.get('/api/analytics/revenue', authenticateToken, (req, res) => {
  const revenueData = db.prepare(`
    SELECT date(timestamp, 'localtime') as date, SUM(total) as revenue
    FROM sales WHERE org_id = ?
    GROUP BY date(timestamp, 'localtime') ORDER BY date DESC LIMIT 7
  `).all(req.user.orgId);
  res.json(revenueData.reverse());
});

app.get('/api/analytics/summary', authenticateToken, (req, res) => {
  const totalSkus = db.prepare('SELECT COUNT(*) as count FROM medications WHERE org_id = ?').get(req.user.orgId).count;
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM medications WHERE org_id = ? AND quantity <= 5 AND quantity > 0').get(req.user.orgId).count;
  const stockouts = db.prepare('SELECT COUNT(*) as count FROM medications WHERE org_id = ? AND quantity = 0').get(req.user.orgId).count;
  const val = db.prepare('SELECT SUM(quantity * price) as val FROM medications WHERE org_id = ?').get(req.user.orgId).val || 0;
  const totalValue = Number(val).toFixed(2);
  
  res.json({ totalSkus, lowStock, stockouts, totalValue });
});

// Organization & Profile Routes
app.get('/api/organization/details', authenticateToken, (req, res) => {
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.user.orgId);
  res.json(org);
});

app.get('/api/organization/members', authenticateToken, (req, res) => {
  const members = db.prepare('SELECT id, username, role, created_at FROM users WHERE org_id = ?').all(req.user.orgId);
  res.json(members);
});

// Global Admin Management Routes
app.get('/api/admin/organizations', authenticateToken, isAdmin, (req, res) => {
  const orgs = db.prepare(`
    SELECT o.*, 
    (SELECT COUNT(*) FROM users u WHERE u.org_id = o.id) as userCount,
    (SELECT COUNT(*) FROM medications m WHERE m.org_id = o.id) as stockCount
    FROM organizations o
  `).all();
  res.json(orgs);
});

app.get('/api/admin/organizations/:id/users', authenticateToken, isAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users WHERE org_id = ?').all(req.params.id);
  res.json(users);
});

app.get('/api/admin/organizations/:id/medications', authenticateToken, isAdmin, (req, res) => {
  const meds = db.prepare('SELECT m.*, s.name as supplier_name FROM medications m LEFT JOIN suppliers s ON m.supplier_id = s.id WHERE m.org_id = ?').all(req.params.id);
  res.json(meds);
});

app.put('/api/admin/medications/:id', authenticateToken, isAdmin, (req, res) => {
  const { name, category, quantity, reorder_threshold, expiry_date, price, supplier_id } = req.body;
  const medId = req.params.id;
  const med = db.prepare('SELECT org_id, name FROM medications WHERE id = ?').get(medId);
  if (!med) return res.status(404).json({ error: "Medication not found." });
  
  db.prepare('UPDATE medications SET name = ?, category = ?, quantity = ?, reorder_threshold = ?, expiry_date = ?, price = ?, supplier_id = ? WHERE id = ?')
    .run(name, category, quantity, reorder_threshold, expiry_date, price, supplier_id || null, medId);
  db.refreshAlerts(med.org_id);
  logActivity(med.org_id, req.user.id, 'UPDATE', `Admin modified stock: ${med.name}`);
  res.json({ success: true });
});

app.delete('/api/admin/medications/:id', authenticateToken, isAdmin, (req, res) => {
  const medId = req.params.id;
  const med = db.prepare('SELECT org_id, name FROM medications WHERE id = ?').get(medId);
  if (med) {
    db.prepare('DELETE FROM alerts WHERE med_id = ?').run(medId);
    db.prepare('DELETE FROM medications WHERE id = ?').run(medId);
    db.refreshAlerts(med.org_id);
    logActivity(med.org_id, req.user.id, 'DELETE', `Admin deleted stock: ${med.name}`);
  }
  res.json({ success: true });
});

app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.created_at, o.name as organizationName 
    FROM users u 
    JOIN organizations o ON u.org_id = o.id
  `).all();
  res.json(users);
});

app.delete('/api/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
  if (req.params.id == req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own admin account." });
  }
  const targetUser = db.prepare('SELECT username, org_id FROM users WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (targetUser) {
    logActivity(targetUser.org_id, req.user.id, 'DELETE', `Admin deleted user account: ${targetUser.username}`);
  }
  res.json({ success: true });
});

app.delete('/api/admin/organizations/:id/medications/clear', authenticateToken, isAdmin, (req, res) => {
  const orgId = req.params.id;
  db.transaction(() => {
    db.prepare('DELETE FROM alerts WHERE org_id = ?').run(orgId);
    db.prepare('DELETE FROM medications WHERE org_id = ?').run(orgId);
  })();
  db.refreshAlerts(orgId);
  logActivity(orgId, req.user.id, 'CLEAR', 'Admin wiped organization inventory');
  res.json({ success: true });
});

app.delete('/api/admin/organizations/:id', authenticateToken, isAdmin, (req, res) => {
  const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(req.params.id);
  db.transaction(() => {
    db.prepare('DELETE FROM alerts WHERE org_id = ?').run(req.params.id);
    db.prepare('DELETE FROM medications WHERE org_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE org_id = ?').run(req.params.id);
    db.prepare('DELETE FROM organizations WHERE id = ?').run(req.params.id);
  })();
  if (org) {
    logActivity(req.params.id, req.user.id, 'DELETE', `Admin deleted entire organization: ${org.name}`);
  }
  res.json({ success: true });
});

app.listen(5000, () => console.log('Backend running on port 5000'));
