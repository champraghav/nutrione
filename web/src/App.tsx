import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAppStore } from '@store/app.store';
import { Layout } from '@components/Layout';
import { LoginPage } from '@pages/LoginPage';
import { SignupPage } from '@pages/SignupPage';
import { DashboardPage } from '@pages/DashboardPage';
import { NutritionPage } from '@pages/NutritionPage';
import { FitnessPage } from '@pages/FitnessPage';
import { SleepPage } from '@pages/SleepPage';
import { ChatPage } from '@pages/ChatPage';
import { ProfilePage } from '@pages/ProfilePage';

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const user = useAppStore((state) => state.user);
  const authLoading = useAppStore((state) => state.authLoading);
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const fetchUser = useAppStore((state) => state.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/fitness" element={<FitnessPage />} />
          <Route path="/sleep" element={<SleepPage />} />
          <Route path="/coach" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
