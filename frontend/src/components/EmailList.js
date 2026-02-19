import React, { useMemo } from 'react';
import { useMailContext } from '../contexts/MailContext';
import { Star, X, Paperclip } from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

function formatDate(dateStr) {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  } catch { return ''; }
}

function getInitials(name, email) {
  if (name && name.length > 0) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return '?';
}

function AvatarColor(name) {
  const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function FilterChip({ label, onClear }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
      style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
    >
      {label}
      <button onClick={onClear} className="hover:opacity-60"><X className="h-3 w-3" /></button>
    </span>
  );
}

export function EmailList() {
  const { currentView, emails, openEmail, toggleStar, filters, setFilters, clearFilters } = useMailContext();
  const list = currentView === 'sent' ? emails.sent : emails.inbox;

  const hasFilters = filters.sender || filters.keyword || filters.dateFrom || filters.dateTo || filters.unreadOnly;

  // Client-side filtering (backup for when server filter isn't applied)
  const filtered = useMemo(() => {
    let result = list;
    if (filters.unreadOnly) result = result.filter(e => !e.is_read);
    return result;
  }, [list, filters.unreadOnly]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-4 shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h2 className="text-lg font-bold font-heading" style={{ color: 'var(--text-primary)' }}>
            {currentView === 'sent' ? 'Sent' : 'Inbox'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {filtered.length} {filtered.length === 1 ? 'message' : 'messages'}
          </p>
        </div>
      </div>

      {/* Active filters */}
      {hasFilters && (
        <div className="px-6 py-2 flex flex-wrap items-center gap-2 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Filters:</span>
          {filters.sender && <FilterChip label={`From: ${filters.sender}`} onClear={() => setFilters(f => ({ ...f, sender: '' }))} />}
          {filters.keyword && <FilterChip label={`"${filters.keyword}"`} onClear={() => setFilters(f => ({ ...f, keyword: '' }))} />}
          {filters.dateFrom && <FilterChip label={`After: ${filters.dateFrom}`} onClear={() => setFilters(f => ({ ...f, dateFrom: '' }))} />}
          {filters.dateTo && <FilterChip label={`Before: ${filters.dateTo}`} onClear={() => setFilters(f => ({ ...f, dateTo: '' }))} />}
          {filters.unreadOnly && <FilterChip label="Unread" onClear={() => setFilters(f => ({ ...f, unreadOnly: false }))} />}
          <button onClick={clearFilters} className="text-[11px] font-medium ml-2" style={{ color: 'var(--text-faint)' }}>Clear all</button>
        </div>
      )}

      {/* Card List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 animate-fade-in">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              {hasFilters ? 'No emails match your filters' : 'No emails yet'}
            </p>
          </div>
        ) : (
          filtered.map((email, i) => (
            <div
              key={email.id || i}
              onClick={() => openEmail(email)}
              className="mail-card mail-card-enter flex items-start gap-3.5 px-5 py-4 rounded-2xl cursor-pointer group"
              style={{
                animationDelay: `${Math.min(i * 40, 400)}ms`,
                background: !email.is_read ? 'var(--accent-light)' : 'var(--bg-card)',
                border: `1px solid ${!email.is_read ? 'var(--accent-glow)' : 'var(--border-color)'}`,
                borderLeft: !email.is_read ? '3px solid var(--accent)' : '1px solid var(--border-color)',
              }}
            >
              {/* Avatar */}
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5"
                style={{
                  background: AvatarColor(email.from_name || email.from_email),
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}
              >
                {getInitials(email.from_name, email.from_email)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[13px] truncate"
                    style={{
                      color: 'var(--text-primary)',
                      fontWeight: !email.is_read ? '700' : '500',
                    }}
                  >
                    {currentView === 'sent' ? email.to_name || email.to_email : email.from_name || email.from_email}
                  </span>
                  <span className="text-[11px] ml-3 shrink-0 font-medium" style={{ color: 'var(--text-faint)' }}>
                    {formatDate(email.date)}
                  </span>
                </div>
                <p
                  className="text-[12.5px] truncate mb-0.5"
                  style={{
                    color: 'var(--text-secondary)',
                    fontWeight: !email.is_read ? '600' : '400',
                  }}
                >
                  {email.subject}
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {email.preview}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-2 shrink-0 mt-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-all duration-200 btn-press"
                  style={{ color: email.starred ? 'var(--star-color)' : 'var(--text-faint)' }}
                >
                  <Star className="h-4 w-4" fill={email.starred ? 'var(--star-color)' : 'none'} />
                </button>
                {!email.is_read && (
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
