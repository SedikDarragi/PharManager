// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Import Google Generative AI
const db = require('./db/database');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // Using gemini-pro model

// THE COPILOT ENDPOINT: The Unique Differentiator
app.post('/api/copilot/chat', async (req, res) => {
  const { message, history } = req.body;

  try {
    // 1. Context Gathering: Fetch current state of the pharmacy
    db.refreshAlerts();
    const inventory = db.prepare('SELECT * FROM medications').all();
    const alerts = db.prepare("SELECT * FROM alerts WHERE status = 'active'").all();
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
    const geminiHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model', // Gemini uses 'model' for assistant responses
      parts: [{ text: msg.content }]
    }));
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
app.get('/api/medications', (req, res) => {
  const meds = db.prepare('SELECT * FROM medications').all();
  res.json(meds);
});

app.post('/api/medications', (req, res) => {
  const { name, category, quantity, reorder_threshold, expiry_date, price } = req.body;
  const stmt = db.prepare(`
    INSERT INTO medications (name, category, quantity, reorder_threshold, expiry_date, price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, category, quantity, reorder_threshold, expiry_date, price);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/medications/:id', (req, res) => {
  const { quantity } = req.body;
  db.prepare('UPDATE medications SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
  res.json({ success: true });
});

app.delete('/api/medications/:id', (req, res) => {
  db.prepare('DELETE FROM medications WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/alerts', (req, res) => {
  db.refreshAlerts();
  const alerts = db.prepare("SELECT * FROM alerts WHERE status = 'active'").all();
  res.json(alerts);
});

app.post('/api/alerts/:id/dismiss', (req, res) => {
  db.prepare("UPDATE alerts SET status = 'dismissed' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get('/api/analytics/summary', (req, res) => {
  const totalSkus = db.prepare('SELECT COUNT(*) as count FROM medications').get().count;
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM medications WHERE quantity <= reorder_threshold AND quantity > 0').get().count;
  const stockouts = db.prepare('SELECT COUNT(*) as count FROM medications WHERE quantity = 0').get().count;
  const totalValue = db.prepare('SELECT SUM(quantity * price) as val FROM medications').get().val || 0;
  
  res.json({ totalSkus, lowStock, stockouts, totalValue: totalValue.toFixed(2) });
});

app.listen(5000, () => console.log('Backend running on port 5000'));
