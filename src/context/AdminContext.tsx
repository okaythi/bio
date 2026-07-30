import React, { createContext, useContext, useEffect, useState } from 'react';

interface AdminContextType {
  isAdminAuth: boolean;
  adminError: string | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | null>(null);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/auth');
      const data = await res.json();
      
      if (res.ok && data.success) {
        setIsAdminAuth(true);
        setAdminError(null);
      } else {
        setIsAdminAuth(false);
        setAdminError(data.error || 'Access Denied: Unknown error');
      }
    } catch (err: any) {
      setIsAdminAuth(false);
      setAdminError(err.message || 'Access Denied: Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AdminContext.Provider value={{ isAdminAuth, adminError, loading, checkAuth }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
};
