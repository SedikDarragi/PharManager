# PharManage - AI-Powered Pharmacy Inventory Management

PharManage is a modern, full-stack inventory management system designed specifically for pharmacies. It features a real-time dashboard, automated alerting for low stock and expiration dates, and an integrated AI Copilot to assist pharmacists with clinical and inventory insights.

## Features

- **Inventory Management**: Complete CRUD operations for medications including tracking by category, quantity, price, and expiry date.
- **AI Pharmacist Copilot**: Built-in assistant powered by Google Gemini 1.5 Flash that analyzes live inventory data to answer queries and provide proactive suggestions.
- **Analytics Dashboard**: Visual representations of stock status (Healthy, Low Stock, Stockout) and category distribution using interactive charts.
- **Smart Alerting**: Persistent notifications for stock levels falling to 5 units or lower and upcoming/past medication expiries.
- **Secure Authentication**: JWT-based user authentication and password hashing with Bcrypt.
- **Modern UI**: A responsive, dark-themed interface built with React, Tailwind CSS, and Framer Motion for smooth transitions.

## Environment & Tech Stack

### Frontend
- **React (Vite)**: Component-based UI development.
- **Tailwind CSS**: Utility-first styling.
- **Framer Motion**: Advanced UI animations and modal transitions.
- **Recharts**: Interactive data visualization and charts.
- **Axios**: HTTP client for API communication.

### Backend
- **Node.js & Express**: Server-side runtime and API framework.
- **SQLite (better-sqlite3)**: Lightweight, high-performance relational database.
- **JWT**: Secure token-based session management.
- **Google Generative AI**: Integration with Gemini 1.5 Flash for the AI Copilot.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- npm (comes with Node.js)
- A [Google AI Studio](https://aistudio.google.com/) API key.

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd pharmanage
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory of the project:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   JWT_SECRET=a_secure_random_string_for_jwt
   ```

3. **Install Server Dependencies**:
   ```bash
   cd server
   npm install
   ```

4. **Install Client Dependencies**:
   ```bash
   cd ../client
   npm install
   ```

## Running the Application

### 1. Start the Backend Server
From the `server` directory:
```bash
node server.js
```
The server will start on `http://localhost:5000`. It will automatically initialize the SQLite database (`pharmacy.db`) and seed initial data if needed.

### 2. Start the Frontend Client
From the `client` directory:
```bash
npm run dev
```
The application will typically be accessible at `http://localhost:5173`.

## License
Distributed under the MIT License.
