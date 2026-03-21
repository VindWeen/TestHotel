// Khai báo toàn bộ nested routes
// src/routes/AdminRoutes.jsx
// Minimal version để test — sẽ bổ sung ProtectedRoute, RequirePermission sau
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/admin/dashboard/DashboardPage';

export default function AdminRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            {/* Mặc định redirect về login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}