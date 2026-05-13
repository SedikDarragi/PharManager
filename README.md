# PharManage

PharManage is a professional-grade, multi-tenant Pharmacy Management System (PMS) designed to streamline inventory control, supplier relations, and financial tracking. It features **PharmAI**, an integrated AI assistant that provides real-time insights into your stock and sales data.

![Version](https://img.shields.io/badge/version-1.0.0-teal)
![License](https://img.shields.io/badge/license-MIT-blue)

---

##  Key Features

### PharmAI Assistant
Powered by **Groq (Llama 3.1)**, PharmAI acts as a clinical co-pilot. Ask questions about your inventory levels, expiry risks, or sales performance in natural language (English or French).

### Organizational Multi-Tenancy
Built for scale. Users sign up under specific Organizations (Clinics/Pharmacies). Stock levels, supplier lists, and alerts are synchronized in real-time across all members of the same organization.

### Advanced Inventory & Suppliers
- **Smart Tracking**: Monitor stock with automatic "Low Stock" and "Expiry" alerts.
- **Supplier Directory**: Link medications to specific distributors for streamlined reordering.
- **Data Integrity**: Full CRUD operations for stock with enforced referential integrity.

### Sales & Analytics
- **Dispensing Module**: Real-time stock reduction upon sale.
- **Financial Intelligence**: Dashboard featuring revenue trend lines and category distribution charts.
- **Export Capability**: Generate one-click CSV reports for audits or accounting.

### Security & Accountability
- **Audit Trail**: A permanent, non-destructive activity log tracking who added, updated, or deleted any record.
- **Role-Based Access**: Dedicated Admin Panel for global oversight of organizations and user accounts.
- **JWT Authentication**: Secure session management with persistent language preferences.

---

## Tech Stack

**Frontend:**
- React.js (Vite)
- Tailwind CSS (UI/UX)
- Framer Motion (Animations)
- Recharts (Data Visualization)
- Lucide React (Iconography)

**Backend:**
- Node.js & Express
- Better-SQLite3 (Fast, reliable local database)
- Groq SDK (AI Inference)
- JSON Web Tokens (Security)
- Bcrypt.js (Password Hashing)

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- A Groq API Key (Get one free at [console.groq.com](https://console.groq.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SedikDarragi/PharManage.git
   cd PharManage
   ```

2. **Setup Backend**
   ```bash
   cd server
   npm install
   ```

3. **Setup Frontend**
   ```bash
   cd ../client
   npm install
   ```

4. **Environment Variables**
   Create a `.env` file in the root directory:
   ```env
   JWT_SECRET=your_secret_key
   GROQ_API_KEY=your_groq_api_key
   ```

### Running the App

**Start Server:**
`cd server && npm start`

**Start Client:**
`cd client && npm run dev`

---

## 🌍 Language Support
PharManage is fully localized in **English** and **French**. Language preferences are saved to your user profile and persist across sessions.
