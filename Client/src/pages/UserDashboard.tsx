import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  History,
  Zap,
  DollarSign,
  MapPin,
  Calendar,
  TrendingUp,
  Car,
  Clock,
} from 'lucide-react';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Alert } from '../components/UI/Alert';
import paymentService from '../services/paymentService';
import axios from 'axios';
import { config } from '../config';
import { Link } from 'react-router-dom';

interface UserStats {
  totalSessions: number;
  completedSessions: number;
  activeSessions: number;
  totalEnergyUsed: number;
  totalSpent: number;
  totalReservations: number;
  favoriteStations: Array<{
    _id: string;
    name: string;
    visitCount: number;
    totalSpent: number;
  }>;
  recentActivity: Array<{
    type: 'session' | 'reservation' | 'payment';
    title: string;
    description: string;
    date: Date;
    amount?: number;
  }>;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  colorClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subtitle,
  colorClass = 'bg-blue-500',
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full ${colorClass} text-white`}>{icon}</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export const UserDashboard: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch data in parallel with error handling
      const [sessionsRes, reservationsRes, paymentStatsRes] = await Promise.allSettled([
        axios.get(`${config.apiBaseUrl}/sessions`, { headers }).catch(() => ({ data: { data: [] } })),
        axios.get(`${config.apiBaseUrl}/reservations`, { headers }).catch(() => ({ data: { reservations: [] } })),
        paymentService.getPaymentStats().catch(() => ({ totalSpent: 0, totalTransactions: 0 })),
      ]);

      const sessions = sessionsRes.status === 'fulfilled' 
        ? (sessionsRes.value.data?.data || sessionsRes.value.data?.sessions || sessionsRes.value.data || [])
        : [];
      const reservations = reservationsRes.status === 'fulfilled'
        ? (reservationsRes.value.data?.reservations || reservationsRes.value.data?.data || reservationsRes.value.data || [])
        : [];
      const paymentStats = paymentStatsRes.status === 'fulfilled'
        ? paymentStatsRes.value
        : { totalSpent: 0, totalTransactions: 0 };

      // Calculate stats
      const completedSessions = sessions.filter(
        (s: any) => s.status === 'COMPLETED'
      );
      const activeSessions = sessions.filter((s: any) => s.status === 'ACTIVE');

      // Calculate total energy
      const totalEnergy = completedSessions.reduce(
        (sum: number, s: any) => sum + (s.totalEnergyKWh || 0),
        0
      );

      // Find favorite stations
      const stationVisits: Record<
        string,
        { name: string; count: number; spent: number }
      > = {};
      completedSessions.forEach((s: any) => {
        const stationId = s.stationId?._id || s.stationId;
        const stationName = s.stationId?.name || 'Unknown Station';
        if (!stationVisits[stationId]) {
          stationVisits[stationId] = { name: stationName, count: 0, spent: 0 };
        }
        stationVisits[stationId].count++;
        stationVisits[stationId].spent += s.totalCostBDT || 0;
      });

      const favoriteStations = Object.entries(stationVisits)
        .map(([id, data]) => ({
          _id: id,
          name: data.name,
          visitCount: data.count,
          totalSpent: data.spent,
        }))
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 3);

      // Build recent activity timeline
      const recentActivity: any[] = [];

      // Add recent sessions
      completedSessions.slice(0, 5).forEach((s: any) => {
        recentActivity.push({
          type: 'session',
          title: 'Charging Session Completed',
          description: `${s.totalEnergyKWh?.toFixed(1)} kWh at ${
            s.stationId?.name || 'Unknown Station'
          }`,
          date: new Date(s.endTime || s.createdAt),
          amount: s.totalCostBDT,
        });
      });

      // Add recent reservations
      reservations.slice(0, 3).forEach((r: any) => {
        recentActivity.push({
          type: 'reservation',
          title: 'Reservation Created',
          description: `${r.stationId?.name || 'Unknown Station'} - ${
            r.connectorType
          }`,
          date: new Date(r.createdAt),
        });
      });

      // Sort by date
      recentActivity.sort((a, b) => b.date.getTime() - a.date.getTime());

      setStats({
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        activeSessions: activeSessions.length,
        totalEnergyUsed: totalEnergy,
        totalSpent: paymentStats.totalSpent || 0,
        totalReservations: reservations.length,
        favoriteStations,
        recentActivity: recentActivity.slice(0, 10),
      });
    } catch (err) {
      console.error('Error fetching user stats:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert type="error" message={error} />
        <button
          onClick={fetchUserStats}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert type="warning" message="No data available" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'session':
        return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'reservation':
        return <Calendar className="w-5 h-5 text-blue-500" />;
      case 'payment':
        return <DollarSign className="w-5 h-5 text-green-500" />;
      default:
        return <History className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name || user?.email}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's your charging activity overview
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Zap className="w-6 h-6" />}
          label="Total Sessions"
          value={stats.totalSessions}
          subtitle={`${stats.activeSessions} active now`}
          colorClass="bg-yellow-500"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Energy Used"
          value={`${stats.totalEnergyUsed.toFixed(1)} kWh`}
          subtitle="Total energy consumed"
          colorClass="bg-green-500"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          label="Total Spent"
          value={formatCurrency(stats.totalSpent)}
          subtitle="All time"
          colorClass="bg-purple-500"
        />
        <StatCard
          icon={<Calendar className="w-6 h-6" />}
          label="Reservations"
          value={stats.totalReservations}
          subtitle="Total bookings"
          colorClass="bg-blue-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            to="/stations"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <MapPin className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">Find Stations</p>
              <p className="text-sm text-gray-500">Locate nearby chargers</p>
            </div>
          </Link>
          <Link
            to="/my-vehicles"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <Car className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-gray-900">My Vehicles</p>
              <p className="text-sm text-gray-500">Manage your EVs</p>
            </div>
          </Link>
          <Link
            to="/my-reservations"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <Calendar className="w-5 h-5 text-orange-600" />
            <div>
              <p className="font-medium text-gray-900">My Reservations</p>
              <p className="text-sm text-gray-500">View bookings</p>
            </div>
          </Link>
          <Link
            to="/transactions"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <History className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium text-gray-900">Transactions</p>
              <p className="text-sm text-gray-500">Payment history</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                Recent Activity
              </h3>
            </div>
            <div className="p-6">
              {stats.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">
                          {activity.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <p className="text-xs text-gray-500">
                            {new Date(activity.date).toLocaleDateString()} at{' '}
                            {new Date(activity.date).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {activity.amount && (
                        <div className="flex-shrink-0">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(activity.amount)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    Welcome to AmarEV!
                  </h4>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Start your electric journey by finding charging stations near you and booking your first session.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/my-vehicles">
                      <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition">
                        Add Your First Vehicle
                      </button>
                    </Link>
                    <Link to="/stations">
                      <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition">
                        Find Charging Stations
                      </button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Favorite Stations */}
        <div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                Favorite Stations
              </h3>
            </div>
            <div className="p-6">
              {stats.favoriteStations.length > 0 ? (
                <div className="space-y-4">
                  {stats.favoriteStations.map((station) => (
                    <div key={station._id} className="pb-4 border-b border-gray-100 last:border-0">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {station.name}
                      </h4>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>Visits: {station.visitCount}</p>
                        <p>Total spent: {formatCurrency(station.totalSpent)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No favorite stations yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Start charging to see your favorites
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
