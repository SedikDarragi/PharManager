// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Import Google Generative AI
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
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const info = stmt.run(username, hashedPassword);
    res.json({ success: true, userId: info.lastInsertRowid });
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

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Temporary log to check if API key is loaded
console.log("GEMINI_API_KEY loaded:", !!process.env.GEMINI_API_KEY);

// Diagnostic: List all models available to this API Key
(async () => {
  try {
    const result = await genAI.listModels();
    console.log("Available Gemini Models:");
    result.models.forEach(m => console.log(`- ${m.name}`));
  } catch (error) {
    console.error("Could not list models. Check if your API Key is valid.");
  }
})();

// Using gemini-1.5-flash as it's the current standard and highly available
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// THE COPILOT ENDPOINT: The Unique Differentiator
app.post('/api/copilot/chat', authenticateToken, async (req, res) => {
  const { message, history } = req.body;

  try {
    // 1. Context Gathering: Fetch current state of the pharmacy
    db.refreshAlerts();
    const inventory = db.prepare('SELECT * FROM medications WHERE user_id = ?').all(req.user.id);
    const alerts = db.prepare("SELECT alerts.* FROM alerts JOIN medications ON alerts.med_id = medications.id WHERE medications.user_id = ? AND status = 'active'").all(req.user.id);
    const today = new Date().toISOString().split('T')[0];

    // 2. Build the System Prompt
    const systemPrompt = `You are PharmaCopilot, an expert AI pharmacist assistant. 
    You have real-time access to the pharmacy inventory. 
    CURRENT DATE: ${today}
    
    CURRENT INVENTORY DATA:
    ${JSON.stringify(inventory)}
    
    ACTIVE ALERTS:
    ${JSON.stringify(alerts)}
    
    Instructions:
    - Answer questions based ONLY on the provided data.
    - Be proactive. If the user asks about stock, mention upcoming expiries if relevant.
    - Keep responses professional, concise, and clinical.
    - Use Markdown for tables or lists.`;

    // 3. Call Gemini
    // Convert history to Gemini format (user/model roles)
    const geminiHistory = history
      .filter((msg, index) => !(index === 0 && msg.role === 'assistant'))
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model', // Gemini uses 'model' for assistant responses
        parts: [{ text: msg.content }]
      }));

    // Prepend the system prompt to the current user message for each turn.
    // This ensures the system context is always fresh and explicitly provided
    // to the model, as Gemini Pro doesn't have a dedicated 'system' role.
    const fullUserMessage = `${systemPrompt}\n\nUser's Query: ${message}`;

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: 1024, // Equivalent to Anthropic's max_tokens
      },
    });

    const result = await chat.sendMessage(fullUserMessage);
    const responseText = result.response.text();

    res.json({ reply: responseText });
  } catch (error) {
    console.error("Copilot Error:", error);
    res.status(500).json({ error: "Copilot is resting. Try again later. (Gemini API Error)" });
  }
});

// Inventory Routes
app.get('/api/medications', authenticateToken, (req, res) => {
  const meds = db.prepare('SELECT * FROM medications WHERE user_id = ?').all(req.user.id);
  res.json(meds);
});

app.post('/api/medications', authenticateToken, (req, res) => {
  const { name, category, quantity, reorder_threshold, expiry_date, price } = req.body;
  const stmt = db.prepare(`
    INSERT INTO medications (user_id, name, category, quantity, reorder_threshold, expiry_date, price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(req.user.id, name, category, quantity, reorder_threshold, expiry_date, price);
  db.refreshAlerts();
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/medications/:id', authenticateToken, (req, res) => {
  const { quantity } = req.body;
  db.prepare('UPDATE medications SET quantity = ? WHERE id = ? AND user_id = ?').run(quantity, req.params.id, req.user.id);
  db.refreshAlerts();
  res.json({ success: true });
});

app.delete('/api/medications/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM medications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  db.refreshAlerts();
  res.json({ success: true });
});

app.get('/api/alerts', authenticateToken, (req, res) => {
  db.refreshAlerts();
  const alerts = db.prepare("SELECT alerts.* FROM alerts JOIN medications ON alerts.med_id = medications.id WHERE medications.user_id = ? AND status = 'active'").all(req.user.id);
  res.json(alerts);
});

app.post('/api/alerts/:id/dismiss', authenticateToken, (req, res) => {
  db.prepare("UPDATE alerts SET status = 'dismissed' WHERE id = ? AND id IN (SELECT id FROM alerts JOIN medications ON alerts.med_id = medications.id WHERE medications.user_id = ?)").run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.get('/api/analytics/summary', authenticateToken, (req, res) => {
  const totalSkus = db.prepare('SELECT COUNT(*) as count FROM medications WHERE user_id = ?').get(req.user.id).count;
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM medications WHERE user_id = ? AND quantity <= reorder_threshold AND quantity > 0').get(req.user.id).count;
  const stockouts = db.prepare('SELECT COUNT(*) as count FROM medications WHERE user_id = ? AND quantity = 0').get(req.user.id).count;
  const val = db.prepare('SELECT SUM(quantity * price) as val FROM medications WHERE user_id = ?').get(req.user.id).val || 0;
  const totalValue = Number(val).toFixed(2);
  
  res.json({ totalSkus, lowStock, stockouts, totalValue });
});

app.listen(5000, () => console.log('Backend running on port 5000'));
