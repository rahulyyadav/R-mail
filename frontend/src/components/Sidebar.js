import React from 'react';
import { useMailContext } from '@/contexts/MailContext';
import { Inbox, Send, PenSquare, Bot, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { currentView, navigateTo, unreadCount, wsConnected, filters, setFilters, clearFilters } = useMailContext();

  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadCount },
    { id: 'sent', label: 'Sent', icon: Send },
  ];

  return (
    <aside
      data-testid="sidebar"
      className="w-[240px] min-w-[240px] bg-zinc-950 border-r border-zinc-800 h-full flex flex-col py-6 px-3"
    >
      {/* Logo */}
      <div className="px-3 mb-8 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white font-heading tracking-tight">AI Mail</h1>
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              wsConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
            )} />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {wsConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Compose Button */}
      <button
        data-testid="compose-button"
        onClick={() => navigateTo('compose')}
        className="mx-2 mb-6 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
      >
        <PenSquare className="h-4 w-4" />
        Compose
      </button>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (currentView === 'detail' && item.id === 'inbox');
          return (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => navigateTo(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-indigo-500/10 text-indigo-400 font-medium"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Search */}
      <div className="mx-2 mt-4 mb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            data-testid="sidebar-search"
            type="text"
            placeholder="Search emails..."
            value={filters.keyword}
            onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
          />
        </div>
        {(filters.keyword || filters.sender || filters.unreadOnly || filters.dateFrom) && (
          <button
            data-testid="clear-filters-btn"
            onClick={clearFilters}
            className="mt-2 w-full text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* User */}
      <div className="mx-2 pt-4 border-t border-zinc-800">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-400">
            Y
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-300">you@mailapp.com</p>
            <p className="text-[10px] text-zinc-600">Simulated Mode</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
