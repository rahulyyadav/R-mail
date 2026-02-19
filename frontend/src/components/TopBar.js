import React, { useState, useRef, useEffect } from 'react';
import { useMailContext } from '../contexts/MailContext';
import { Sun, Moon, LogOut, ChevronDown } from 'lucide-react';

export function TopBar() {
    const { authStatus, logout, theme, toggleTheme, wsConnected } = useMailContext();
    const [showProfile, setShowProfile] = useState(false);
    const profileRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfile(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <header
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                zIndex: 50,
            }}
        >
            {/* Left — Logo */}
            <div className="flex items-center gap-3">
                <img
                    src="/logo.png"
                    alt="Rmail"
                    className="h-9 w-9 rounded-xl"
                    style={{ boxShadow: 'var(--shadow-md)' }}
                />
                <div>
                    <h1
                        className="font-heading tracking-tight leading-none"
                        style={{ fontSize: '18px' }}
                    >
                        <span
                            style={{
                                fontWeight: 800,
                                background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            R
                        </span>
                        <span
                            style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                letterSpacing: '0.02em',
                                marginLeft: '1px',
                            }}
                        >
                            mail
                        </span>
                    </h1>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                                background: wsConnected ? 'var(--success)' : 'var(--danger)',
                            }}
                        />
                        <span
                            className="text-[10px] font-medium"
                            style={{
                                color: wsConnected ? 'var(--success)' : 'var(--text-faint)',
                            }}
                        >
                            {wsConnected ? 'LIVE' : 'OFFLINE'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right — Theme toggle + Profile */}
            <div className="flex items-center gap-3">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 btn-press"
                    style={{
                        background: 'var(--accent-light)',
                        color: 'var(--accent)',
                    }}
                >
                    {theme === 'light' ? (
                        <Sun className="h-4 w-4" />
                    ) : (
                        <Moon className="h-4 w-4" />
                    )}
                </button>

                {/* Profile */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setShowProfile(!showProfile)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200 btn-press"
                        style={{
                            background: showProfile ? 'var(--accent-light)' : 'transparent',
                            border: '1px solid var(--border-color)',
                        }}
                    >
                        <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white"
                            style={{ background: 'var(--accent)' }}
                        >
                            {authStatus.email ? authStatus.email[0].toUpperCase() : 'R'}
                        </div>
                        <ChevronDown
                            className="h-3.5 w-3.5 transition-transform duration-200"
                            style={{
                                color: 'var(--text-muted)',
                                transform: showProfile ? 'rotate(180deg)' : 'rotate(0)',
                            }}
                        />
                    </button>

                    {/* Dropdown */}
                    {showProfile && (
                        <div
                            className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl p-1 animate-fade-in-up"
                            style={{
                                background: 'var(--bg-overlay)',
                                border: '1px solid var(--border-color)',
                                boxShadow: 'var(--shadow-lg)',
                                zIndex: 100,
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                            }}
                        >
                            {/* User info */}
                            <div className="px-3 py-3 flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                                    style={{ background: 'var(--accent)' }}
                                >
                                    {authStatus.email ? authStatus.email[0].toUpperCase() : 'R'}
                                </div>
                                <div className="min-w-0">
                                    <p
                                        className="text-sm font-semibold truncate"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {authStatus.email
                                            ? authStatus.email.split('@')[0]
                                            : 'Not connected'}
                                    </p>
                                    <p
                                        className="text-xs truncate"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        {authStatus.email || 'No email connected'}
                                    </p>
                                </div>
                            </div>

                            <div
                                className="mx-2 my-1"
                                style={{ height: '1px', background: 'var(--border-color)' }}
                            />

                            {/* Logout */}
                            <button
                                onClick={() => {
                                    logout();
                                    setShowProfile(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 btn-press"
                                style={{ color: 'var(--danger)' }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = 'var(--accent-light)')
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = 'transparent')
                                }
                            >
                                <LogOut className="h-4 w-4" />
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
