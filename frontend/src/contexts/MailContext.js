import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8001/api/ws';
const TOKEN_KEY = 'rmail-auth-token';

// Shared axios instance that auto-attaches JWT
const api = axios.create();
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const MailContext = createContext(null);
export const useMailContext = () => useContext(MailContext);
export { api, API }; // export for use in other components

export function MailProvider({ children }) {
  const [currentView, setCurrentView] = useState('inbox');
  const [emails, setEmails] = useState({ inbox: [], sent: [] });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [filters, setFilters] = useState({ sender: '', keyword: '', dateFrom: '', dateTo: '', unreadOnly: false });
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [showCompose, setShowCompose] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [isAIActing, setIsAIActing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authStatus, setAuthStatus] = useState({ gmail_configured: false, email: '', mode: 'disconnected', can_login: false });
  const [authLoading, setAuthLoading] = useState(true); // prevents login page flash
  const [theme, setTheme] = useState(() => localStorage.getItem('rmail-theme') || 'light');
  const wsRef = useRef(null);

  // ── Theme ───────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('rmail-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  // ── Auth ────────────────────────────────────────
  const fetchAuthStatus = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      // No token stored — user is not logged in
      setAuthStatus({ gmail_configured: false, email: '', mode: 'disconnected', can_login: true });
      return { gmail_configured: false, email: '', mode: 'disconnected', can_login: true };
    }
    try {
      const res = await api.get(`${API}/auth/status`);
      setAuthStatus(res.data);
      return res.data;
    } catch (e) {
      if (e.response?.status === 401) {
        // Token expired or invalid — clear it
        localStorage.removeItem(TOKEN_KEY);
        setAuthStatus({ gmail_configured: false, email: '', mode: 'disconnected', can_login: true });
        return { gmail_configured: false, email: '', mode: 'disconnected', can_login: true };
      }
      return authStatus;
    }
  }, [authStatus]);

  const login = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/login`);
      if (res.data.auth_url) {
        window.location.href = res.data.auth_url;
      }
    } catch (e) {
      toast.error('Failed to start login');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post(`${API}/auth/logout`);
    } catch (e) {
      // Even if backend call fails, clear local session
    }
    localStorage.removeItem(TOKEN_KEY);
    setAuthStatus({ gmail_configured: false, email: '', mode: 'disconnected', can_login: true });
    setEmails({ inbox: [], sent: [] });
    setSelectedEmail(null);
    setChatMessages([]);
    toast.success('Logged out successfully');
  }, []);

  // ── Emails ──────────────────────────────────────
  const fetchEmails = useCallback(async (folder = 'inbox', filterOverride = null) => {
    try {
      const f = filterOverride || filters;
      const params = { folder };
      if (f.sender) params.sender = f.sender;
      if (f.keyword) params.keyword = f.keyword;
      if (f.unreadOnly) params.unread_only = true;
      if (f.dateFrom) params.date_from = f.dateFrom;
      if (f.dateTo) params.date_to = f.dateTo;
      const res = await api.get(`${API}/emails`, { params });
      setEmails(prev => ({ ...prev, [folder]: res.data }));
      if (folder === 'inbox') {
        setUnreadCount(res.data.filter(e => !e.is_read).length);
      }
    } catch (err) {
      console.error(`Failed to fetch ${folder}:`, err);
    }
  }, [filters]);

  const fetchAllEmails = useCallback(async () => {
    await Promise.all([fetchEmails('inbox'), fetchEmails('sent')]);
  }, [fetchEmails]);

  // ── WebSocket ───────────────────────────────────
  useEffect(() => {
    if (!authStatus.gmail_configured) return;

    const connectWS = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWS, 3000);
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'new_email' && data.email) {
            setEmails(prev => ({ ...prev, inbox: [data.email, ...prev.inbox] }));
            setUnreadCount(prev => prev + 1);
            toast.info(`New email from ${data.email.from_name}`);
          } else if (data.type === 'email_sent' && data.email) {
            setEmails(prev => ({ ...prev, sent: [data.email, ...prev.sent] }));
          }
        } catch (e) { /* ignore */ }
      };
    };
    connectWS();
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
    return () => {
      clearInterval(pingInterval);
      wsRef.current?.close();
    };
  }, [authStatus.gmail_configured]);

  // ── Initial Load ────────────────────────────────
  useEffect(() => {
    (async () => {
      // Handle OAuth callback — Google redirects to http://localhost:3000?code=XXXX
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        window.history.replaceState({}, '', '/');
        try {
          toast.info('Signing in...');
          const res = await axios.get(`${API}/auth/callback`, { params: { code } });
          if (res.data?.success || res.status === 200) {
            // Store JWT token
            if (res.data.token) {
              localStorage.setItem(TOKEN_KEY, res.data.token);
            }
            toast.success('Signed in successfully!');
            const s = await fetchAuthStatus();
            if (s.gmail_configured) fetchAllEmails();
            setAuthLoading(false);
            return;
          }
        } catch (e) {
          toast.error('Login failed — please try again');
        }
      }

      if (params.get('login') === 'success') {
        window.history.replaceState({}, '', '/');
        toast.success('Signed in successfully!');
      }
      if (params.get('error')) {
        window.history.replaceState({}, '', '/');
        toast.error(`Login error: ${params.get('error')}`);
      }

      const status = await fetchAuthStatus();
      if (status.gmail_configured) {
        fetchAllEmails();
      }
      setAuthLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filter effect ───────────────────────────────
  useEffect(() => {
    if (authStatus.gmail_configured) {
      fetchEmails('inbox');
    }
  }, [filters, authStatus.gmail_configured, fetchEmails]);

  // ── Chat history ────────────────────────────────
  useEffect(() => {
    if (!authStatus.gmail_configured) return;
    (async () => {
      try {
        const res = await api.get(`${API}/chat/history`);
        if (res.data && res.data.length > 0) setChatMessages(res.data);
      } catch (e) { /* ignore */ }
    })();
  }, [authStatus.gmail_configured]);

  // ── Navigation ──────────────────────────────────
  const navigateTo = useCallback((view) => {
    if (view === 'compose') {
      setShowCompose(true);
      return;
    }
    setCurrentView(view);
    setSelectedEmail(null);
  }, []);

  const openEmail = useCallback(async (email) => {
    setSelectedEmail(email);
    setCurrentView('detail');
    if (!email.is_read) {
      try {
        await api.put(`${API}/emails/${email.id}/read`);
        setEmails(prev => ({
          inbox: prev.inbox.map(e => e.id === email.id ? { ...e, is_read: true } : e),
          sent: prev.sent.map(e => e.id === email.id ? { ...e, is_read: true } : e),
        }));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) { /* ignore */ }
    }
  }, []);

  // ── Send Email ──────────────────────────────────
  const sendEmail = useCallback(async (to, subject, body, replyMeta = {}) => {
    try {
      setIsLoading(true);
      await api.post(`${API}/emails/send`, {
        to_email: to,
        to_name: to.split('@')[0],
        subject,
        body,
        reply_to_message_id: replyMeta.message_id || '',
        thread_id: replyMeta.thread_id || '',
      });
      toast.success('Email sent!');
      setShowCompose(false);
      setComposeData({ to: '', subject: '', body: '' });
      await fetchEmails('sent');
      return true;
    } catch (err) {
      toast.error('Failed to send');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchEmails]);

  // ── Filters ─────────────────────────────────────
  const applyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    setCurrentView('inbox');
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ sender: '', keyword: '', dateFrom: '', dateTo: '', unreadOnly: false });
  }, []);

  // ── AI Actions ──────────────────────────────────
  const executeAIActions = useCallback(async (actions) => {
    setIsAIActing(true);
    for (const action of actions) {
      await new Promise(r => setTimeout(r, 600));
      switch (action.type) {
        case 'navigate':
          toast.info(`Navigating to ${action.view}...`);
          navigateTo(action.view);
          break;
        case 'compose':
          toast.info('Opening compose...');
          setShowCompose(true);
          setCurrentView('inbox');
          await new Promise(r => setTimeout(r, 400));
          setComposeData({ to: action.to || '', subject: action.subject || '', body: action.body || '' });
          break;
        case 'open_email': {
          const allEmails = [...emails.inbox, ...emails.sent];
          const email = allEmails.find(e => e.id === action.email_id || e.gmail_id === action.email_id);
          if (email) {
            toast.info(`Opening: "${email.subject}"`);
            await openEmail(email);
          } else toast.error('Email not found');
          break;
        }
        case 'filter':
          toast.info('Applying filters...');
          applyFilters({
            sender: action.sender || '',
            keyword: action.keyword || '',
            dateFrom: action.date_from || '',
            dateTo: action.date_to || '',
            unreadOnly: action.unread_only || false,
          });
          break;
        case 'clear_filters':
          toast.info('Clearing filters...');
          clearFilters();
          break;
        case 'reply': {
          const allEmails2 = [...emails.inbox, ...emails.sent];
          const replyEmail = allEmails2.find(e => e.id === action.email_id || e.gmail_id === action.email_id);
          if (replyEmail) {
            toast.info(`Replying to ${replyEmail.from_name}...`);
            setShowCompose(true);
            await new Promise(r => setTimeout(r, 400));
            const replyTo = replyEmail.from_email === authStatus.email ? replyEmail.to_email : replyEmail.from_email;
            setComposeData({
              to: replyTo,
              subject: `Re: ${replyEmail.subject.replace(/^Re:\s*/i, '')}`,
              body: action.body || '',
              _replyMeta: { message_id: replyEmail.message_id, thread_id: replyEmail.thread_id },
            });
          }
          break;
        }
        case 'send':
          toast.info('Sending email...');
          if (composeData.to && composeData.subject) {
            await sendEmail(composeData.to, composeData.subject, composeData.body, composeData._replyMeta || {});
          }
          break;
        default:
          break;
      }
    }
    setIsAIActing(false);
  }, [emails, navigateTo, openEmail, applyFilters, clearFilters, composeData, sendEmail, authStatus.email]);

  // ── AI Chat ─────────────────────────────────────
  const sendAIMessage = useCallback(async (message) => {
    const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    try {
      const context = {
        currentView,
        selectedEmailId: selectedEmail?.id || null,
        selectedEmailSubject: selectedEmail?.subject || '',
        selectedEmailFrom: selectedEmail?.from_email || '',
        selectedEmailBody: selectedEmail?.body?.slice(0, 500) || '',
        totalInbox: emails.inbox.length,
        totalSent: emails.sent.length,
        unreadCount,
        activeFilters: filters,
        userEmail: authStatus.email,
      };
      const res = await api.post(`${API}/ai/chat`, { message, context });
      const assistantMsg = {
        role: 'assistant',
        content: res.data.message || '',
        actions: res.data.actions || [],
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, assistantMsg]);
      if (res.data.actions?.length > 0) await executeAIActions(res.data.actions);
      return res.data;
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.', actions: [], timestamp: new Date().toISOString() }]);
      return null;
    }
  }, [currentView, selectedEmail, executeAIActions, emails, unreadCount, filters, authStatus.email]);

  const clearChat = useCallback(async () => {
    try {
      await api.delete(`${API}/chat/history`);
      setChatMessages([]);
    } catch (e) { /* ignore */ }
  }, []);

  // ── Star toggle ─────────────────────────────────
  const toggleStar = useCallback(async (emailId) => {
    try {
      const res = await api.put(`${API}/emails/${emailId}/star`);
      const starred = res.data.starred;
      setEmails(prev => ({
        inbox: prev.inbox.map(e => e.id === emailId ? { ...e, starred } : e),
        sent: prev.sent.map(e => e.id === emailId ? { ...e, starred } : e),
      }));
    } catch (e) { /* ignore */ }
  }, []);

  const value = {
    currentView, setCurrentView, navigateTo,
    emails, selectedEmail, setSelectedEmail, openEmail,
    filters, setFilters, applyFilters, clearFilters,
    composeData, setComposeData, showCompose, setShowCompose,
    chatMessages, sendAIMessage, clearChat,
    isAIActing, isLoading, wsConnected, unreadCount,
    sendEmail, fetchEmails, fetchAllEmails, toggleStar,
    authStatus, authLoading, login, logout, fetchAuthStatus,
    theme, toggleTheme,
  };

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
}
