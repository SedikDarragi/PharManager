import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, Bell, MessageSquare, AlertTriangle, Send, Loader2, LogOut, User, Lock } from 'lucide-react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import './index.css'; // Import the main CSS file here

const COLORS = {
  bg: '#0A0F1E',
  card: '#161B2D',
  accent: '#00D4AA',
  navy: '#1E3A5F'
};

const API_BASE_URL = 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  const [meds, setMeds] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ totalSkus: 0, lowStock: 0, stockouts: 0, totalValue: 0 });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
      setChatHistory([{ 
        role: 'assistant', 
        content: `Good morning, ${user.username}! I'm PharmaCopilot. I've synced with your live inventory. How can I help you today?` 
      }]);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const [medsRes, alertsRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/medications`, config),
        axios.get(`${API_BASE_URL}/alerts`, config),
        axios.get(`${API_BASE_URL}/analytics/summary`, config)
      ]);
      setMeds(medsRes.data);
      setAlerts(alertsRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const url = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await axios.post(`${API_BASE_URL}${url}`, authForm);
      
      if (authMode === 'login') {
        const userData = { ...res.data.user, token: res.data.token };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      } else {
        setAuthMode('login');
        setAuthError('Registration successful! Please login.');
      }
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setChatHistory([]);
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/copilot/chat`, {
        message: chatInput,
        history: chatHistory
      }, { headers: { Authorization: `Bearer ${user.token}` } });
      setChatHistory(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting to my brain right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: COLORS.bg }}>
        <div className="bg-[#161B2D] p-8 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
          <h1 className="text-3xl font-bold text-teal-400 mb-2 flex items-center gap-2">
            <Package /> PharmaSmart
          </h1>
          <p className="text-gray-400 mb-8">{authMode === 'login' ? 'Login to manage inventory' : 'Create an account to get started'}</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-500" size={18} />
                <input type="text" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-teal-500" placeholder="Enter username" required />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                <input type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-teal-500" placeholder="Enter password" required />
              </div>
            </div>
            {authError && <p className="text-red-400 text-sm ml-1">{authError}</p>}
            <button className="w-full bg-teal-500 hover:bg-teal-400 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-500/20">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full mt-6 text-sm text-gray-400 hover:text-teal-400 transition-colors">
            {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex text-white font-sans" style={{ backgroundColor: COLORS.bg }}>
      {/* Sidebar */}
      <nav className="w-64 border-r border-gray-800 p-6 flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-teal-400 flex items-center gap-2">
          <Package /> PharmaSmart
        </h1>
        <div className="flex flex-col gap-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          <NavItem icon={<Package size={20} />} label="Inventory" />
          <NavItem icon={<Bell size={20} />} label="Alerts" count={alerts.length} />
        </div>
        <div className="mt-auto border-t border-gray-800 pt-6">
          <div className="flex items-center gap-3 mb-4 text-gray-300 px-2"><User size={20} /> <span className="font-bold">{user.username}</span></div>
          <button onClick={handleLogout} className="flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors px-2 font-semibold"><LogOut size={20} /> Logout</button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold">Inventory Dashboard</h2>
            <p className="text-gray-400">Welcome back, Pharmacist.</p>
          </div>
          <button className="bg-teal-500 hover:bg-teal-400 text-black px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-500/20">
            + New Entry
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <KPICard title="Total SKUs" value={summary.totalSkus} />
          <KPICard title="Low Stock" value={summary.lowStock} color="text-orange-400" />
          <KPICard title="Stockouts" value={summary.stockouts} color="text-red-400" />
          <KPICard title="Inventory Value" value={`$${summary.totalValue}`} />
        </div>

        <div className="bg-[#161B2D] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          <table className="w-full text-left">
            <thead className="bg-[#1E3A5F] text-teal-400 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="p-5">Medication Name</th>
                <th className="p-5">Category</th>
                <th className="p-5">Stock</th>
                <th className="p-5">Expiry</th>
                <th className="p-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {meds.map(med => (
                <tr key={med.id} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="p-5 font-semibold">{med.name}</td>
                  <td className="p-5 text-gray-400">{med.category}</td>
                  <td className="p-5">{med.quantity} Units</td>
                  <td className="p-5 text-gray-300">{med.expiry_date}</td>
                  <td className="p-5">
                    <StatusBadge qty={med.quantity} threshold={med.reorder_threshold} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Floating Copilot */}
      <div className={`fixed bottom-6 right-6 w-[400px] z-50 transition-all duration-500 transform ${isChatOpen ? 'translate-y-0' : 'translate-y-[calc(100%-60px)]'}`}>
        <div 
          className="bg-teal-500 rounded-t-2xl p-4 flex justify-between items-center cursor-pointer shadow-2xl"
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          <div className="flex items-center gap-2 text-black">
            <MessageSquare size={20} fill="black" />
            <span className="font-bold uppercase tracking-tighter text-sm">Pharmacist Copilot</span>
          </div>
          <div className="h-2 w-2 rounded-full bg-black animate-pulse" />
        </div>
        <div className="bg-[#161B2D] h-[500px] border-x border-b border-gray-800 flex flex-col p-4 shadow-2xl">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-800 p-3 rounded-2xl rounded-bl-none border border-gray-700">
                  <Loader2 size={16} className="animate-spin text-teal-400" />
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChat()}
              placeholder="Ask about your inventory..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-teal-500 transition-all"
            />
            <button 
              onClick={handleChat}
              className="absolute right-2 top-1.5 p-1.5 bg-teal-500 text-black rounded-lg hover:bg-teal-400 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const NavItem = ({ icon, label, active, count }) => (
  <div className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${active ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-gray-400 hover:bg-gray-800/50'}`}>
    <div className="flex items-center gap-3">
      {icon} <span className="font-semibold">{label}</span>
    </div>
    {count > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{count}</span>}
  </div>
);

const KPICard = ({ title, value, color = "text-white" }) => (
  <div className="bg-[#161B2D] p-6 rounded-2xl border border-gray-800 shadow-lg hover:border-gray-700 transition-all">
    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">{title}</p>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
  </div>
);

const StatusBadge = ({ qty, threshold }) => {
  let config = { label: 'Healthy', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' };
  if (qty === 0) config = { label: 'Stockout', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
  else if (qty <= threshold) config = { label: 'Low Stock', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
  
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${config.color}`}>
      {config.label}
    </span>
  );
};

export default App;
