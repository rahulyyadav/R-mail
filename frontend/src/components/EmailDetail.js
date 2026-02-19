import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useMailContext } from '../contexts/MailContext';
import { api, API } from '../contexts/MailContext';
import { ArrowLeft, Star, Reply, Forward, ChevronDown, ChevronUp, Send, User, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

function formatFullDate(dateStr) {
  try { return format(parseISO(dateStr), "EEEE, MMMM d, yyyy 'at' h:mm a"); }
  catch { return dateStr; }
}

function formatShortDate(dateStr) {
  try { return format(parseISO(dateStr), 'MMM d, h:mm a'); }
  catch { return ''; }
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

// Renders HTML email in a sandboxed iframe that auto-resizes
function HtmlEmailViewer({ html, theme }) {
  const iframeRef = useRef(null);

  const adjustHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const h = iframe.contentDocument?.body?.scrollHeight;
      if (h) iframe.style.height = Math.min(h + 24, 800) + 'px';
    } catch { /* cross-origin fallback */ }
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;

    const bgColor = theme === 'dark' ? '#1a1d2e' : '#ffffff';
    const textColor = theme === 'dark' ? '#e2e8f0' : '#1a1d2e';

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html><head><style>
        body { margin: 0; padding: 16px; font-family: Inter, sans-serif; font-size: 14px;
               line-height: 1.6; color: ${textColor}; background: ${bgColor};
               word-wrap: break-word; overflow-wrap: break-word; }
        img { max-width: 100% !important; height: auto !important; }
        a { color: #6366f1; }
        table { max-width: 100% !important; }
        pre, code { white-space: pre-wrap; word-break: break-all; max-width: 100%; }
      </style></head><body>${html}</body></html>
    `);
    doc.close();
    setTimeout(adjustHeight, 200);
  }, [html, theme, adjustHeight]);

  return <iframe ref={iframeRef} className="email-html-frame" title="Email content" sandbox="allow-same-origin" />;
}

// Single message in a thread — collapsible
function ThreadMessage({ msg, isLast, theme }) {
  const [expanded, setExpanded] = useState(isLast);
  const hasHtml = !!msg.body_html;

  return (
    <div className="animate-fade-in" style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-color)' }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors"
        style={{ background: expanded ? 'transparent' : 'transparent' }}
      >
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
          style={{ background: AvatarColor(msg.from_name || msg.from_email) }}
        >
          {getInitials(msg.from_name, msg.from_email)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {msg.from_name || msg.from_email}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
              {formatShortDate(msg.date)}
            </span>
          </div>
          {!expanded && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {msg.preview || msg.body?.slice(0, 120)}
            </p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 mt-1" style={{ color: 'var(--text-faint)' }} />
          : <ChevronDown className="h-4 w-4 shrink-0 mt-1" style={{ color: 'var(--text-faint)' }} />}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-5 pb-4 pl-16 animate-fade-in">
          {msg.to_email && (
            <p className="text-[11px] mb-3 flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
              <User className="h-3 w-3" />
              To: {msg.to_name || msg.to_email} &lt;{msg.to_email}&gt;
            </p>
          )}
          {hasHtml ? (
            <HtmlEmailViewer html={msg.body_html} theme={theme} />
          ) : (
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              {msg.body}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmailDetail() {
  const { selectedEmail, navigateTo, toggleStar, sendEmail, setShowCompose, setComposeData, authStatus, theme } = useMailContext();
  const [thread, setThread] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!selectedEmail) return;
    if (selectedEmail.thread_id) {
      (async () => {
        try {
          const res = await api.get(`${API}/emails/thread/${selectedEmail.thread_id}`);
          setThread(res.data || [selectedEmail]);
        } catch { setThread([selectedEmail]); }
      })();
    } else {
      setThread([selectedEmail]);
    }
  }, [selectedEmail]);

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !selectedEmail) return;
    setSending(true);
    const replyTo = selectedEmail.from_email === authStatus.email ? selectedEmail.to_email : selectedEmail.from_email;
    const ok = await sendEmail(
      replyTo,
      `Re: ${selectedEmail.subject.replace(/^Re:\s*/i, '')}`,
      replyText,
      { message_id: selectedEmail.message_id, thread_id: selectedEmail.thread_id }
    );
    if (ok) setReplyText('');
    setSending(false);
  }, [replyText, selectedEmail, sendEmail, authStatus.email]);

  const handleForward = useCallback(() => {
    if (!selectedEmail) return;
    // Gather full thread content for forwarding
    const fwdContent = thread.length > 1
      ? thread.map(m => `--- From: ${m.from_name} <${m.from_email}> on ${formatShortDate(m.date)} ---\n${m.body}`).join('\n\n')
      : selectedEmail.body;
    setComposeData({
      to: '',
      subject: `Fwd: ${selectedEmail.subject.replace(/^Fwd:\s*/i, '')}`,
      body: `\n\n---------- Forwarded message ----------\nFrom: ${selectedEmail.from_name || ''} <${selectedEmail.from_email}>\nDate: ${formatFullDate(selectedEmail.date)}\nSubject: ${selectedEmail.subject}\nTo: ${selectedEmail.to_email}\n\n${fwdContent}`,
    });
    setShowCompose(true);
  }, [selectedEmail, thread, setComposeData, setShowCompose]);

  if (!selectedEmail) return null;

  const lastMsg = thread.length > 0 ? thread[thread.length - 1] : selectedEmail;
  const replyTo = lastMsg.from_email === authStatus.email ? lastMsg.to_email : lastMsg.from_email;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => navigateTo('inbox')}
          className="h-8 w-8 rounded-xl flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="flex-1 text-base font-bold font-heading truncate" style={{ color: 'var(--text-primary)' }}>
          {selectedEmail.subject}
        </h2>
        <button onClick={() => toggleStar(selectedEmail.id)}>
          <Star
            className="h-5 w-5 transition-colors"
            style={{ color: selectedEmail.starred ? 'var(--star-color)' : 'var(--text-faint)' }}
            fill={selectedEmail.starred ? 'var(--star-color)' : 'none'}
          />
        </button>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto">
        {thread.length > 1 && (
          <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-faint)' }}>
              {thread.length} messages in thread
            </span>
          </div>
        )}

        {/* If single message — show full detail */}
        {thread.length <= 1 ? (
          <div className="animate-fade-in-up">
            <div className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: AvatarColor(selectedEmail.from_name || selectedEmail.from_email) }}
              >
                {getInitials(selectedEmail.from_name, selectedEmail.from_email)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {selectedEmail.from_name || selectedEmail.from_email}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    &lt;{selectedEmail.from_email}&gt;
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatFullDate(selectedEmail.date)}</span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  To: {selectedEmail.to_name || selectedEmail.to_email} &lt;{selectedEmail.to_email}&gt;
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-5">
              {selectedEmail.body_html ? (
                <HtmlEmailViewer html={selectedEmail.body_html} theme={theme} />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                  {selectedEmail.body}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Thread view — collapsible messages */
          <div>
            {thread.map((msg, i) => (
              <ThreadMessage key={msg.id || i} msg={msg} isLast={i === thread.length - 1} theme={theme} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="shrink-0 px-5 py-3" style={{ borderTop: '1px solid var(--border-color)' }}>
        {/* Quick action buttons */}
        <div className="flex items-center gap-2 mb-3">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
            onClick={() => document.getElementById('reply-input')?.focus()}
          >
            <Reply className="h-3.5 w-3.5" /> Reply
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            onClick={handleForward}
          >
            <Forward className="h-3.5 w-3.5" /> Forward
          </button>
        </div>

        {/* Reply box */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
        >
          <div className="px-3 py-1.5 text-[11px] font-medium" style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border-color)' }}>
            Quick reply to {replyTo?.split('@')[0]}
          </div>
          <textarea
            id="reply-input"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            rows={2}
            className="w-full px-3 py-2 text-sm outline-none resize-none"
            style={{ background: 'transparent', color: 'var(--text-primary)' }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(); }}
          />
          <div className="flex justify-end px-3 py-2">
            <button
              onClick={handleReply}
              disabled={!replyText.trim() || sending}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: 'var(--send-btn)' }}
            >
              <Send className="h-3 w-3" /> {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
