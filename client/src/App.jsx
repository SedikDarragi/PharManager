import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, Bell, MessageSquare, AlertTriangle, Send, Loader2, LogOut, User, Lock, X } from 'lucide-react';
import axios from 'axios';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
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
  const [showWelcomeAlertsPopup, setShowWelcomeAlertsPopup] = useState(false); // State for welcome alerts popup
  const [activeView, setActiveView] = useState('dashboard'); // New state for active view
  const [categoryData, setCategoryData] = useState([]);
  
  // State for Add Medication Modal
  const [showAddMedicationModal, setShowAddMedicationModal] = useState(false);
  const [newMedicationForm, setNewMedicationForm] = useState({
    name: '',
    category: '',
    quantity: 0,
    reorder_threshold: 0,
    expiry_date: '', // YYYY-MM-DD format
    price: 0,
  });

  useEffect(() => {
    if (user) {
      const initializeDashboard = async () => {
        await fetchData();
        setChatHistory([{
          role: 'assistant',
          content: `Good morning, ${user.username}! I'm PharmaCopilot. I've synced with your live inventory. How can I help you today?`
        }]);
      };
      initializeDashboard();
    }
  }, [user]);

  useEffect(() => {
    // Show welcome alerts popup only once per session after alerts are fetched
    if (user && alerts.length > 0 && !sessionStorage.getItem('hasShownWelcomeAlerts')) {
      setShowWelcomeAlertsPopup(true);
      sessionStorage.setItem('hasShownWelcomeAlerts', 'true');
      setChatHistory([{ 
        role: 'assistant', 
        content: `Good morning, ${user.username}! I'm PharmaCopilot. I've synced with your live inventory. How can I help you today?` 
      }]);
    }
  }, [alerts, user]); // Depend on alerts and user

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

      // Prepare data for Category Distribution Pie Chart
      const categoryCounts = medsRes.data.reduce((acc, med) => {
        acc[med.category] = (acc[med.category] || 0) + 1;
        return acc;
      }, {});
      setCategoryData(Object.entries(categoryCounts).map(([category, count]) => ({ name: category, value: count })));

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
      } else { // Registration successful, autologin the user
        const userData = { ...res.data.user, token: res.data.token };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
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

  const openAddMedicationModal = () => {
    setShowAddMedicationModal(true);
    setNewMedicationForm({ // Reset form when opening
      name: '',
      category: '',
      quantity: 0,
      reorder_threshold: 0,
      expiry_date: '',
      price: 0,
    });
  };

  const closeAddMedicationModal = () => {
    setShowAddMedicationModal(false);
  };

  const handleNewMedicationChange = (e) => {
    const { name, value, type } = e.target;
    setNewMedicationForm(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
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

  const handleDismissAlert = async (alertId) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_BASE_URL}/alerts/${alertId}/dismiss`, {}, config);
      fetchData(); // Refresh alerts after dismissing one
    } catch (err) {
      console.error("Error dismissing alert:", err);
      setAuthError(err.response?.data?.error || 'Failed to dismiss alert.');
    }
  };

  const handleAddMedicationSubmit = async (e) => {
    e.preventDefault();
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_BASE_URL}/medications`, newMedicationForm, config);
      closeAddMedicationModal();
      fetchData(); // Refresh data after adding
    } catch (err) {
      console.error("Error adding medication:", err);
      setAuthError(err.response?.data?.error || 'Failed to add medication.'); // Reusing authError for simplicity, consider a dedicated error state
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

  const stockStatusData = [
    { name: 'Low Stock', value: summary.lowStock, color: '#fbbf24' },
    { name: 'Stockouts', value: summary.stockouts, color: '#ef4444' },
    { name: 'Healthy', value: Math.max(0, summary.totalSkus - summary.lowStock - summary.stockouts), color: '#00D4AA' }
  ];

  return (
    <div className="min-h-screen flex text-white font-sans" style={{ backgroundColor: COLORS.bg }}>
      {/* Sidebar */}
      <nav className="w-64 border-r border-gray-800 p-6 flex flex-col gap-8">
        <h1 className="text-2xl font-bold text-teal-400 flex items-center gap-2">
          <Package /> PharmaSmart
        </h1>
        <div className="flex flex-col gap-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" isActive={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} />
          <NavItem icon={<Package size={20} />} label="Inventory" isActive={activeView === 'inventory'} onClick={() => setActiveView('inventory')} />
          <NavItem icon={<Bell size={20} />} label="Alerts" isActive={activeView === 'alerts'} onClick={() => setActiveView('alerts')} count={alerts.length} />
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
          <button onClick={openAddMedicationModal} className="bg-teal-500 hover:bg-teal-400 text-black px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-500/20">
            + New Entry
          </button>
        </header>

        {activeView === 'dashboard' && (
          <>
            {/* Inventory Analytics Section */}
            <div className="mb-10">
              <h3 className="text-2xl font-bold text-teal-400 mb-6">Inventory Analytics</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stock Status Bar Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="bg-[#161B2D] p-6 rounded-2xl border border-gray-800 shadow-lg"
                >
                  <h4 className="text-xl font-semibold mb-4">Stock Status Overview</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stockStatusData}>
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.navy}`, borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar dataKey="value">
                        {stockStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Category Distribution Pie Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="bg-[#161B2D] p-6 rounded-2xl border border-gray-800 shadow-lg"
                >
                  <h4 className="text-xl font-semibold mb-4">Medication Categories</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#00D4AA', '#fbbf24', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'][index % 6]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.navy}`, borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
                      <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>
            </div>

            {/* KPI Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
              <KPICard title="Total SKUs" value={summary.totalSkus} />
              <KPICard title="Low Stock" value={summary.lowStock} color="text-orange-400" />
              <KPICard title="Stockouts" value={summary.stockouts} color="text-red-400" />
              <KPICard title="Inventory Value" value={`$${summary.totalValue}`} />
            </div>
          </>
        )}

        {(activeView === 'dashboard' || activeView === 'inventory') && (
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
                  <motion.tr
                    whileHover={{ backgroundColor: 'rgba(30, 58, 95, 0.3)' }} // Equivalent to navy-accent with opacity
                    key={med.id} className="group">
                    <td className="p-5 font-semibold">{med.name}</td>
                    <td className="p-5 text-gray-400">{med.category}</td>
                    <td className="p-5">{med.quantity} Units</td>
                    <td className="p-5 text-gray-300">{med.expiry_date}</td>
                    <td className="p-5">
                      <StatusBadge qty={med.quantity} threshold={med.reorder_threshold} />
                    </td>
                  </motion.tr>
                ))} 
              </tbody>
            </table>
          </div>
        )}

        {activeView === 'alerts' && (
          <div className="bg-[#161B2D] p-6 rounded-2xl border border-gray-800 shadow-xl min-h-[200px]">
            <h3 className="text-2xl font-bold text-red-400 mb-4">Active Alerts</h3>
            {alerts.length === 0 ? (
              <p className="text-gray-400">No active alerts at the moment. Your inventory is in good shape!</p>
            ) : (
              <div className="space-y-4">
                {alerts.map(alert => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between p-4 bg-gray-900 border border-red-700/50 rounded-lg shadow-md"
                  >
                    <div className="flex items-center gap-3 text-red-300">
                      <AlertTriangle size={20} className="text-red-500" />
                      <span className="font-medium">{alert.message}</span>
                    </div>
                    <button
                      onClick={() => handleDismissAlert(alert.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                      title="Dismiss Alert"
                    >
                      <X size={18} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Welcome Alerts Notifications Stack - Top Right */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none items-end">
        <AnimatePresence>
          {showWelcomeAlertsPopup && alerts.map((alert) => (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-80 bg-[#161B2D]/95 backdrop-blur-md p-4 rounded-xl border border-red-900/30 shadow-2xl pointer-events-auto flex items-start gap-3"
            >
              <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-100 text-sm leading-relaxed">{alert.message}</p>
              </div>
              <button
                onClick={() => handleDismissAlert(alert.id)}
                className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Copilot */}
      <motion.div
        // Framer Motion will handle the animation based on isChatOpen state
        initial={false} // Prevents initial animation on mount
        animate={{ y: isChatOpen ? 0 : 'calc(100% - 60px)' }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        // Remove Tailwind's transition classes as Framer Motion handles it
        className="fixed bottom-6 right-6 w-[400px] z-50"
      >
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
        <div className="bg-[#161B2D] h-[500px] border-x border-b border-gray-800 flex flex-col p-4 shadow-2xl overflow-hidden"> {/* Added overflow-hidden */}
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
      </motion.div>

      {/* Add Medication Modal */}
      <AnimatePresence>
        {showAddMedicationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[#161B2D] p-8 rounded-2xl border border-gray-800 w-full max-w-lg shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-teal-400 mb-6">Add New Medication</h3>
              <form onSubmit={handleAddMedicationSubmit} className="space-y-4">
                <div className="flex flex-col">
                  <label htmlFor="name" className="text-sm text-gray-400 mb-1">Name</label>
                  <input type="text" id="name" name="name" value={newMedicationForm.name} onChange={handleNewMedicationChange} className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" required />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="category" className="text-sm text-gray-400 mb-1">Category</label>
                  <input type="text" id="category" name="category" value={newMedicationForm.category} onChange={handleNewMedicationChange} className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" required />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="quantity" className="text-sm text-gray-400 mb-1">Quantity</label>
                  <input type="number" id="quantity" name="quantity" value={newMedicationForm.quantity} onChange={handleNewMedicationChange} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" min="0" required />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="reorder_threshold" className="text-sm text-gray-400 mb-1">Reorder Threshold</label>
                  <input type="number" id="reorder_threshold" name="reorder_threshold" value={newMedicationForm.reorder_threshold} onChange={handleNewMedicationChange} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" min="0" required />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="expiry_date" className="text-sm text-gray-400 mb-1">Expiry Date</label>
                  <input type="date" id="expiry_date" name="expiry_date" value={newMedicationForm.expiry_date} onChange={handleNewMedicationChange} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" required />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="price" className="text-sm text-gray-400 mb-1">Price</label>
                  <input type="number" id="price" name="price" value={newMedicationForm.price} onChange={handleNewMedicationChange} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" min="0" step="0.01" required />
                </div>

                {authError && <p className="text-red-400 text-sm ml-1">{authError}</p>}

                <div className="flex justify-end gap-4 mt-6">
                  <button 
                    type="button" 
                    onClick={closeAddMedicationModal} 
                    className="px-5 py-2.5 rounded-xl text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-teal-500 hover:bg-teal-400 text-black px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-500/20"
                  >
                    Add Medication
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const NavItem = ({ icon, label, isActive, count, onClick }) => (
  <motion.div
    whileHover={{ scale: 1.02, x: 5 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer ${isActive ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-gray-400 hover:bg-gray-800/50'}`}
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      {icon} <span className="font-semibold">{label}</span>
    </div>
    {count > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{count}</span>}
  </motion.div>
);

const KPICard = ({ title, value, color = "text-white" }) => (
  <motion.div
    whileHover={{ scale: 1.03 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    className="bg-[#161B2D] p-6 rounded-2xl border border-gray-800 shadow-lg hover:border-gray-700"
  >
    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">{title}</p>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
  </motion.div>
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
