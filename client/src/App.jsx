import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Package, Bell, MessageSquare, AlertTriangle, Send, Loader2, LogOut, User, Lock, X, Pencil, Trash2, Shield, Building2, Users, History, PlusCircle, RefreshCw, XCircle, Truck, Phone, Mail, ShoppingCart, TrendingUp, DollarSign, Download } from 'lucide-react';
import axios from 'axios';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
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
  const [authForm, setAuthForm] = useState({ username: '', password: '', organizationName: '' });
  const [authError, setAuthError] = useState('');

  const [meds, setMeds] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ totalSkus: 0, lowStock: 0, stockouts: 0, totalValue: 0 });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showWelcomeAlertsPopup, setShowWelcomeAlertsPopup] = useState(false); // State for welcome alerts popup

  // Activity History State
  const [activityLogs, setActivityLogs] = useState([]);

  // Sales State
  const [salesRecords, setSalesRecords] = useState([]);
  const [revenueChartData, setRevenueData] = useState([]);

  // Supplier State
  const [suppliers, setSuppliers] = useState([]);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: ''
  });

  // Profile & Settings State
  const [orgDetails, setOrgDetails] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  
  // Admin Panel State
  const [adminOrgs, setAdminOrgs] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [showAdminOrgStocksModal, setShowAdminOrgStocksModal] = useState(false);
  const [adminSelectedOrgMeds, setAdminSelectedOrgMeds] = useState([]);
  const [adminSelectedOrgUsers, setAdminSelectedOrgUsers] = useState([]);
  const [adminSelectedOrgName, setAdminSelectedOrgName] = useState('');
  const [adminSelectedOrgId, setAdminSelectedOrgId] = useState(null);
  const [isAdminAction, setIsAdminAction] = useState(false);
  const [adminModalTab, setAdminModalTab] = useState('inventory'); // 'inventory' or 'team'

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
    supplier_id: ''
  });
  
  // State for Edit Medication Modal
  const [showEditMedicationModal, setShowEditMedicationModal] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null); // Stores the medication object being edited

  // State for Delete Confirmation Modal
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
  const [medicationToDeleteId, setMedicationToDeleteId] = useState(null); // Stores the ID of the medication to delete
  const [deleteConfirmInput, setDeleteConfirmInput] = useState(''); // Text confirmation for single delete

  // State for Clear Stock feature
  const [showClearStockModal, setShowClearStockModal] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState('');




  useEffect(() => {
    if (user) {
      const initializeDashboard = async () => {
        await fetchData();
        await fetchSalesData();
        await fetchSuppliers();
        setChatHistory([{
          role: 'assistant',
          content: `Good morning, ${user.username}! I'm PharmAI. I've synced with your live inventory. How can I help you today?`
        }]);
      };
      initializeDashboard();
    }
  }, [user]);

  const notifiedAlertIds = useRef(new Set());

  useEffect(() => {
    // Cleanup notified list: remove IDs that are no longer in the current active alerts list.
    // This ensures that if an alert is re-activated, we treat it as "new".
    const currentIds = new Set(alerts.map(a => a.id));
    notifiedAlertIds.current.forEach(id => {
      if (!currentIds.has(id)) notifiedAlertIds.current.delete(id);
    });

    // Only auto-show the popup stack if we detect a brand new alert ID
    const hasNewAlerts = alerts.some(alert => !notifiedAlertIds.current.has(alert.id));
    
    if (user && user.role !== 'admin' && alerts.length > 0 && hasNewAlerts) {
      setShowWelcomeAlertsPopup(true);
      // Mark these as "notified" so they don't re-trigger the popup state
      alerts.forEach(alert => notifiedAlertIds.current.add(alert.id));
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
      // If the user ID no longer exists in the DB, log them out
      if (err.response?.status === 401) {
        handleLogout();
        setAuthError('Your session has expired. Please log in again.');
      }
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const res = await axios.get(`${API_BASE_URL}/activity-logs`, config);
      setActivityLogs(res.data);
    } catch (err) {
      console.error("Logs fetch error:", err);
    }
  };

  const fetchSalesData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const [salesRes, revRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/sales`, config),
        axios.get(`${API_BASE_URL}/analytics/revenue`, config)
      ]);
      setSalesRecords(salesRes.data);
      setRevenueData(revRes.data);
    } catch (err) {
      console.error("Sales fetch error:", err);
    }
  };

  useEffect(() => {
    if (user) {
      if (activeView === 'history') fetchActivityLogs();
      if (activeView === 'sales') fetchSalesData();
    }
  }, [activeView, user]);

  const fetchSuppliers = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const res = await axios.get(`${API_BASE_URL}/suppliers`, config);
      setSuppliers(res.data);
    } catch (err) {
      console.error("Suppliers fetch error:", err);
    }
  };

  useEffect(() => {
    if (user) fetchSuppliers();
  }, [user]);

  const fetchProfileData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const [orgRes, membersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/organization/details`, config),
        axios.get(`${API_BASE_URL}/organization/members`, config)
      ]);
      setOrgDetails(orgRes.data);
      setOrgMembers(membersRes.data);
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const [orgsRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/admin/organizations`, config),
        axios.get(`${API_BASE_URL}/admin/users`, config)
      ]);
      setAdminOrgs(orgsRes.data);
      setAdminUsers(usersRes.data);
    } catch (err) {
      console.error("Admin data fetch error:", err);
      if (err.response?.status === 403) {
        setActiveView('dashboard');
      }
    }
  };

  useEffect(() => {
    if (activeView === 'profile' && user) {
      fetchProfileData();
    }
  }, [activeView, user]);

  useEffect(() => {
    if (activeView === 'admin' && user?.role === 'admin') {
      fetchAdminData();
    }
  }, [activeView, user]);

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
        if (userData.role === 'admin') setActiveView('admin');
      } else { // Registration successful, autologin the user
        const userData = { ...res.data.user, token: res.data.token };
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        if (userData.role === 'admin') setActiveView('admin');
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
    setAuthError(''); // Clear any previous errors
    setShowAddMedicationModal(true);
    setNewMedicationForm({ // Reset form when opening
      name: '',
      category: '',
      quantity: 0,
      reorder_threshold: 0,
      // Ensure expiry_date is a valid string for the input type="date"
      expiry_date: '',
      price: 0,
      supplier_id: ''
    });
  };

  const closeAddMedicationModal = () => {
    setShowAddMedicationModal(false);
  };

  const closeEditMedicationModal = () => {
    setShowEditMedicationModal(false);
    setEditingMedication(null);
    setIsAdminAction(false);
  };

  const closeDeleteConfirmation = () => {
    setMedicationToDeleteId(null);
    setShowDeleteConfirmationModal(false);
    setIsAdminAction(false);
  };

  const openEditMedicationModal = (med) => {
    setAuthError(''); // Clear any previous errors
    setEditingMedication({ ...med }); // Clone the medication object to avoid direct state mutation
    setShowEditMedicationModal(true);
  };

  const openDeleteConfirmation = (medId) => {
    setAuthError(''); // Clear any previous errors
    setDeleteConfirmInput(''); // Reset confirmation text
    setMedicationToDeleteId(medId);
    setShowDeleteConfirmationModal(true);
  };

  // The handleClearStockSubmit function is correctly defined below and referenced by the form's onSubmit

  const handleNewMedicationChange = (e) => {
    const { name, value, type } = e.target;
    setNewMedicationForm(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleNewSupplierChange = (e) => {
    const { name, value } = e.target;
    setNewSupplierForm(prev => ({
      ...prev,
      [name]: value
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
    setAuthError(''); // Clear any previous errors
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
    setAuthError(''); // Clear any previous errors
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

  const handleAddSupplierSubmit = async (e) => {
    e.preventDefault();
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_BASE_URL}/suppliers`, newSupplierForm, config);
      setShowAddSupplierModal(false);
      fetchSuppliers();
    } catch (err) {
      alert("Failed to add supplier");
    }
  };

  const handleEditMedicationChange = (e) => {
    const { name, value, type } = e.target;
    setEditingMedication(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleUpdateMedicationSubmit = async (e) => {
    e.preventDefault();
    setAuthError(''); // Clear any previous errors
    if (!editingMedication) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const url = isAdminAction 
        ? `${API_BASE_URL}/admin/medications/${editingMedication.id}`
        : `${API_BASE_URL}/medications/${editingMedication.id}`;

      await axios.put(url, editingMedication, config);
      closeEditMedicationModal();
      
      if (isAdminAction) {
        handleViewOrgStocks(adminSelectedOrgId, adminSelectedOrgName);
        fetchAdminData();
      } else {
        fetchData(); // Refresh data after updating
      }
    } catch (err) {
      console.error("Error updating medication:", err);
      setAuthError(err.response?.data?.error || 'Failed to update medication.');
    }
  };

  const confirmDeleteMedication = async () => {
    setAuthError(''); // Clear any previous errors
    if (deleteConfirmInput !== 'delete') {
      setAuthError('Please type "delete" to confirm.');
      return;
    }

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const url = isAdminAction
        ? `${API_BASE_URL}/admin/medications/${medicationToDeleteId}`
        : `${API_BASE_URL}/medications/${medicationToDeleteId}`;

      await axios.delete(url, config);
      closeDeleteConfirmation();
      
      if (isAdminAction) {
        handleViewOrgStocks(adminSelectedOrgId, adminSelectedOrgName);
        fetchAdminData();
      } else {
        fetchData(); // Refresh data after deleting
      }
    } catch (err) {
      console.error("Error deleting medication:", err);
      setAuthError(err.response?.data?.error || 'Failed to delete medication.');
    }
  };

  const handleAdminDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${API_BASE_URL}/admin/users/${userId}`, config);
      fetchAdminData();
      // If we are currently looking at an org's details in a modal, refresh that list too
      if (showAdminOrgStocksModal && adminSelectedOrgId) {
        handleViewOrgStocks(adminSelectedOrgId, adminSelectedOrgName);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete user");
    }
  };

  const handleAdminDeleteOrg = async (orgId, orgName) => {
    if (!window.confirm(`Are you sure you want to delete organization "${orgName}"? This will delete all users and stock records for this branch.`)) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${API_BASE_URL}/admin/organizations/${orgId}`, config);
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete organization");
    }
  };

  const handleViewOrgStocks = async (orgId, orgName) => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const [medsRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/admin/organizations/${orgId}/medications`, config),
        axios.get(`${API_BASE_URL}/admin/organizations/${orgId}/users`, config)
      ]);
      setAdminSelectedOrgMeds(medsRes.data);
      setAdminSelectedOrgUsers(usersRes.data);
      setAdminSelectedOrgName(orgName);
      setAdminSelectedOrgId(orgId);
      setShowAdminOrgStocksModal(true);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to fetch organization stocks");
    }
  };

  const handleDispenseMedication = async (medId) => {
    const dispenseQty = prompt(`How many units to dispense?`, "1");
    if (!dispenseQty || isNaN(dispenseQty) || parseInt(dispenseQty) <= 0) return;

    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.post(`${API_BASE_URL}/sales`, { 
        medId, 
        quantity: parseInt(dispenseQty)
      }, config);
      await fetchData(); // Refresh inventory and summary
      await fetchSalesData(); // Refresh sales history and revenue charts
      alert("Dispensing successful!");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to dispense medication");
    }
  };

  const handleExportInventory = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const res = await axios.get(`${API_BASE_URL}/medications/export`, config);
      const data = res.data;

      if (data.length === 0) {
        alert("No data available to export.");
        return;
      }

      // CSV Generation
      const headers = ["Name", "Category", "Supplier", "Quantity", "Reorder Threshold", "Expiry Date", "Price ($)"];
      const csvRows = [
        headers.join(','), // Header row
        ...data.map(row => [
          `"${row.name}"`, `"${row.category}"`, `"${row.supplier_name || 'N/A'}"`, 
          row.quantity, row.reorder_threshold, row.expiry_date, row.price
        ].join(','))
      ];

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pharmanage_inventory_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export inventory data.");
    }
  };

  const handleClearStockSubmit = async (e) => {
    e.preventDefault();
    setAuthError(''); // Clear any previous errors
    if (clearConfirmInput !== 'delete') {
      setAuthError('Please type "delete" to confirm.');
      return;
    }
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const url = isAdminAction
        ? `${API_BASE_URL}/admin/organizations/${adminSelectedOrgId}/medications/clear`
        : `${API_BASE_URL}/medications/all/clear`;

      await axios.delete(url, config);
      setShowClearStockModal(false);
      setClearConfirmInput('');
      setAuthError('');
      
      if (isAdminAction) {
        handleViewOrgStocks(adminSelectedOrgId, adminSelectedOrgName);
        fetchAdminData();
        setIsAdminAction(false);
      } else {
        fetchData();
      }
    } catch (err) {
      console.error("Error clearing stock:", err);
      setAuthError('Failed to clear database.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: COLORS.bg }}>
        <div className="bg-[#161B2D] p-8 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
          <h1 className="text-3xl font-bold text-teal-400 mb-2 flex items-center gap-2">
            <Package /> PharManage
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
            {authMode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Organization Name</label>
                <div className="relative">
                  <Package className="absolute left-3 top-3 text-gray-500" size={18} />
                  <input type="text" value={authForm.organizationName} onChange={e => setAuthForm({...authForm, organizationName: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-teal-500" placeholder="Pharmacy Name" required />
                </div>
              </div>
            )}
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
    <div className="h-screen flex text-white font-sans overflow-hidden" style={{ backgroundColor: COLORS.bg }}>
      {/* Sidebar */}
      <nav className="w-64 border-r border-gray-800 p-6 flex flex-col gap-8 shrink-0 overflow-y-auto">
        <h1 className="text-2xl font-bold text-teal-400 flex items-center gap-2">
          <Package /> PharManage
        </h1>
        <div className="flex flex-col gap-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" isActive={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} />
          <NavItem icon={<Package size={20} />} label="Inventory" isActive={activeView === 'inventory'} onClick={() => setActiveView('inventory')} />
          <NavItem icon={<DollarSign size={20} />} label="Sales" isActive={activeView === 'sales'} onClick={() => setActiveView('sales')} />
          <NavItem icon={<Truck size={20} />} label="Suppliers" isActive={activeView === 'suppliers'} onClick={() => setActiveView('suppliers')} />
          <NavItem icon={<History size={20} />} label="History" isActive={activeView === 'history'} onClick={() => setActiveView('history')} />
          {user.role !== 'admin' && (
            <NavItem icon={<Bell size={20} />} label="Alerts" isActive={activeView === 'alerts'} onClick={() => setActiveView('alerts')} count={alerts.length} />
          )}
          {user.role === 'admin' && (
            <NavItem icon={<Shield size={20} />} label="Admin Panel" isActive={activeView === 'admin'} onClick={() => setActiveView('admin')} />
          )}
        </div>
        <div className="mt-auto border-t border-gray-800 pt-6">
          <button onClick={() => setActiveView('profile')} className={`flex items-center gap-3 mb-4 w-full px-2 py-2 rounded-xl transition-all ${activeView === 'profile' ? 'text-teal-400 bg-teal-500/10 border border-teal-500/20' : 'text-gray-300 hover:text-teal-400'}`}>
            <User size={20} /> <span className="font-bold">{user.username}</span>
          </button>
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
          <div className="flex gap-4 items-center">
            <button onClick={handleExportInventory} className="bg-gray-800 hover:bg-gray-700 text-gray-300 p-2.5 rounded-xl border border-gray-700 transition-all flex items-center gap-2" title="Export to CSV">
              <Download size={20} /> <span className="text-sm font-bold">Export</span>
            </button>
            <button onClick={() => { setIsAdminAction(false); setAuthError(''); setShowClearStockModal(true); }} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-2.5 rounded-xl font-bold transition-all border border-red-500/20">
              Clear Stock
            </button>
            <button onClick={openAddMedicationModal} className="bg-teal-500 hover:bg-teal-400 text-black px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-500/20">
              + New Entry
            </button>
          </div>
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

        {activeView === 'suppliers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-teal-400">Supplier Directory</h3>
              <button onClick={() => setShowAddSupplierModal(true)} className="bg-teal-500 hover:bg-teal-400 text-black px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-teal-500/20">
                + Add Supplier
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suppliers.map(s => (
                <div key={s.id} className="bg-[#161B2D] p-6 rounded-2xl border border-gray-800 shadow-lg relative group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center text-teal-400 border border-teal-500/20">
                      <Truck size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-white">{s.name}</h4>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{s.contact_name}</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Mail size={14} className="text-teal-500" /> {s.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Phone size={14} className="text-teal-500" /> {s.phone}
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      if(window.confirm('Delete this supplier?')) {
                        const config = { headers: { Authorization: `Bearer ${user.token}` } };
                        await axios.delete(`${API_BASE_URL}/suppliers/${s.id}`, config);
                        fetchSuppliers();
                      }
                    }}
                    className="absolute top-4 right-4 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeView === 'sales' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#161B2D] p-6 rounded-2xl border border-gray-800 shadow-xl">
                <h3 className="text-xl font-bold text-teal-400 mb-6 flex items-center gap-2">
                  <TrendingUp size={20}/> Revenue Trend (Last 7 Days)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} tickFormatter={(str) => str.split('-').slice(1).join('/')} />
                      <YAxis stroke="#9CA3AF" fontSize={10} tickFormatter={(val) => `$${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: COLORS.card, border: '1px solid #374151', borderRadius: '12px' }}
                        itemStyle={{ color: COLORS.accent }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke={COLORS.accent} strokeWidth={3} dot={{ r: 4, fill: COLORS.accent }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-6">
                <KPICard title="Total Transactions" value={salesRecords.length} color="text-teal-400" />
                <KPICard title="Daily Average" value={`$${(revenueChartData.reduce((a, b) => a + b.revenue, 0) / (revenueChartData.length || 1)).toFixed(2)}`} />
              </div>
            </div>

            <div className="bg-[#161B2D] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-gray-800 bg-[#1E3A5F]/10">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingCart size={20} className="text-orange-400" /> Transaction Log</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-900/50 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Medication</th>
                      <th className="p-4">Qty</th>
                      <th className="p-4">Unit Price</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Dispensed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {salesRecords.map(sale => (
                      <tr key={sale.id} className="text-sm hover:bg-gray-800/20 transition-colors">
                        <td className="p-4 text-gray-500 font-mono text-xs">
                          {new Date(sale.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 font-semibold text-white">{sale.med_name || 'Deleted Medication'}</td>
                        <td className="p-4 text-gray-300">{sale.quantity}</td>
                        <td className="p-4 text-gray-400">${sale.price_at_sale.toFixed(2)}</td>
                        <td className="p-4 text-teal-400 font-bold">${sale.total.toFixed(2)}</td>
                        <td className="p-4">
                          <span className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300">{sale.username}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {salesRecords.length === 0 && (
                  <div className="p-10 text-center text-gray-500 italic">No transactions recorded yet.</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {(activeView === 'dashboard' || activeView === 'inventory') && (
          <div className="bg-[#161B2D] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-[#1E3A5F] text-teal-400 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-5">Medication Name</th>
                  <th className="p-5">Category</th>
                  <th className="p-5">Supplier</th>
                  <th className="p-5">Stock</th>
                  <th className="p-5">Expiry</th>
                  <th className="p-5">Status</th>
                <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {meds.map(med => (
                  <motion.tr
                    whileHover={{ backgroundColor: 'rgba(30, 58, 95, 0.3)' }} // Equivalent to navy-accent with opacity
                    key={med.id} className="group">
                    <td className="p-5 font-semibold">{med.name}</td>
                    <td className="p-5 text-gray-400">{med.category}</td>
                    <td className="p-5 text-teal-400/70 text-sm italic">{med.supplier_name || 'N/A'}</td>
                    <td className="p-5">{med.quantity} Units</td>
                    <td className="p-5 text-gray-300">{med.expiry_date}</td>
                    <td className="p-5">
                      <StatusBadge qty={med.quantity} threshold={med.reorder_threshold} />
                    </td>
                  <td className="p-5 text-right">
                    <button type="button" onClick={() => handleDispenseMedication(med.id)} className="text-gray-500 hover:text-orange-400 p-2 rounded-lg hover:bg-orange-500/10 transition-all inline-flex items-center justify-center mr-1" title="Dispense/Sell">
                      <ShoppingCart size={16} />
                    </button>
                    <button type="button" onClick={() => openEditMedicationModal(med)} className="text-gray-500 hover:text-teal-400 p-2 rounded-lg hover:bg-teal-500/10 transition-all inline-flex items-center justify-center mr-1">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => openDeleteConfirmation(med.id)} className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-all inline-flex items-center justify-center">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </motion.tr>
                ))} 
              </tbody>
            </table>
          </div>
        )}

        {activeView === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-[#161B2D] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-gray-800 bg-[#1E3A5F]/10 flex items-center justify-between">
                <h3 className="text-xl font-bold text-teal-400 flex items-center gap-2"><History /> Audit Trail</h3>
                <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Latest 50 Actions</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {activityLogs.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 italic">No activity recorded yet.</div>
                ) : (
                  activityLogs.map(log => {
                    const ActionIcon = { ADD: PlusCircle, UPDATE: RefreshCw, DELETE: Trash2, CLEAR: XCircle }[log.action] || History;
                    const actionColor = { ADD: 'text-teal-400', UPDATE: 'text-orange-400', DELETE: 'text-red-400', CLEAR: 'text-red-500' }[log.action] || 'text-gray-400';
                    
                    return (
                      <div key={log.id} className="p-5 flex items-center gap-6 hover:bg-gray-800/20 transition-all group">
                        <div className={`p-3 rounded-xl bg-gray-900 border border-gray-800 ${actionColor}`}>
                          <ActionIcon size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white text-sm">{log.username}</span>
                            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border border-current/20 ${actionColor} opacity-70`}>
                              {log.action}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm">{log.details}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono text-gray-500">{new Date(log.timestamp).toLocaleDateString()}</p>
                          <p className="text-[10px] text-gray-600">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-xl text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Logs are permanent and visible to all organization members for safety compliance.</p>
            </div>
          </motion.div>
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

        {activeView === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-4xl space-y-6"
          >
            {/* Header Section */}
            <div className="bg-[#161B2D] p-8 rounded-3xl border border-gray-800 shadow-xl flex flex-col md:flex-row items-center gap-8">
              <div className="w-24 h-24 bg-teal-500/10 rounded-full flex items-center justify-center border-2 border-teal-500/20 text-teal-400 shadow-inner">
                <User size={48} />
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="text-3xl font-bold text-white mb-1">{user.username}</h3>
                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                  <span className="px-3 py-1 bg-teal-500/10 text-teal-400 rounded-lg text-xs font-bold uppercase border border-teal-500/20">{user.role || 'Pharmacist'}</span>
                  <span className="px-3 py-1 bg-gray-800 text-gray-400 rounded-lg text-xs font-bold uppercase border border-gray-700">ID: {user.id}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Organization & Security */}
              <div className="lg:col-span-2 space-y-6">
                {/* Organization Details */}
                <section className="bg-[#161B2D] p-8 rounded-3xl border border-gray-800 shadow-lg">
                  <h4 className="text-lg font-bold text-teal-400 mb-6 flex items-center gap-2">
                    <Package size={20} /> Organization Management
                  </h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-900/50 rounded-2xl border border-gray-800 flex justify-between items-center">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Clinic / Pharmacy Name</label>
                        <p className="text-white font-semibold">{orgDetails?.name || 'Loading...'}</p>
                      </div>
                      <button className="text-xs text-teal-400 hover:underline">Edit</button>
                    </div>
                    <div className="p-4 bg-gray-900/50 rounded-2xl border border-gray-800">
                      <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Global Data Policy</label>
                      <p className="text-gray-400 text-sm">Inventory and alerts are shared in real-time with all members of this organization.</p>
                    </div>
                  </div>
                </section>

                {/* Security */}
                <section className="bg-[#161B2D] p-8 rounded-3xl border border-gray-800 shadow-lg">
                  <h4 className="text-lg font-bold text-red-400 mb-6 flex items-center gap-2">
                    <Lock size={20} /> Account Security
                  </h4>
                  <div className="space-y-4">
                    <button className="w-full text-left p-4 bg-gray-900/50 rounded-2xl border border-gray-800 hover:border-red-500/30 transition-all flex justify-between items-center group">
                      <div>
                        <p className="text-white font-semibold group-hover:text-red-400 transition-colors">Change Password</p>
                        <p className="text-gray-500 text-xs">Update your login credentials</p>
                      </div>
                      <Lock size={16} className="text-gray-600" />
                    </button>
                  </div>
                </section>
              </div>

              {/* Right Column: Team Members */}
              <div className="space-y-6">
                <section className="bg-[#161B2D] p-8 rounded-3xl border border-gray-800 shadow-lg">
                  <h4 className="text-lg font-bold text-teal-400 mb-6 flex items-center gap-2">
                    <User size={20} /> Team Members
                  </h4>
                  <div className="space-y-3">
                    {orgMembers.map(member => (
                      <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-xl border border-gray-800">
                        <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-teal-400 font-bold text-xs uppercase">
                          {member.username[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{member.username}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-tighter">{member.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'admin' && user.role === 'admin' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Organizations Management */}
              <section className="bg-[#161B2D] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                <div className="p-6 border-b border-gray-800 bg-[#1E3A5F]/20 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-teal-400 flex items-center gap-2"><Building2 /> Organizations</h3>
                  <span className="text-xs bg-teal-500/10 text-teal-400 px-2 py-1 rounded-md font-bold uppercase">{adminOrgs.length} Total</span>
                </div>
                <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {adminOrgs.map(org => (
                    <div key={org.id} 
                      onClick={() => handleViewOrgStocks(org.id, org.name)}
                      className="p-4 bg-gray-900/50 rounded-xl border border-gray-800 flex justify-between items-center group hover:border-teal-500/30 transition-all cursor-pointer">
                      <div>
                        <p className="font-bold text-white">{org.name}</p>
                        <div className="flex gap-4 mt-1">
                          <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Users size={10}/> {org.userCount} Users</span>
                          <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><Package size={10}/> {org.stockCount} SKU</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent opening the stocks modal
                          handleAdminDeleteOrg(org.id, org.name);
                        }}
                        className="text-gray-600 hover:text-red-400 p-2 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Global User Management */}
              <section className="bg-[#161B2D] rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                <div className="p-6 border-b border-gray-800 bg-[#1E3A5F]/20 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-orange-400 flex items-center gap-2"><Users /> Global Users</h3>
                  <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-1 rounded-md font-bold uppercase">{adminUsers.length} Total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-gray-500 font-bold border-b border-gray-800">
                      <tr>
                        <th className="p-4">User</th>
                        <th className="p-4">Organization</th>
                        <th className="p-4">Role</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {adminUsers.map(u => (
                        <tr key={u.id} className="text-sm hover:bg-gray-800/20 transition-colors">
                          <td className="p-4 font-semibold text-white">{u.username}</td>
                          <td className="p-4 text-gray-400">{u.organizationName}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleAdminDeleteUser(u.id, u.username)}
                              className="text-gray-600 hover:text-red-400 p-1">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            
            <div className="p-6 bg-teal-500/5 border border-teal-500/10 rounded-2xl text-center">
              <p className="text-gray-400 text-sm">
                Admin Portal: Use this interface to supervise across multiple branches. 
                Managing an organization's stock requires switching your context to that specific Org ID.
              </p>
            </div>
          </motion.div>
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
        layout
        initial={false}
        animate={{
          width: isChatOpen ? 400 : 60,
          height: isChatOpen ? 560 : 60,
          borderRadius: isChatOpen ? '24px' : '30px',
        }}
        style={{ originX: 1, originY: 1 }}
        transition={{ type: 'spring', stiffness: 250, damping: 25 }}
        className="fixed bottom-6 right-6 z-50 shadow-2xl overflow-hidden bg-[#161B2D] border border-gray-800 flex flex-col"
      >
        {!isChatOpen ? (
          <button
            onClick={() => setIsChatOpen(true)}
            className="w-full h-full flex items-center justify-center bg-teal-500 text-black hover:bg-teal-400 transition-colors"
          >
            <MessageSquare size={24} fill="black" />
          </button>
        ) : (
          <>
            <div 
              className="bg-teal-500 p-4 flex justify-between items-center cursor-pointer"
              onClick={() => setIsChatOpen(false)}
            >
              <div className="flex items-center gap-2 text-black">
                <MessageSquare size={20} fill="black" />
                <span className="font-bold uppercase tracking-tighter text-sm">PharmAI</span>
              </div>
              <X size={20} className="text-black" />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 p-4 pr-2 custom-scrollbar">
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
            
            <div className="p-4 bg-gray-900/50 border-t border-gray-800">
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
          </>
        )}
      </motion.div>

      {/* Add Medication Modal */}
      <AnimatePresence>
        {showAddMedicationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70]"
          >
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[#161B2D] p-8 rounded-2xl border border-gray-800 w-full max-w-lg shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-teal-400 mb-6">Add New Medication</h3>
              {authError && <p className="text-red-400 text-sm ml-1 mb-4">{authError}</p>}
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
                <div className="flex flex-col">
                  <label htmlFor="supplier_id" className="text-sm text-gray-400 mb-1">Supplier</label>
                  <select id="supplier_id" name="supplier_id" value={newMedicationForm.supplier_id} onChange={handleNewMedicationChange} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500">
                    <option value="">Select a Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

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

      {/* Edit Medication Modal */}
      <AnimatePresence>
        {showEditMedicationModal && editingMedication && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#161B2D] p-8 rounded-2xl border border-gray-800 w-full max-w-lg shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-teal-400 mb-6">Modify Stock</h3>
              {authError && <p className="text-red-400 text-sm mb-4 bg-red-400/10 p-3 rounded-lg border border-red-400/20">{authError}</p>}
              <form onSubmit={handleUpdateMedicationSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
                    <input type="text" name="name" value={editingMedication.name} onChange={handleEditMedicationChange} className="bg-gray-900 border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-teal-500" required />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
                    <input type="text" name="category" value={editingMedication.category} onChange={handleEditMedicationChange} className="bg-gray-900 border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-teal-500" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Quantity</label>
                    <input type="number" name="quantity" value={editingMedication.quantity} onChange={handleEditMedicationChange} className="bg-gray-900 border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-teal-500" min="0" required />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Threshold</label>
                    <input type="number" name="reorder_threshold" value={editingMedication.reorder_threshold} onChange={handleEditMedicationChange} className="bg-gray-900 border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-teal-500" min="0" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Expiry Date</label>
                    <input type="date" name="expiry_date" value={editingMedication.expiry_date} onChange={handleEditMedicationChange} className="bg-gray-900 border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-teal-500" required />
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Price ($)</label>
                    <input type="number" name="price" value={editingMedication.price} onChange={handleEditMedicationChange} className="bg-gray-900 border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-teal-500" min="0" step="0.01" required />
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Supplier</label>
                  <select name="supplier_id" value={editingMedication.supplier_id || ''} onChange={handleEditMedicationChange} className="bg-gray-900 border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-teal-500">
                    <option value="">Select a Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <button type="button" onClick={closeEditMedicationModal} className="px-6 py-2.5 text-gray-400 hover:text-white font-semibold">Cancel</button>
                  <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-black px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all">Update Entry</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirmationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#161B2D] p-8 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Delete Medication?</h3>
              <p className="text-gray-400 mb-6 text-sm leading-relaxed">This will permanently remove this item from your inventory. Type <span className="text-red-400 font-mono font-bold">delete</span> to confirm.</p>
              
              {authError && <p className="text-red-400 text-xs mb-4 bg-red-400/10 p-2 rounded border border-red-400/20">{authError}</p>}

              <input 
                type="text" 
                value={deleteConfirmInput} 
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder='Type "delete" here'
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-center mb-6 focus:outline-none focus:border-red-500 transition-all text-white"
              />
              <div className="flex justify-center gap-4">
                <button type="button" onClick={closeDeleteConfirmation} className="px-5 py-2.5 text-gray-400 hover:text-white font-semibold">
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteMedication} 
                  disabled={deleteConfirmInput !== 'delete'}
                  className={`px-8 py-2.5 rounded-xl font-bold transition-all ${deleteConfirmInput === 'delete' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear Stock Modal */}
      <AnimatePresence>
        {showClearStockModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70]"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#161B2D] p-8 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl text-center"
            >
              <h3 className="text-2xl font-bold text-red-400 mb-4">Wipe Database?</h3>
              <p className="text-gray-300 mb-6">This will delete <b>EVERY</b> medication in your inventory. Type <span className="text-red-400 font-mono">delete</span> below to confirm.</p>
              
              <form onSubmit={handleClearStockSubmit}>
                <input 
                  type="text" 
                  value={clearConfirmInput} 
                  onChange={(e) => setClearConfirmInput(e.target.value)}
                  placeholder='Type "delete" here'
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-center mb-4 focus:outline-none focus:border-red-500 transition-all"
                />
                <div className="flex justify-center gap-4">
                  <button type="button" onClick={() => {setShowClearStockModal(false); setClearConfirmInput(''); setIsAdminAction(false);}} className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors">Cancel</button>
                  <button type="submit" disabled={clearConfirmInput !== 'delete'} className={`px-8 py-2.5 rounded-xl font-bold transition-all ${clearConfirmInput === 'delete' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>Clear All Data</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin View Org Stocks Modal */}
      <AnimatePresence>
        {showAdminOrgStocksModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#161B2D] p-8 rounded-2xl border border-gray-800 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Building2 size={24} className="text-teal-400"/> {adminSelectedOrgName}
                  </h3>
                  <div className="flex gap-4 mt-2">
                    <button 
                      onClick={() => setAdminModalTab('inventory')}
                      className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${adminModalTab === 'inventory' ? 'text-teal-400 border-teal-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                    >
                      Inventory ({adminSelectedOrgMeds.length})
                    </button>
                    <button 
                      onClick={() => setAdminModalTab('team')}
                      className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${adminModalTab === 'team' ? 'text-teal-400 border-teal-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                    >
                      Team ({adminSelectedOrgUsers.length})
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  {adminModalTab === 'inventory' && (
                    <button 
                      onClick={() => { setIsAdminAction(true); setAuthError(''); setShowClearStockModal(true); }}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-lg font-bold transition-all border border-red-500/20 text-xs"
                    >
                      Clear All Stock
                    </button>
                  )}
                  <button onClick={() => { setShowAdminOrgStocksModal(false); setAdminModalTab('inventory'); }} className="text-gray-400 hover:text-white">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {adminModalTab === 'inventory' ? (
                  <table className="w-full text-left">
                    <thead className="bg-[#1E3A5F] text-teal-400 text-xs font-bold uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="p-4">Medication</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Quantity</th>
                        <th className="p-4">Price</th>
                        <th className="p-4">Expiry</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {adminSelectedOrgMeds.length === 0 ? (
                        <tr><td colSpan="6" className="p-8 text-center text-gray-500">No stock records found for this organization.</td></tr>
                      ) : (
                        adminSelectedOrgMeds.map(med => (
                          <tr key={med.id} className="text-sm">
                            <td className="p-4 font-semibold text-white">{med.name}</td>
                            <td className="p-4 text-gray-400">{med.category}</td>
                            <td className="p-4 text-gray-300">{med.quantity} Units</td>
                            <td className="p-4 text-teal-400">${med.price}</td>
                            <td className="p-4 text-gray-400">{med.expiry_date}</td>
                            <td className="p-4 text-right">
                              <button onClick={() => { setIsAdminAction(true); openEditMedicationModal(med); }} className="text-gray-500 hover:text-teal-400 p-1 mr-1">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => { setIsAdminAction(true); openDeleteConfirmation(med.id); }} className="text-gray-500 hover:text-red-400 p-1">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-[#1E3A5F] text-teal-400 text-xs font-bold uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="p-4">Username</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Joined</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {adminSelectedOrgUsers.length === 0 ? (
                        <tr><td colSpan="4" className="p-8 text-center text-gray-500">No users found for this organization.</td></tr>
                      ) : (
                        adminSelectedOrgUsers.map(u => (
                          <tr key={u.id} className="text-sm">
                            <td className="p-4 font-semibold text-white">{u.username}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4 text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => handleAdminDeleteUser(u.id, u.username)}
                                className="text-gray-500 hover:text-red-400 p-1"
                                title="Remove user from organization"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Supplier Modal */}
      <AnimatePresence>
        {showAddSupplierModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#161B2D] p-8 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-teal-400 mb-6">Register New Supplier</h3>
              <form onSubmit={handleAddSupplierSubmit} className="space-y-4">
                <div className="flex flex-col">
                  <label className="text-sm text-gray-400 mb-1">Company Name</label>
                  <input type="text" name="name" value={newSupplierForm.name} onChange={handleNewSupplierChange} className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" required />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-400 mb-1">Contact Person</label>
                  <input type="text" name="contact_name" value={newSupplierForm.contact_name} onChange={handleNewSupplierChange} className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" required />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-400 mb-1">Email Address</label>
                  <input type="email" name="email" value={newSupplierForm.email} onChange={handleNewSupplierChange} className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" required />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-400 mb-1">Phone Number</label>
                  <input type="text" name="phone" value={newSupplierForm.phone} onChange={handleNewSupplierChange} className="bg-gray-900 border border-gray-700 rounded-lg p-2.5 focus:outline-none focus:border-teal-500" required />
                </div>
                <div className="flex justify-end gap-4 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowAddSupplierModal(false)} 
                    className="px-5 py-2.5 rounded-xl text-gray-400 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="bg-teal-500 hover:bg-teal-400 text-black px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-500/20"
                  >
                    Save Supplier
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
  else if (qty <= 5) config = { label: 'Low Stock', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
  
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${config.color}`}>
      {config.label}
    </span>
  );
};

export default App;
