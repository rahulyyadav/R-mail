import React from 'react';
import { MailProvider, useMailContext } from './contexts/MailContext';
import { LoginPage } from './components/LoginPage';
import { Toaster } from 'sonner';

// Lazy load dashboard components
const TopBar = React.lazy(() => import('./components/TopBar').then(m => ({ default: m.TopBar })));
const Sidebar = React.lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));
const EmailList = React.lazy(() => import('./components/EmailList').then(m => ({ default: m.EmailList })));
const EmailDetail = React.lazy(() => import('./components/EmailDetail').then(m => ({ default: m.EmailDetail })));
const ComposeModal = React.lazy(() => import('./components/ComposeModal').then(m => ({ default: m.ComposeModal })));
const AIAssistant = React.lazy(() => import('./components/AIAssistant').then(m => ({ default: m.AIAssistant })));

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg-primary)' }}>
      <img src="/logo.png" alt="Rmail" className="h-14 w-14 rounded-2xl animate-pulse-glow" />
      <div className="loading-spinner" />
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Loading your inbox…</p>
    </div>
  );
}

function MailDashboard() {
  const { currentView } = useMailContext();

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <React.Suspense fallback={null}>
        <TopBar />
        <div className="flex-1 flex min-h-0">
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {currentView === 'detail' ? <EmailDetail /> : <EmailList />}
          </main>
        </div>
        <ComposeModal />
        <AIAssistant />
      </React.Suspense>
    </div>
  );
}

function AppContent() {
  const { authStatus, authLoading, login } = useMailContext();

  if (authLoading) return <LoadingScreen />;
  if (!authStatus.gmail_configured) return <LoginPage onLogin={login} />;
  return <MailDashboard />;
}

export default function App() {
  return (
    <MailProvider>
      <AppContent />
      <Toaster
        position="bottom-left"
        toastOptions={{
          className: '!rounded-xl !shadow-lg',
          style: {
            background: 'var(--bg-overlay)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />
    </MailProvider>
  );
}
