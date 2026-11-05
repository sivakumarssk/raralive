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
import { BannersPage } from './pages/banners/BannersPage';
import { StageBackgroundsPage } from './pages/stage-backgrounds/StageBackgroundsPage';
import { BattleTargetsPage } from './pages/battle-targets/BattleTargetsPage';
import { SupportPage } from './pages/support/SupportPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { EarningSlabsPage } from './pages/earning-slabs/EarningSlabsPage';
import { UserHistoryPage } from './pages/users/UserHistoryPage';
import { UserRechargeHistoryPage } from './pages/users/UserRechargeHistoryPage';
import { RoomGiftHistoryPage } from './pages/rooms/RoomGiftHistoryPage';
import { AgencyRoomsPage } from './pages/agencies/AgencyRoomsPage';
import { AgencyCoinHistoryPage } from './pages/agencies/AgencyCoinHistoryPage';
import { FriendZoneCallsPage } from './pages/friend-zone/FriendZoneCallsPage';
import { RequestsPage } from './pages/requests/RequestsPage';
import { PostTagsPage } from './pages/post-tags/PostTagsPage';
import { AgencyWalletPage, AgencyWalletDetailPage } from './pages/agency-wallet/AgencyWalletPage';
import { AgencyPortalPage } from './pages/agency-portal/AgencyPortalPage';

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
              <Route path="/requests" element={<RequestsPage />} />
              {/* Old menu URLs → their tab in Requests */}
              <Route path="/friend-zone" element={<Navigate to="/requests?tab=friend-zone" replace />} />
              <Route path="/friend-zone/calls" element={<FriendZoneCallsPage />} />
              <Route path="/friend-zone/gifts" element={<Navigate to="/friend-zone/calls" replace />} />
              <Route path="/go-live" element={<Navigate to="/requests?tab=go-live" replace />} />
              <Route path="/agency-wallet" element={<AgencyWalletPage />} />
              <Route path="/agency-portal" element={<AgencyPortalPage />} />
              <Route path="/gifts" element={<GiftsPage />} />
              <Route path="/coin-packages" element={<CoinPackagesPage />} />
              <Route path="/shop-gifts" element={<ShopGiftsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/banners" element={<BannersPage />} />
              <Route path="/post-tags" element={<PostTagsPage />} />
              <Route path="/stage-backgrounds" element={<StageBackgroundsPage />} />
              <Route path="/battle-targets" element={<BattleTargetsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/earning-slabs" element={<EarningSlabsPage />} />
              <Route path="/users/:userId/history" element={<UserHistoryPage />} />
              <Route path="/users/:userId/recharge" element={<UserRechargeHistoryPage />} />
              <Route path="/rooms/:roomId/gifts" element={<RoomGiftHistoryPage />} />
              <Route path="/agencies/:agencyId/rooms" element={<AgencyRoomsPage />} />
              <Route path="/agencies/:agencyId/coins" element={<AgencyCoinHistoryPage />} />
              <Route path="/agencies/:agencyId/wallet" element={<AgencyWalletDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
