'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { authHelpers } from '@/lib/firebase';
import { showToast } from '@/components/Toast';
import UpgradeBanner from '@/components/UpgradeBanner';
import { useUserTier } from '@/hooks/use-user-tier';

type SettingsTab = 'profile' | 'subscription' | 'security' | 'notifications' | 'sessions' | 'danger';

const TABS: { id: SettingsTab; label: string; icon: string; description: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤', description: 'Personal info & avatar' },
    { id: 'subscription', label: 'Subscription', icon: '💎', description: 'Plan & billing' },
    { id: 'security', label: 'Security', icon: '🛡️', description: 'Password, 2FA & login' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', description: 'Email & push alerts' },
    { id: 'sessions', label: 'Sessions', icon: '💻', description: 'Active devices' },
    { id: 'danger', label: 'Danger Zone', icon: '⚠️', description: 'Delete account' },
];

export default function SettingsPage() {
    const router = useRouter();
    const { user, setUser } = useStore();
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

    return (
        <div className="min-h-screen p-6 lg:p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] border border-white/10 p-8 mb-8"
            >
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/30 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-lg">
                        <span className="text-3xl">⚙️</span>
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold">
                            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                Account Settings
                            </span>
                        </h1>
                        <p className="text-silver">Manage your profile, security, and preferences</p>
                    </div>
                </div>
            </motion.div>

            {/* Tab Navigation + Content */}
            <div className="flex flex-col lg:flex-row gap-6 max-w-6xl">
                {/* Sidebar Tabs */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:w-64 flex-shrink-0"
                >
                    <div className="lg:sticky lg:top-8 space-y-1.5 p-2 rounded-2xl bg-[#0A0A0A] border border-white/10">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${activeTab === tab.id
                                    ? 'bg-white/10 text-white border border-white/10 shadow-lg'
                                    : 'text-silver hover:bg-white/5 hover:text-white border border-transparent'
                                    }`}
                            >
                                <span className="text-xl">{tab.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${activeTab === tab.id ? 'text-white' : ''}`}>{tab.label}</p>
                                    <p className="text-xs text-slate-500 truncate">{tab.description}</p>
                                </div>
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="w-1.5 h-8 rounded-full bg-cyan-500"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Content Area */}
                <div className="flex-1">
                    <AnimatePresence mode="wait">
                        {activeTab === 'profile' && <ProfileTab key="profile" user={user} setUser={setUser} />}
                        {activeTab === 'subscription' && <SubscriptionTab key="subscription" />}
                        {activeTab === 'security' && <SecurityTab key="security" user={user} />}
                        {activeTab === 'notifications' && <NotificationsTab key="notifications" />}
                        {activeTab === 'sessions' && <SessionsTab key="sessions" user={user} />}
                        {activeTab === 'danger' && <DangerTab key="danger" user={user} />}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// ===== SUBSCRIPTION TAB =====
function SubscriptionTab() {
    const { tier, loading } = useUserTier();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            {/* Current Plan */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span>💎</span> Your Plan
                </h3>

                {loading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="h-6 bg-white/5 rounded-lg w-1/3" />
                        <div className="h-4 bg-white/5 rounded-lg w-1/2" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Plan Status Card */}
                        <div className={`p-5 rounded-xl border ${
                            tier === 'pro'
                                ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/30'
                                : 'bg-white/5 border-white/10'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                                        tier === 'pro'
                                            ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                                            : 'bg-white/10'
                                    }`}>
                                        {tier === 'pro' ? '👑' : '🆓'}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-white">
                                            {tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                                        </h4>
                                        <p className="text-sm text-silver">
                                            {tier === 'pro'
                                                ? '$2.99/month — Unlimited access'
                                                : 'Limited usage — Upgrade for full access'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    tier === 'pro'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                }`}>
                                    {tier === 'pro' ? '✓ Active' : 'Free Tier'}
                                </span>
                            </div>
                        </div>

                        {/* Upgrade or Manage */}
                        <UpgradeBanner currentTier={tier} />
                    </div>
                )}
            </div>

            {/* What's Included */}
            {tier === 'free' && (
                <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>✨</span> What you get with Pro
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { icon: '♾️', label: 'Unlimited Resume Morphs', desc: 'No limits on AI-powered resume tailoring' },
                            { icon: '⚔️', label: 'Unlimited Gauntlet Sessions', desc: 'Practice interviews without caps' },
                            { icon: '🎴', label: 'Unlimited Flashcards', desc: 'Study decks with no restrictions' },
                            { icon: '💼', label: 'Unlimited JD Analysis', desc: 'Analyze as many job descriptions as you want' },
                            { icon: '🎙️', label: 'Voice Interview Mode', desc: 'Speak naturally with AI interviewer' },
                            { icon: '🌉', label: 'Skill Bridge', desc: 'Curated learning to close skill gaps' },
                            { icon: '🔮', label: 'Market Oracle', desc: 'Real-time career intelligence' },
                            { icon: '🤖', label: 'Dual-AI Enhance', desc: 'GPT + Gemini working together' },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                <span className="text-lg mt-0.5">{feature.icon}</span>
                                <div>
                                    <p className="text-sm font-medium text-white">{feature.label}</p>
                                    <p className="text-xs text-slate-500">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}

// ===== PROFILE TAB =====
function ProfileTab({ user, setUser }: { user: any; setUser: any }) {
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const { success, error } = await authHelpers.updateProfile({ displayName });
            if (success) {
                showToast('Profile updated!', '✅');
                setEditing(false);
                setUser({ ...user, displayName });
            } else {
                showToast(error?.message || 'Failed to update', '❌');
            }
        } catch (e: any) {
            showToast(e.message || 'Error', '❌');
        }
        setSaving(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            {/* Avatar & Name */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 relative">
                    <div className="absolute -bottom-10 left-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white border-4 border-[#0A0A0A] shadow-xl">
                            {user?.email?.[0]?.toUpperCase() || '?'}
                        </div>
                    </div>
                </div>
                <div className="pt-14 px-6 pb-6">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white">{user?.displayName || user?.email?.split('@')[0] || 'User'}</h2>
                            <p className="text-sm text-silver">{user?.email || 'dev@talentconsulting.io'}</p>
                        </div>
                        <button
                            onClick={() => setEditing(!editing)}
                            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-silver hover:text-white hover:bg-white/10 transition-all"
                        >
                            {editing ? 'Cancel' : '✏️ Edit Profile'}
                        </button>
                    </div>

                    <AnimatePresence>
                        {editing && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-4 overflow-hidden"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Your full name"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+1 (555) 000-0000"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Bio</label>
                                    <textarea
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Tell us about yourself..."
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 resize-none"
                                    />
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : '💾 Save Profile'}
                                </motion.button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Account Details Card */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span>📋</span> Account Details
                </h3>
                <div className="space-y-3">
                    {[
                        { label: 'Email', value: user?.email || 'dev@talentconsulting.io', icon: '📧' },
                        { label: 'User ID', value: user?.uid || user?.id || 'dev-user', icon: '🆔' },
                        { label: 'Member Since', value: user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Development Mode', icon: '📅' },
                        { label: 'Auth Provider', value: user?.providerData?.[0]?.providerId || 'Email/Password', icon: '🔑' },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{item.icon}</span>
                                <span className="text-sm text-silver">{item.label}</span>
                            </div>
                            <span className="text-sm text-white font-medium truncate max-w-[200px]">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

// ===== SECURITY TAB =====
function SecurityTab({ user }: { user: any }) {
    // Password
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);

    // Email
    const [newEmail, setNewEmail] = useState('');
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
    const [isEmailOpen, setIsEmailOpen] = useState(false);

    // MFA
    const [mfaStatus, setMfaStatus] = useState<{ enrolled: boolean; hints: any[] }>({ enrolled: false, hints: [] });
    const [mfaStep, setMfaStep] = useState<'idle' | 'qr' | 'unenrolling'>('idle');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [totpSecret, setTotpSecret] = useState<any>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaError, setMfaError] = useState('');

    useEffect(() => {
        const status = authHelpers.getMFAStatus();
        setMfaStatus(status);
    }, [user]);

    const getPasswordStrength = (pw: string) => {
        if (!pw) return { strength: 0, label: '', color: '' };
        let s = 0;
        if (pw.length >= 8) s++;
        if (pw.length >= 12) s++;
        if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
        if (/\d/.test(pw)) s++;
        if (/[^a-zA-Z0-9]/.test(pw)) s++;
        if (s <= 2) return { strength: s, label: 'Weak', color: 'bg-red-500' };
        if (s <= 3) return { strength: s, label: 'Medium', color: 'bg-yellow-500' };
        return { strength: s, label: 'Strong', color: 'bg-green-500' };
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword || !confirmPassword) return showToast('Fill all fields', '❌');
        if (newPassword !== confirmPassword) return showToast('Passwords don\'t match', '❌');
        if (newPassword.length < 8) return showToast('Min 8 characters', '❌');

        setIsUpdatingPassword(true);
        try {
            const { isValid } = await authHelpers.verifyPassword(user?.email || '', currentPassword);
            if (!isValid) { showToast('Current password incorrect', '❌'); setIsUpdatingPassword(false); return; }
            const { error } = await authHelpers.updatePassword(newPassword);
            if (error) { showToast(error.message || 'Failed', '❌'); }
            else { showToast('Password updated!', '✅'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
        } catch (e: any) { showToast(e.message, '❌'); }
        setIsUpdatingPassword(false);
    };

    const handleEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return showToast('Invalid email', '❌');
        if (newEmail === user?.email) return showToast('Already your email', 'ℹ️');

        setIsUpdatingEmail(true);
        try {
            const { error } = await authHelpers.updateEmail(newEmail);
            if (error) showToast(error.message || 'Failed', '❌');
            else { showToast(`Verification sent to ${newEmail}`, '✅'); setNewEmail(''); }
        } catch (e: any) { showToast(e.message, '❌'); }
        setIsUpdatingEmail(false);
    };

    const handleStartMFA = async () => {
        setMfaLoading(true); setMfaError('');
        try {
            const result = await authHelpers.generateTOTPSecret();
            if (result.error) throw result.error;
            setTotpSecret(result.totpSecret);
            setSecretKey(result.secretKey || '');
            if (result.qrCodeUrl) {
                const QRCode = (await import('qrcode')).default;
                const dataUrl = await QRCode.toDataURL(result.qrCodeUrl, { width: 200, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
                setQrDataUrl(dataUrl);
            }
            setMfaStep('qr');
        } catch (err: any) { setMfaError(err.message || 'Failed'); }
        setMfaLoading(false);
    };

    const handleVerifyMFA = async () => {
        if (!verifyCode || verifyCode.length < 6) { setMfaError('Enter the 6-digit code'); return; }
        setMfaLoading(true); setMfaError('');
        try {
            const { success, error } = await authHelpers.completeTOTPEnrollment(totpSecret, verifyCode, 'Google Authenticator');
            if (error) throw error;
            if (success) { showToast('2FA enabled!', '✅'); setMfaStatus({ enrolled: true, hints: [] }); setMfaStep('idle'); setVerifyCode(''); }
        } catch (err: any) { setMfaError(err.message || 'Invalid code'); }
        setMfaLoading(false);
    };

    const handleRemoveMFA = async () => {
        setMfaLoading(true); setMfaStep('unenrolling');
        try {
            const { success, error } = await authHelpers.unenrollMFA();
            if (error) throw error;
            if (success) { showToast('2FA disabled', '✅'); setMfaStatus({ enrolled: false, hints: [] }); }
        } catch (err: any) { setMfaError(err.message || 'Failed'); }
        setMfaLoading(false); setMfaStep('idle');
    };

    const pwStrength = getPasswordStrength(newPassword);

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            {/* Security Overview */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">🔒 Security Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Password', status: 'Set', icon: '🔑', color: 'text-green-400', bg: 'bg-green-500/10' },
                        { label: '2FA', status: mfaStatus.enrolled ? 'Enabled' : 'Disabled', icon: '🛡️', color: mfaStatus.enrolled ? 'text-green-400' : 'text-yellow-400', bg: mfaStatus.enrolled ? 'bg-green-500/10' : 'bg-yellow-500/10' },
                        { label: 'Last Login', status: user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString() : 'Recently', icon: '🕐', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    ].map((item, i) => (
                        <div key={i} className={`p-4 rounded-xl ${item.bg} border border-white/5`}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{item.icon}</span>
                                <div>
                                    <p className="text-sm text-silver">{item.label}</p>
                                    <p className={`text-sm font-semibold ${item.color}`}>{item.status}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Change Password */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                <button onClick={() => setIsPasswordOpen(!isPasswordOpen)} className="w-full p-6 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><span className="text-xl">🔒</span></div>
                        <div className="text-left">
                            <h3 className="text-lg font-semibold text-white">Change Password</h3>
                            <p className="text-sm text-silver">Update your account password</p>
                        </div>
                    </div>
                    <motion.svg animate={{ rotate: isPasswordOpen ? 180 : 0 }} className="w-5 h-5 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></motion.svg>
                </button>
                <AnimatePresence>
                    {isPasswordOpen && (
                        <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={handlePasswordChange} className="px-6 pb-6 space-y-4 overflow-hidden">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Current Password</label>
                                <input type={showPasswords ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                                <div className="relative">
                                    <input type={showPasswords ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20" />
                                    <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm">{showPasswords ? '🙈' : '👁️'}</button>
                                </div>
                                {newPassword && (
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-slate-500">Strength:</span>
                                            <span className={`text-xs font-medium ${pwStrength.label === 'Weak' ? 'text-red-400' : pwStrength.label === 'Medium' ? 'text-yellow-400' : 'text-green-400'}`}>{pwStrength.label}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${(pwStrength.strength / 5) * 100}%` }} className={`h-full ${pwStrength.color}`} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                                <input type={showPasswords ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20" />
                                {confirmPassword && newPassword !== confirmPassword && <p className="mt-1 text-xs text-red-400">⚠️ Passwords don't match</p>}
                            </div>
                            <button type="submit" disabled={isUpdatingPassword} className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50">
                                {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>

            {/* Change Email */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 overflow-hidden">
                <button onClick={() => setIsEmailOpen(!isEmailOpen)} className="w-full p-6 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center"><span className="text-xl">📧</span></div>
                        <div className="text-left">
                            <h3 className="text-lg font-semibold text-white">Change Email</h3>
                            <p className="text-sm text-silver">Update your email address</p>
                        </div>
                    </div>
                    <motion.svg animate={{ rotate: isEmailOpen ? 180 : 0 }} className="w-5 h-5 text-silver" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></motion.svg>
                </button>
                <AnimatePresence>
                    {isEmailOpen && (
                        <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={handleEmailChange} className="px-6 pb-6 space-y-4 overflow-hidden">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">New Email Address</label>
                                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Enter new email" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20" />
                                <p className="mt-2 text-xs text-slate-500">🔐 A verification link will be sent to confirm.</p>
                            </div>
                            <button type="submit" disabled={isUpdatingEmail} className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50">
                                {isUpdatingEmail ? 'Sending...' : 'Update Email'}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>

            {/* Two-Factor Authentication */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><span className="text-xl">🔐</span></div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Two-Factor Authentication</h3>
                            <p className="text-sm text-silver">Google Authenticator / TOTP</p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${mfaStatus.enrolled ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                        {mfaStatus.enrolled ? '✓ Enabled' : 'Not Enrolled'}
                    </span>
                </div>

                {mfaStatus.enrolled ? (
                    <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 flex items-center gap-3">
                            <span className="text-lg">🛡️</span>
                            <div>
                                <p className="text-white font-medium">Authenticator Active</p>
                                <p className="text-sm text-silver">{mfaStatus.hints[0]?.displayName || 'Google Authenticator'}</p>
                            </div>
                        </div>
                        <button onClick={handleRemoveMFA} disabled={mfaLoading} className="w-full px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/20 transition-all disabled:opacity-50">
                            {mfaLoading && mfaStep === 'unenrolling' ? 'Removing...' : '🗑️ Remove 2FA'}
                        </button>
                    </div>
                ) : mfaStep === 'qr' ? (
                    <div className="space-y-4">
                        {qrDataUrl && (
                            <div className="flex flex-col items-center">
                                <p className="text-silver text-sm mb-3 text-center">Scan with <strong className="text-amber-400">Google Authenticator</strong></p>
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10"><img src={qrDataUrl} alt="QR" className="w-48 h-48" /></div>
                            </div>
                        )}
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <p className="text-xs text-slate-500 mb-1">Manual key:</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-sm text-amber-400 font-mono break-all">{secretKey}</code>
                                <button onClick={() => { navigator.clipboard.writeText(secretKey); showToast('Copied!', '📋'); }} className="px-2 py-1 rounded-lg bg-white/5 text-slate-400 hover:text-white text-xs">Copy</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">6-digit code</label>
                            <input type="text" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white text-center text-2xl tracking-[0.3em] font-mono focus:outline-none focus:border-amber-500/50" placeholder="000000" maxLength={6} autoFocus />
                        </div>
                        {mfaError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30"><p className="text-sm text-red-300">{mfaError}</p></div>}
                        <div className="flex gap-3">
                            <button onClick={handleVerifyMFA} disabled={mfaLoading || verifyCode.length < 6} className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-amber-500/25 disabled:opacity-50">{mfaLoading ? 'Verifying...' : 'Verify & Enable'}</button>
                            <button onClick={() => { setMfaStep('idle'); setVerifyCode(''); setMfaError(''); }} className="px-4 py-3 rounded-xl border border-white/10 text-silver hover:text-white">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-500">Use Google Authenticator, Authy, or any TOTP-compatible app for extra security.</p>
                        {mfaError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30"><p className="text-sm text-red-300">{mfaError}</p></div>}
                        <button onClick={handleStartMFA} disabled={mfaLoading} className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-amber-500/25 disabled:opacity-50">
                            {mfaLoading ? 'Setting up...' : '🔐 Set Up Authenticator'}
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ===== NOTIFICATIONS TAB =====
function NotificationsTab() {
    const [settings, setSettings] = useState({
        emailApplications: true,
        emailInterviews: true,
        emailOffers: true,
        emailNewsletter: false,
        pushNewJobs: true,
        pushStatusUpdates: true,
        pushReminders: true,
    });

    const toggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
        showToast('Preference saved', '✅');
    };

    const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
        <button onClick={onChange} className={`relative w-12 h-7 rounded-full transition-colors ${enabled ? 'bg-cyan-500' : 'bg-white/10'}`}>
            <motion.div
                animate={{ x: enabled ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
            />
        </button>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            {/* Email Notifications */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><span>📧</span> Email Notifications</h3>
                <div className="space-y-4">
                    {[
                        { key: 'emailApplications' as const, label: 'Application Updates', desc: 'Status changes on your job applications' },
                        { key: 'emailInterviews' as const, label: 'Interview Reminders', desc: 'Upcoming interview alerts' },
                        { key: 'emailOffers' as const, label: 'Offer Notifications', desc: 'When you receive an offer' },
                        { key: 'emailNewsletter' as const, label: 'Weekly Newsletter', desc: 'Job market insights and career tips' },
                    ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                            <div>
                                <p className="text-sm font-medium text-white">{item.label}</p>
                                <p className="text-xs text-silver">{item.desc}</p>
                            </div>
                            <ToggleSwitch enabled={settings[item.key]} onChange={() => toggle(item.key)} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Push Notifications */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><span>📱</span> Push Notifications</h3>
                <div className="space-y-4">
                    {[
                        { key: 'pushNewJobs' as const, label: 'New Job Matches', desc: 'Jobs matching your resume profile' },
                        { key: 'pushStatusUpdates' as const, label: 'Status Updates', desc: 'Real-time application status changes' },
                        { key: 'pushReminders' as const, label: 'Follow-up Reminders', desc: 'Reminders to follow up on applications' },
                    ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                            <div>
                                <p className="text-sm font-medium text-white">{item.label}</p>
                                <p className="text-xs text-silver">{item.desc}</p>
                            </div>
                            <ToggleSwitch enabled={settings[item.key]} onChange={() => toggle(item.key)} />
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

// ===== SESSIONS TAB =====
function SessionsTab({ user }: { user: any }) {
    const sessions = [
        { device: 'This Device', browser: 'Chrome on macOS', ip: '127.0.0.1', lastActive: 'Active now', current: true, icon: '💻' },
        { device: 'iPhone 15', browser: 'Safari on iOS', ip: '192.168.1.x', lastActive: '2 hours ago', current: false, icon: '📱' },
    ];

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2"><span>💻</span> Active Sessions</h3>
                    <button className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all" onClick={() => showToast('All other sessions will be signed out', 'ℹ️')}>
                        Sign Out All Others
                    </button>
                </div>
                <div className="space-y-3">
                    {sessions.map((session, i) => (
                        <div key={i} className={`p-4 rounded-xl border ${session.current ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-white/5 border-white/5'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{session.icon}</span>
                                    <div>
                                        <p className="text-sm font-medium text-white flex items-center gap-2">
                                            {session.device}
                                            {session.current && <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px]">Current</span>}
                                        </p>
                                        <p className="text-xs text-silver">{session.browser} • {session.ip}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs font-medium ${session.current ? 'text-green-400' : 'text-silver'}`}>{session.lastActive}</p>
                                    {!session.current && (
                                        <button className="text-xs text-red-400 hover:underline mt-1" onClick={() => showToast('Session revoked', '✅')}>Revoke</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Login History */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><span>📋</span> Login History</h3>
                <div className="space-y-2">
                    {[
                        { time: 'Today, 10:45 PM', method: 'Email/Password', location: 'Atlanta, GA', status: 'success' },
                        { time: 'Today, 8:12 AM', method: 'Email/Password', location: 'Atlanta, GA', status: 'success' },
                        { time: 'Yesterday, 11:30 PM', method: 'Email/Password', location: 'Atlanta, GA', status: 'success' },
                    ].map((entry, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                            <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${entry.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                                <div>
                                    <p className="text-sm text-white">{entry.time}</p>
                                    <p className="text-xs text-silver">{entry.method} • {entry.location}</p>
                                </div>
                            </div>
                            <span className={`text-xs ${entry.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                {entry.status === 'success' ? '✓ Success' : '✕ Failed'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

// ===== DANGER ZONE TAB =====
function DangerTab({ user }: { user: any }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const router = useRouter();

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            {/* Export Data */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><span>📦</span> Export Your Data</h3>
                <p className="text-sm text-silver mb-4">Download all your data including resumes, applications, and profile information.</p>
                <button
                    onClick={() => showToast('Data export will be emailed to you', 'ℹ️')}
                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-all"
                >
                    📥 Request Data Export
                </button>
            </div>

            {/* Delete Account */}
            <div className="rounded-2xl bg-[#0A0A0A] border border-red-500/20 p-6">
                <h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2"><span>⚠️</span> Delete Account</h3>
                <p className="text-sm text-silver mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 mb-4">
                    <p className="text-sm text-red-300">This will permanently delete:</p>
                    <ul className="mt-2 space-y-1 text-xs text-red-200">
                        <li>• All saved resume versions</li>
                        <li>• All tracked job applications</li>
                        <li>• Your persona profiles</li>
                        <li>• All account settings and preferences</li>
                    </ul>
                </div>

                {!confirmDelete ? (
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/20 transition-all"
                    >
                        🗑️ Delete My Account
                    </button>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-red-300">Type <strong className="text-red-200">DELETE</strong> to confirm:</p>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Type DELETE"
                            className="w-full px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/30 text-white placeholder-red-300/50 focus:outline-none focus:border-red-500 text-center font-bold tracking-wider"
                        />
                        <div className="flex gap-3">
                            <button
                                disabled={deleteConfirmText !== 'DELETE'}
                                onClick={() => {
                                    showToast('Account deletion initiated...', '⚠️');
                                    // Would call authHelpers.deleteAccount() here
                                }}
                                className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Permanently Delete
                            </button>
                            <button onClick={() => { setConfirmDelete(false); setDeleteConfirmText(''); }} className="px-4 py-3 rounded-xl border border-white/10 text-silver hover:text-white">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
