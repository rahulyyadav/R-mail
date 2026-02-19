import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MailContext = createContext(null);

export function useMailContext() {
  const ctx = useContext(MailContext);
  if (!ctx) throw new Error('useMailContext must be used within MailProvider');
  return ctx;
}

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
  const wsRef = useRef(null);

  const fetchEmails = useCallback(async (folder = 'inbox', filterOverride = null) => {
    try {
      const f = filterOverride || filters;
      const params = new URLSearchParams({ folder });
      if (f.sender) params.append('sender', f.sender);
      if (f.keyword) params.append('keyword', f.keyword);
      if (f.unreadOnly) params.append('unread_only', 'true');
      if (f.dateFrom) params.append('date_from', f.dateFrom);
      if (f.dateTo) params.append('date_to', f.dateTo);

      const res = await axios.get(`${API}/emails?${params}`);
      setEmails(prev => ({ ...prev, [folder]: res.data }));
      if (folder === 'inbox') {
        setUnreadCount(res.data.filter(e => !e.is_read).length);
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    }
  }, [filters]);

  const fetchAllEmails = useCallback(async (filterOverride) => {
    await Promise.all([
      fetchEmails('inbox', filterOverride),
      fetchEmails('sent', filterOverride),
    ]);
  }, [fetchEmails]);

  useEffect(() => {
    fetchAllEmails();
  }, [fetchAllEmails]);

  useEffect(() => {
    if (currentView === 'inbox' || currentView === 'sent') {
      fetchEmails(currentView);
    }
  }, [filters, currentView, fetchEmails]);

  // WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    let ws = null;
    let reconnectTimer = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
        ws._pingInterval = pingInterval;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_email') {
            setEmails(prev => ({
              ...prev,
              inbox: [data.email, ...prev.inbox],
            }));
            setUnreadCount(prev => prev + 1);
            toast.info(`New email from ${data.email.from_name}`, {
              description: data.email.subject,
            });
          } else if (data.type === 'email_sent') {
            setEmails(prev => ({
              ...prev,
              sent: [data.email, ...prev.sent],
            }));
          }
        } catch (e) {
          // ignore non-json messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (ws._pingInterval) clearInterval(ws._pingInterval);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        if (ws._pingInterval) clearInterval(ws._pingInterval);
        ws.close();
      }
    };
  }, []);

  // Load chat history
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/chat/history`);
        setChatMessages(res.data);
      } catch (e) {
        // no history
      }
    })();
  }, []);

  const openEmail = useCallback(async (email) => {
    setSelectedEmail(email);
    setCurrentView('detail');
    if (!email.is_read) {
      try {
        await axios.put(`${API}/emails/${email.id}/read`);
        setEmails(prev => ({
          ...prev,
          inbox: prev.inbox.map(e => e.id === email.id ? { ...e, is_read: true } : e),
        }));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        console.error('Failed to mark as read:', e);
      }
    }
  }, []);

  const sendEmail = useCallback(async (to, subject, body) => {
    try {
      setIsLoading(true);
      await axios.post(`${API}/emails/send`, {
        to_email: to,
        to_name: to.split('@')[0],
        subject,
        body,
      });
      toast.success('Email sent successfully!');
      setShowCompose(false);
      setComposeData({ to: '', subject: '', body: '' });
      await fetchEmails('sent');
      return true;
    } catch (err) {
      toast.error('Failed to send email');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchEmails]);

  const navigateTo = useCallback((view) => {
    if (view === 'compose') {
      setShowCompose(true);
    } else {
      setCurrentView(view);
      setSelectedEmail(null);
    }
  }, []);

  const applyFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    setCurrentView('inbox');
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ sender: '', keyword: '', dateFrom: '', dateTo: '', unreadOnly: false });
  }, []);

  const executeAIActions = useCallback(async (actions) => {
    setIsAIActing(true);
    for (const action of actions) {
      await new Promise(r => setTimeout(r, 600));
      switch (action.type) {
        case 'navigate':
          toast.info(`Navigating to ${action.view}...`);
          navigateTo(action.view);
          break;

        case 'compose': {
          toast.info('Opening compose...');
          setShowCompose(true);
          setCurrentView('inbox');
          await new Promise(r => setTimeout(r, 400));
          setComposeData({ to: action.to || '', subject: action.subject || '', body: action.body || '' });
          break;
        }

        case 'open_email': {
          const allEmails = [...emails.inbox, ...emails.sent];
          const email = allEmails.find(e => e.id === action.email_id);
          if (email) {
            toast.info(`Opening email: "${email.subject}"`);
            await openEmail(email);
          } else {
            toast.error('Email not found');
          }
          break;
        }

        case 'filter': {
          const newFilters = {
            sender: action.sender || '',
            keyword: action.keyword || '',
            dateFrom: action.date_from || '',
            dateTo: action.date_to || '',
            unreadOnly: action.unread_only || false,
          };
          toast.info('Applying filters...');
          applyFilters(newFilters);
          break;
        }

        case 'clear_filters':
          toast.info('Clearing filters...');
          clearFilters();
          break;

        case 'reply': {
          const allEmails2 = [...emails.inbox, ...emails.sent];
          const replyEmail = allEmails2.find(e => e.id === action.email_id);
          if (replyEmail) {
            toast.info(`Replying to ${replyEmail.from_name}...`);
            setShowCompose(true);
            await new Promise(r => setTimeout(r, 400));
            setComposeData({
              to: replyEmail.from_email,
              subject: `Re: ${replyEmail.subject.replace(/^Re:\s*/i, '')}`,
              body: action.body || '',
            });
          }
          break;
        }

        case 'send':
          toast.info('Sending email...');
          if (composeData.to && composeData.subject) {
            await sendEmail(composeData.to, composeData.subject, composeData.body);
          }
          break;

        default:
          break;
      }
    }
    setIsAIActing(false);
  }, [emails, navigateTo, openEmail, applyFilters, clearFilters, composeData, sendEmail]);

  const sendAIMessage = useCallback(async (message) => {
    const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const context = {
        currentView,
        selectedEmailId: selectedEmail?.id || null,
        selectedEmailSubject: selectedEmail?.subject || '',
      };
      const res = await axios.post(`${API}/ai/chat`, { message, context });
      const assistantMsg = {
        role: 'assistant',
        content: res.data.message || '',
        actions: res.data.actions || [],
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      if (res.data.actions && res.data.actions.length > 0) {
        await executeAIActions(res.data.actions);
      }
      return res.data;
    } catch (err) {
      const errMsg = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        actions: [],
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errMsg]);
      return null;
    }
  }, [currentView, selectedEmail, executeAIActions]);

  const clearChat = useCallback(async () => {
    try {
      await axios.delete(`${API}/chat/history`);
      setChatMessages([]);
    } catch (e) {
      console.error('Failed to clear chat:', e);
    }
  }, []);

  const toggleStar = useCallback(async (emailId) => {
    try {
      const res = await axios.put(`${API}/emails/${emailId}/star`);
      const starred = res.data.starred;
      setEmails(prev => ({
        inbox: prev.inbox.map(e => e.id === emailId ? { ...e, starred } : e),
        sent: prev.sent.map(e => e.id === emailId ? { ...e, starred } : e),
      }));
    } catch (e) {
      console.error('Failed to toggle star:', e);
    }
  }, []);

  const value = {
    currentView, setCurrentView, navigateTo,
    emails, selectedEmail, setSelectedEmail, openEmail,
    filters, setFilters, applyFilters, clearFilters,
    composeData, setComposeData, showCompose, setShowCompose,
    chatMessages, sendAIMessage, clearChat,
    isAIActing, isLoading, wsConnected, unreadCount,
    sendEmail, fetchEmails, fetchAllEmails, toggleStar,
  };

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
}
