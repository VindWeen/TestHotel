// src/pages/LoginPage.jsx
// Mục đích hiện tại: TEST bước 1 (axios, stores)
// → Sẽ được làm lại UI đẹp hơn sau

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/authApi';
import { useAdminAuthStore } from '../store/adminAuthStore';

export default function LoginPage() {
    const navigate = useNavigate();
    const setAuth = useAdminAuthStore((s) => s.setAuth);

    const [email, setEmail] = useState('admin@hotel.com');
    const [password, setPassword] = useState('Admin@123');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await login(email, password);
            const data = res.data;

            // Lưu vào store + localStorage
            setAuth({
                token: data.token,
                permissions: data.permissions,
                user: {
                    id: data.userId,
                    fullName: data.fullName,
                    email: data.email,
                    role: data.role,
                    avatarUrl: data.avatarUrl,
                },
            });

            // ── DEBUG: mở console xem store và localStorage ──────────────────────
            console.log('✅ Login OK');
            console.log('token:', data.token);
            console.log('role:', data.role);
            console.log('permissions:', data.permissions);
            console.log('localStorage token:', localStorage.getItem('token'));
            // ─────────────────────────────────────────────────────────────────────

            navigate('/admin/dashboard');
        } catch (err) {
            const msg =
                err.response?.data?.message ||
                'Đăng nhập thất bại. Kiểm tra lại email/mật khẩu.';
            setError(msg);
            console.error('❌ Login Error:', err.response?.data);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.wrapper}>
            <div style={styles.card}>
                <h2 style={styles.title}>Hotel ERP — Đăng nhập</h2>
                <p style={styles.hint}>
                    Test account: <code>admin@hotel.com</code> / <code>Admin@123</code>
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.label}>Email</label>
                    <input
                        style={styles.input}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <label style={styles.label}>Mật khẩu</label>
                    <input
                        style={styles.input}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {error && <p style={styles.error}>{error}</p>}

                    <button style={styles.btn} type="submit" disabled={loading}>
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        fontFamily: 'sans-serif',
    },
    card: {
        background: '#fff',
        borderRadius: 8,
        padding: '40px 36px',
        width: 380,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    },
    title: {
        margin: '0 0 8px',
        fontSize: 22,
        fontWeight: 700,
        color: '#1a1a2e',
    },
    hint: {
        margin: '0 0 24px',
        fontSize: 13,
        color: '#888',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: 600,
        color: '#444',
        marginTop: 8,
    },
    input: {
        padding: '10px 12px',
        border: '1.5px solid #d9d9d9',
        borderRadius: 6,
        fontSize: 14,
        outline: 'none',
    },
    error: {
        color: '#e53935',
        fontSize: 13,
        margin: '4px 0',
    },
    btn: {
        marginTop: 16,
        padding: '11px',
        background: '#0ea5e9',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        fontSize: 15,
        fontWeight: 600,
        cursor: 'pointer',
    },
};