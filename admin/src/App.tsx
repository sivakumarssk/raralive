import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { UsersPage } from './pages/users/UsersPage';
import { RoomsPage } from './pages/rooms/RoomsPage';
import { AgenciesPage } from './pages/agencies/AgenciesPage';
import { GiftsPage } from './pages/gifts/GiftsPage';
import { CoinPackagesPage } from './pages/coin-packages/CoinPackagesPage';
import { ShopGiftsPage } from './pages/shop-gifts/ShopGiftsPage';
import { TasksPage } from './pages/tasks/TasksPage';
import { UserHistoryPage } from './pages/users/UserHistoryPage';
import { UserRechargeHistoryPage } from './pages/users/UserRechargeHistoryPage';
import { RoomGiftHistoryPage } from './pages/rooms/RoomGiftHistoryPage';
import { AgencyRoomsPage } from './pages/agencies/AgencyRoomsPage';
import { AgencyCoinHistoryPage } from './pages/agencies/AgencyCoinHistoryPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/agencies" element={<AgenciesPage />} />
              <Route path="/gifts" element={<GiftsPage />} />
              <Route path="/coin-packages" element={<CoinPackagesPage />} />
              <Route path="/shop-gifts" element={<ShopGiftsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/users/:userId/history" element={<UserHistoryPage />} />
              <Route path="/users/:userId/recharge" element={<UserRechargeHistoryPage />} />
              <Route path="/rooms/:roomId/gifts" element={<RoomGiftHistoryPage />} />
              <Route path="/agencies/:agencyId/rooms" element={<AgencyRoomsPage />} />
              <Route path="/agencies/:agencyId/coins" element={<AgencyCoinHistoryPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
