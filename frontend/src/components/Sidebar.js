import React, { useState } from 'react';
import { useMailContext } from '../contexts/MailContext';
import {
  Mail, Send, Edit3, Search, Sun, Moon, LogOut, ChevronDown, ChevronUp,
  Filter, Calendar, User, X
} from 'lucide-react';

export function Sidebar() {
  const {
    currentView, navigateTo, unreadCount, authStatus, logout,
    theme, toggleTheme, filters, applyFilters, clearFilters, wsConnected,
  } = useMailContext();

  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState({ sender: '', keyword: '', dateFrom: '', dateTo: '', unreadOnly: false });
  const [searchQuery, setSearchQuery] = useState('');

  const hasActiveFilters = filters.sender || filters.keyword || filters.dateFrom || filters.dateTo || filters.unreadOnly;

  const handleSearch = (e) => {
    e.preventDefault();
    applyFilters({ ...filters, keyword: searchQuery });
  };

  const handleApplyFilters = () => {
    applyFilters(localFilters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setLocalFilters({ sender: '', keyword: '', dateFrom: '', dateTo: '', unreadOnly: false });
    setSearchQuery('');
    clearFilters();
    setShowFilters(false);
  };

  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: Mail, badge: unreadCount || null },
    { id: 'sent', label: 'Sent', icon: Send },
  ];

  return (
    <aside
      className="w-[220px] h-screen flex flex-col glass-sidebar shrink-0"
      style={{ borderRight: '1px solid var(--border-color)' }}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <img src="/logo.png" alt="" className="h-9 w-9 rounded-xl" style={{ boxShadow: 'var(--shadow-md)' }} />
        <div>
          <h1 className="font-heading tracking-tight leading-none" style={{ fontSize: '18px' }}>
            <span style={{
              fontWeight: 800,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}>R</span>
            <span style={{
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '0.02em',
              marginLeft: '1px',
            }}>mail</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: wsConnected ? 'var(--success)' : 'var(--danger)' }} />
            <span className="text-[10px] font-medium" style={{ color: wsConnected ? 'var(--success)' : 'var(--text-faint)' }}>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Compose */}
      <div className="px-3 mb-3">
        <button
          onClick={() => navigateTo('compose')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'var(--accent)', boxShadow: '0 2px 12px var(--accent-glow)' }}
        >
          <Edit3 className="h-4 w-4" />
          Compose
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
              style={{
                background: active ? 'var(--accent-light)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Icon className="h-[17px] w-[17px]" />
              <span>{item.label}</span>
              {item.badge && (
                <span
                  className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150"
          style={{
            background: hasActiveFilters ? 'var(--accent-light)' : 'transparent',
            color: hasActiveFilters ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          <Filter className="h-[17px] w-[17px]" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="ml-auto h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
          )}
          {showFilters ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
        </button>

        {/* Filter Panel */}
        {showFilters && (
          <div className="px-2 pb-2 animate-fade-in-up">
            <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>
                  Sender
                </label>
                <div className="relative">
                  <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--text-faint)' }} />
                  <input
                    value={localFilters.sender}
                    onChange={e => setLocalFilters(prev => ({ ...prev, sender: e.target.value }))}
                    placeholder="Email or name"
                    className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none transition-colors"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>
                  Keyword
                </label>
                <input
                  value={localFilters.keyword}
                  onChange={e => setLocalFilters(prev => ({ ...prev, keyword: e.target.value }))}
                  placeholder="Search in subject/body"
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none transition-colors"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>From</label>
                  <input
                    type="date"
                    value={localFilters.dateFrom}
                    onChange={e => setLocalFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full px-1.5 py-1.5 rounded-lg text-[10px] outline-none"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-faint)' }}>To</label>
                  <input
                    type="date"
                    value={localFilters.dateTo}
                    onChange={e => setLocalFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full px-1.5 py-1.5 rounded-lg text-[10px] outline-none"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  checked={localFilters.unreadOnly}
                  onChange={e => setLocalFilters(prev => ({ ...prev, unreadOnly: e.target.checked }))}
                  className="rounded"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Unread only</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors"
                  style={{ background: 'var(--accent)' }}
                >
                  Apply
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border-color)' }}>
        {/* Search */}
        <form onSubmit={handleSearch} className="pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-faint)' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none transition-colors"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); clearFilters(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3" style={{ color: 'var(--text-faint)' }} />
              </button>
            )}
          </div>
        </form>

        {/* Theme toggle */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>
            {theme === 'light' ? 'Light' : 'Dark'}
          </span>
          <button
            onClick={toggleTheme}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
          >
            {theme === 'light' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* User profile with tooltip */}
        <div className="tooltip-container">
          <div className="flex items-center gap-2.5 px-1">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white avatar-ring"
              style={{ background: 'var(--accent)' }}
            >
              {authStatus.email ? authStatus.email[0].toUpperCase() : 'R'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {authStatus.email ? authStatus.email.split('@')[0] : 'Not connected'}
              </p>
              <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--success)' }}>
                <span className="h-1 w-1 rounded-full inline-block" style={{ background: 'var(--success)' }} />
                Connected
              </p>
            </div>
            <button
              onClick={logout}
              className="h-6 w-6 rounded-md flex items-center justify-center transition-colors hover:opacity-80"
              style={{ color: 'var(--text-faint)' }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="tooltip">{authStatus.email || 'No email connected'}</div>
        </div>
      </div>
    </aside>
  );
}
