import React, { useState } from 'react';
import { useMailContext } from '../contexts/MailContext';
import {
  Mail, Send, Edit3, Search, ChevronDown, ChevronUp,
  Filter, Calendar, User, X, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

export function Sidebar() {
  const {
    currentView, navigateTo, unreadCount,
    filters, applyFilters, clearFilters,
  } = useMailContext();

  const [expanded, setExpanded] = useState(true);
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

  const sidebarWidth = expanded ? 240 : 68;

  return (
    <aside
      className={`floating-sidebar flex flex-col shrink-0 h-full ${expanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
      style={{
        width: `${sidebarWidth}px`,
        background: 'var(--bg-sidebar)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border-color)',
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      {/* Toggle Button */}
      <div className={`flex items-center ${expanded ? 'justify-end px-3' : 'justify-center'} pt-3 pb-1`}>
        <button
          onClick={() => { setExpanded(!expanded); if (!expanded === false) setShowFilters(false); }}
          className="h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200 btn-press"
          style={{
            background: 'var(--accent-light)',
            color: 'var(--accent)',
          }}
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      {/* Compose Button */}
      <div className={`${expanded ? 'px-3' : 'px-2'} mb-3`}>
        <button
          onClick={() => navigateTo('compose')}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 btn-press`}
          style={{
            background: 'var(--accent)',
            boxShadow: '0 2px 12px var(--accent-glow)',
          }}
          title="Compose"
        >
          <Edit3 className="h-4 w-4 shrink-0" />
          {expanded && <span className="sidebar-label">Compose</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <div key={item.id} className="tooltip-container">
              <button
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center ${expanded ? 'gap-2.5 px-3' : 'justify-center px-0'} py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 btn-press`}
                style={{
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                title={!expanded ? item.label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {expanded && <span className="sidebar-label">{item.label}</span>}
                {expanded && item.badge && (
                  <span
                    className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white sidebar-label"
                    style={{ background: 'var(--accent)' }}
                  >
                    {item.badge}
                  </span>
                )}
                {!expanded && item.badge && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
              </button>
              {!expanded && (
                <div className="tooltip" style={{ left: '120%', bottom: 'auto', top: '50%', transform: 'translateY(-50%)' }}>
                  {item.label}
                  {item.badge ? ` (${item.badge})` : ''}
                </div>
              )}
            </div>
          );
        })}

        {/* Filter toggle */}
        <div className="tooltip-container">
          <button
            onClick={() => { if (!expanded) { setExpanded(true); setTimeout(() => setShowFilters(true), 300); } else { setShowFilters(!showFilters); } }}
            className={`w-full flex items-center ${expanded ? 'gap-2.5 px-3' : 'justify-center px-0'} py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 btn-press`}
            style={{
              background: hasActiveFilters ? 'var(--accent-light)' : 'transparent',
              color: hasActiveFilters ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            title={!expanded ? 'Filters' : undefined}
          >
            <Filter className="h-[18px] w-[18px] shrink-0" />
            {expanded && <span className="sidebar-label">Filters</span>}
            {expanded && hasActiveFilters && (
              <span className="ml-auto h-2 w-2 rounded-full sidebar-label" style={{ background: 'var(--accent)' }} />
            )}
            {expanded && (showFilters ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />)}
          </button>
          {!expanded && (
            <div className="tooltip" style={{ left: '120%', bottom: 'auto', top: '50%', transform: 'translateY(-50%)' }}>
              Filters
              {hasActiveFilters ? ' (active)' : ''}
            </div>
          )}
        </div>

        {/* Filter Panel — only when expanded */}
        {expanded && showFilters && (
          <div className="px-1 pb-2 animate-fade-in-up">
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
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors btn-press"
                  style={{ background: 'var(--accent)' }}
                >
                  Apply
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors btn-press"
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
      <div className={`${expanded ? 'px-3' : 'px-2'} pb-4 space-y-2`} style={{ borderTop: '1px solid var(--border-color)' }}>
        {/* Search — only when expanded */}
        {expanded && (
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
        )}

        {/* Search icon button — collapsed mode */}
        {!expanded && (
          <div className="tooltip-container pt-3 flex justify-center">
            <button
              onClick={() => { setExpanded(true); }}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 btn-press"
              style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <div className="tooltip" style={{ left: '120%', bottom: 'auto', top: '50%', transform: 'translateY(-50%)' }}>
              Search
            </div>
          </div>
        )}

        {/* "Made by Rahul Yadav" — only in expanded mode */}
        {expanded && (
          <p className="text-center text-[10px] font-medium pt-2 sidebar-label" style={{ color: 'var(--text-faint)' }}>
            Made by Rahul Yadav
          </p>
        )}
      </div>
    </aside>
  );
}
