import React, { useEffect, useState } from 'react';

export function LoginPage({ onLogin }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 overflow-hidden relative" style={{ background: 'var(--bg-primary)' }}>
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07] animate-float"
                    style={{
                        top: '-10%', right: '-5%',
                        background: 'radial-gradient(circle at center, var(--accent), transparent 70%)',
                    }}
                />
                <div
                    className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05]"
                    style={{
                        bottom: '-8%', left: '-3%',
                        background: 'radial-gradient(circle at center, var(--accent-soft), transparent 70%)',
                        animation: 'float 4s ease-in-out infinite reverse',
                    }}
                />
                <div
                    className="absolute w-[200px] h-[200px] rounded-full opacity-[0.04]"
                    style={{
                        top: '40%', left: '20%',
                        background: 'radial-gradient(circle at center, var(--accent), transparent 70%)',
                        animation: 'float 5s ease-in-out infinite 1s',
                    }}
                />
            </div>

            {/* Card */}
            <div
                className="relative w-full max-w-sm transition-all duration-700 ease-out"
                style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
                }}
            >
                <div
                    className="rounded-3xl p-8 sm:p-10"
                    style={{
                        background: 'var(--bg-overlay)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <img
                            src="/logo.png"
                            alt="Rmail"
                            className="h-16 w-16 mb-4 rounded-2xl"
                            style={{ boxShadow: 'var(--shadow-md)' }}
                        />
                        <h1 className="text-2xl font-heading tracking-tight">
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
                                marginLeft: '2px',
                            }}>mail</span>
                        </h1>
                        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                            Your AI-powered inbox
                        </p>
                    </div>

                    {/* Sign-in button */}
                    <button
                        onClick={onLogin}
                        className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl font-semibold text-[15px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group"
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            boxShadow: 'var(--shadow-sm)',
                        }}
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>Continue with Google</span>
                    </button>

                    <p className="mt-5 text-center text-[11px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                        Connect your Gmail to read, send, and manage emails with AI assistance
                    </p>
                </div>

                {/* Bottom features */}
                <div className="flex items-center justify-center gap-6 mt-6">
                    {[
                        { icon: '🔒', label: 'Secure' },
                        { icon: '⚡', label: 'Real-time' },
                        { icon: '🤖', label: 'AI-powered' },
                    ].map((feat, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-1.5 transition-all duration-500"
                            style={{
                                opacity: mounted ? 1 : 0,
                                transform: mounted ? 'translateY(0)' : 'translateY(8px)',
                                transitionDelay: `${300 + i * 100}ms`,
                            }}
                        >
                            <span className="text-xs">{feat.icon}</span>
                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>{feat.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
