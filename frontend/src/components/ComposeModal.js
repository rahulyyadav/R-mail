import React, { useState, useEffect, useRef } from 'react';
import { useMailContext } from '../contexts/MailContext';
import { X, Minus, Send, Maximize2 } from 'lucide-react';

export function ComposeModal() {
    const { showCompose, setShowCompose, composeData, setComposeData, sendEmail, isLoading } = useMailContext();
    const [minimized, setMinimized] = useState(false);
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const toRef = useRef(null);

    useEffect(() => {
        if (showCompose) {
            setTo(composeData.to || '');
            setSubject(composeData.subject || '');
            setBody(composeData.body || '');
            setMinimized(false);
            setTimeout(() => {
                if (!composeData.to) toRef.current?.focus();
            }, 200);
        }
    }, [showCompose, composeData]);

    const handleSend = async () => {
        if (!to.trim() || !subject.trim()) return;
        const ok = await sendEmail(to, subject, body, composeData._replyMeta || {});
        if (ok) {
            setTo(''); setSubject(''); setBody('');
        }
    };

    if (!showCompose) return null;

    if (minimized) {
        return (
            <div
                className="fixed bottom-0 right-6 w-72 rounded-t-xl cursor-pointer animate-slide-up z-50"
                style={{ background: 'var(--compose-bg)', border: '1px solid var(--border-color)', borderBottom: 'none', boxShadow: 'var(--shadow-lg)' }}
                onClick={() => setMinimized(false)}
            >
                <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {subject || 'New Message'}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5" style={{ color: 'var(--text-faint)' }} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed bottom-0 right-6 w-[480px] rounded-t-2xl flex flex-col animate-slide-up z-50"
            style={{
                background: 'var(--compose-bg)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid var(--border-color)',
                borderBottom: 'none',
                boxShadow: 'var(--shadow-lg)',
                maxHeight: '60vh',
            }}
        >
            {/* Title bar */}
            <div
                className="flex items-center justify-between px-4 py-2.5 rounded-t-2xl"
                style={{ background: 'var(--accent)', color: 'white' }}
            >
                <span className="text-sm font-semibold">{composeData._replyMeta ? 'Reply' : 'New Message'}</span>
                <div className="flex items-center gap-1.5">
                    <button onClick={() => setMinimized(true)} className="p-1 rounded-md hover:bg-white/20 transition-colors">
                        <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setShowCompose(false)} className="p-1 rounded-md hover:bg-white/20 transition-colors">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Form */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 mt-3">
                    <div className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-faint)' }}>To</span>
                        <input
                            ref={toRef}
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            className="flex-1 text-sm outline-none"
                            style={{ background: 'transparent', color: 'var(--text-primary)' }}
                        />
                    </div>
                    <div className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-faint)' }}>Subject</span>
                        <input
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            className="flex-1 text-sm outline-none"
                            style={{ background: 'transparent', color: 'var(--text-primary)' }}
                        />
                    </div>
                </div>

                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message..."
                    className="flex-1 px-4 py-3 text-sm outline-none resize-none"
                    style={{ background: 'transparent', color: 'var(--text-primary)', minHeight: '140px' }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
                />

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>⌘+Enter to send</span>
                    <button
                        onClick={handleSend}
                        disabled={!to.trim() || !subject.trim() || isLoading}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
                        style={{ background: 'var(--send-btn)' }}
                    >
                        <Send className="h-3.5 w-3.5" /> {isLoading ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
}
