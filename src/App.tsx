import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Watch from './pages/Watch';

import { AdminProvider } from './context/AdminContext';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import VipManagement from './pages/admin/VipManagement';
import UserManagement from './pages/admin/UserManagement';
import TelemetryReplay from './pages/admin/TelemetryReplay';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 60,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/watch/:id" element={<Watch />} />
          
          <Route path="/d/a" element={<AdminProvider><AdminLayout /></AdminProvider>}>
            <Route index element={<Dashboard />} />
            <Route path="vip" element={<VipManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="telemetry" element={<TelemetryReplay />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

