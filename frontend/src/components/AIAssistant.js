import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMailContext } from '../contexts/MailContext';
import { Sparkles, Send, Trash2, ChevronUp, ChevronDown, Zap } from 'lucide-react';

export function AIAssistant() {
    const { chatMessages, sendAIMessage, clearChat, isAIActing } = useMailContext();
    const [expanded, setExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);
    const chatEndRef = useRef(null);

    useEffect(() => {
        if (expanded && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, expanded]);

    const handleSend = useCallback(async () => {
        const msg = input.trim();
        if (!msg || isAIActing) return;
        setInput('');
        setExpanded(true);
        await sendAIMessage(msg);
    }, [input, isAIActing, sendAIMessage]);

    const quickActions = [
        { label: 'Summarize inbox', icon: '📋' },
        { label: 'Draft a reply', icon: '✍️' },
        { label: 'Find unread', icon: '📬' },
    ];

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center" style={{ width: 'clamp(360px, 40vw, 520px)' }}>
            {/* Expanded chat panel */}
            {expanded && (
                <div
                    className="w-full mb-2 rounded-2xl flex flex-col overflow-hidden animate-scale-in"
                    style={{
                        background: 'var(--bg-overlay)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-lg)',
                        maxHeight: '50vh',
                    }}
                >
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                            <span className="text-xs font-bold font-heading" style={{ color: 'var(--text-primary)' }}>AI Assistant</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {chatMessages.length > 0 && (
                                <button onClick={clearChat} className="p-1 rounded-md transition-colors" style={{ color: 'var(--text-faint)' }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                            <button onClick={() => setExpanded(false)} className="p-1 rounded-md transition-colors" style={{ color: 'var(--text-faint)' }}>
                                <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: '120px' }}>
                        {chatMessages.length === 0 && (
                            <div className="text-center py-6 space-y-3">
                                <Sparkles className="h-8 w-8 mx-auto" style={{ color: 'var(--accent-soft)' }} />
                                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Ask me anything about your emails</p>
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                    {quickActions.map((qa, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setInput(qa.label); inputRef.current?.focus(); }}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                                            style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                                        >
                                            <span>{qa.icon}</span> {qa.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                                    style={msg.role === 'user' ? {
                                        background: 'var(--accent)',
                                        color: 'white',
                                        borderBottomRightRadius: '6px',
                                    } : {
                                        background: 'var(--bg-card)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderBottomLeftRadius: '6px',
                                    }}
                                >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    {msg.actions && msg.actions.length > 0 && (
                                        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: msg.role === 'user' ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-color)' }}>
                                            {msg.actions.map((a, j) => (
                                                <div key={j} className="flex items-center gap-1.5">
                                                    <Zap className="h-3 w-3" style={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--accent)' }} />
                                                    <span className="text-[11px] font-medium" style={{ opacity: 0.8 }}>
                                                        {a.type}: {a.view || a.to || a.keyword || a.email_id || ''}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isAIActing && (
                            <div className="flex justify-start">
                                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)', animation: `pulse-glow 1.4s ${i * 0.2}s infinite` }} />
                                        ))}
                                    </div>
                                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Processing...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                </div>
            )}

            {/* Bottom command bar */}
            <div
                className="w-full rounded-2xl flex items-center gap-2 px-3 py-2 transition-all duration-200"
                style={{
                    background: 'var(--ai-bar-bg)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid var(--border-color)',
                    boxShadow: focused ? `0 0 0 2px var(--accent-glow), var(--shadow-md)` : 'var(--shadow-md)',
                }}
            >
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </button>
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="AI Assistant: Ask about your emails..."
                    className="flex-1 text-sm outline-none"
                    style={{ background: 'transparent', color: 'var(--text-primary)' }}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isAIActing}
                    className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30"
                    style={{ background: 'var(--accent)', color: 'white' }}
                >
                    <Send className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
