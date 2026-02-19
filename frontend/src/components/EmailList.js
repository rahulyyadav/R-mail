import React from 'react';
import { useMailContext } from '@/contexts/MailContext';
import { Star, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

function formatDate(dateStr) {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  } catch {
    return '';
  }
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  'bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600',
  'bg-cyan-600', 'bg-violet-600', 'bg-pink-600', 'bg-teal-600',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function EmailListItem({ email, onOpen, onStar }) {
  const displayName = email.folder === 'sent' ? email.to_name : email.from_name;

  return (
    <div
      data-testid={`email-item-${email.id}`}
      onClick={() => onOpen(email)}
      className={cn(
        "group flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all border-l-2 border-transparent hover:border-indigo-500 hover:bg-zinc-900/50",
        !email.is_read && "bg-zinc-900/30"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "h-9 w-9 min-w-[36px] rounded-full flex items-center justify-center text-xs font-semibold text-white",
        getAvatarColor(displayName)
      )}>
        {getInitials(displayName)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn(
            "text-sm truncate",
            !email.is_read ? "font-semibold text-white" : "font-medium text-zinc-300"
          )}>
            {displayName}
          </span>
          <span className="text-[11px] text-zinc-500 whitespace-nowrap flex-shrink-0">
            {formatDate(email.date)}
          </span>
        </div>
        <p className={cn(
          "text-sm truncate mb-0.5",
          !email.is_read ? "font-medium text-zinc-200" : "text-zinc-400"
        )}>
          {email.subject}
        </p>
        <p className="text-xs text-zinc-500 truncate">{email.preview}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-1.5 pt-0.5">
        {!email.is_read && (
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
        )}
        <button
          data-testid={`star-${email.id}`}
          onClick={(e) => { e.stopPropagation(); onStar(email.id); }}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity",
            email.starred && "opacity-100"
          )}
        >
          <Star className={cn(
            "h-3.5 w-3.5 transition-colors",
            email.starred ? "fill-amber-500 text-amber-500" : "text-zinc-600 hover:text-amber-500"
          )} />
        </button>
      </div>
    </div>
  );
}

export function EmailList({ folder }) {
  const { emails, openEmail, toggleStar, filters, isAIActing } = useMailContext();
  const list = emails[folder] || [];

  const hasActiveFilters = filters.sender || filters.keyword || filters.unreadOnly || filters.dateFrom || filters.dateTo;

  return (
    <div data-testid={`email-list-${folder}`} className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white font-heading capitalize">{folder}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {list.length} {list.length === 1 ? 'message' : 'messages'}
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>
        {isAIActing && (
          <div data-testid="ai-acting-indicator" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs text-indigo-400 font-medium">AI is working...</span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar />

      {/* Email List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-20 px-6">
            <div className="h-16 w-16 rounded-2xl bg-zinc-900 flex items-center justify-center mb-4">
              <span className="text-2xl text-zinc-700">
                {folder === 'inbox' ? <InboxIcon /> : <SendIcon />}
              </span>
            </div>
            <p className="text-sm text-zinc-500 text-center">
              {hasActiveFilters ? 'No emails match your filters' : `No ${folder} messages`}
            </p>
          </div>
        ) : (
          list.map(email => (
            <EmailListItem
              key={email.id}
              email={email}
              onOpen={openEmail}
              onStar={toggleStar}
            />
          ))
        )}
      </div>
    </div>
  );
}

function InboxIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
}
function SendIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
}

function FilterBar() {
  const { filters, setFilters, clearFilters } = useMailContext();
  const hasFilters = filters.sender || filters.unreadOnly || filters.dateFrom || filters.dateTo;

  if (!hasFilters && !filters.keyword) return null;

  return (
    <div data-testid="filter-bar" className="px-4 py-2 border-b border-zinc-800/50 flex items-center gap-2 flex-wrap bg-zinc-950/50">
      {filters.sender && (
        <FilterChip label={`From: ${filters.sender}`} onRemove={() => setFilters(prev => ({ ...prev, sender: '' }))} />
      )}
      {filters.keyword && (
        <FilterChip label={`"${filters.keyword}"`} onRemove={() => setFilters(prev => ({ ...prev, keyword: '' }))} />
      )}
      {filters.unreadOnly && (
        <FilterChip label="Unread only" onRemove={() => setFilters(prev => ({ ...prev, unreadOnly: false }))} />
      )}
      {filters.dateFrom && (
        <FilterChip label={`From: ${filters.dateFrom.split('T')[0]}`} onRemove={() => setFilters(prev => ({ ...prev, dateFrom: '' }))} />
      )}
      {filters.dateTo && (
        <FilterChip label={`To: ${filters.dateTo.split('T')[0]}`} onRemove={() => setFilters(prev => ({ ...prev, dateTo: '' }))} />
      )}
      {hasFilters && (
        <button onClick={clearFilters} className="text-[10px] text-indigo-400 hover:text-indigo-300 ml-auto">
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-[11px] text-zinc-400 border border-zinc-700/50">
      {label}
      <button onClick={onRemove} className="hover:text-white ml-0.5">&times;</button>
    </span>
  );
}
