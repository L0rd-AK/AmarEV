import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminService,
  DashboardAnalytics,
  SystemStats,
} from '../services/adminService';
import { chargingSimulationService, ChargingTelemetry } from '../services/chargingSimulationService';
import { LoadingSpinner } from '../components/UI/LoadingSpinner';
import { Alert } from '../components/UI/Alert';
import {
  Users,
  MapPin,
  Zap,
  DollarSign,
  TrendingUp,
  Clock,
  Star,
  AlertTriangle,
  Activity,
  BatteryCharging,
  Thermometer,
  Cpu,
  ZapOff,
  Plus,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  colorClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  trend = 'neutral',
  colorClass = 'bg-blue-500',
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <p
              className={`mt-2 text-sm font-medium ${
                trend === 'up'
                  ? 'text-green-600'
                  : trend === 'down'
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}
            >
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${colorClass} text-white`}>{icon}</div>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChargingSessions, setActiveChargingSessions] = useState<ChargingTelemetry[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  // Poll active charging sessions every 3 seconds
  useEffect(() => {
    let isMounted = true;

    const fetchActiveSessions = async () => {
      try {
        const sessions = await chargingSimulationService.getActiveChargingSessions();
        if (isMounted) {
          setActiveChargingSessions(Array.isArray(sessions) ? sessions : []);
        }
      } catch (err) {
        console.error('Error fetching active charging sessions:', err);
        // Don't clear existing sessions on error
      }
    };

    fetchActiveSessions();
    const pollInterval = setInterval(fetchActiveSessions, 3000);
    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsData, statsData] = await Promise.all([
        adminService.getDashboardAnalytics({
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        }),
        adminService.getSystemStats(),
      ]);

      setAnalytics(analyticsData);
      setSystemStats(statsData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
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
      </div>
    );
  }

  if (!analytics || !systemStats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert type="warning" message="No data available" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return `৳${amount.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
  };

  const formatDuration = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <p className="text-gray-600">
            Comprehensive overview of platform performance and analytics
          </p>
          <button
            type="button"
            onClick={() => navigate('/operator/stations/new')}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Station
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, startDate: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, endDate: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            onClick={() => setDateRange({ startDate: '', endDate: '' })}
            className="mt-6 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(systemStats.alerts.flaggedReviews > 0 ||
        systemStats.alerts.pendingReservations > 0) && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">Alerts</h3>
          </div>
          <div className="text-sm text-yellow-800">
            {systemStats.alerts.flaggedReviews > 0 && (
              <p>• {systemStats.alerts.flaggedReviews} flagged reviews need attention</p>
            )}
            {systemStats.alerts.pendingReservations > 0 && (
              <p>
                • {systemStats.alerts.pendingReservations} pending reservations
              </p>
            )}
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={analytics.overview.totalUsers.toLocaleString()}
          change={`${analytics.overview.newUsersThisMonth} new this month`}
          icon={<Users className="w-6 h-6" />}
          trend="up"
          colorClass="bg-blue-500"
        />
        <StatCard
          title="Active Stations"
          value={analytics.overview.activeStations}
          change={`${analytics.overview.totalConnectors} total connectors`}
          icon={<MapPin className="w-6 h-6" />}
          colorClass="bg-green-500"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(analytics.overview.totalRevenue)}
          icon={<DollarSign className="w-6 h-6" />}
          trend="up"
          colorClass="bg-purple-500"
        />
        <StatCard
          title="Completed Sessions"
          value={analytics.overview.completedSessions.toLocaleString()}
          change={`${analytics.overview.activeSessions} currently active`}
          icon={<Zap className="w-6 h-6" />}
          colorClass="bg-yellow-500"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Energy Delivered"
          value={`${analytics.overview.totalEnergyDelivered.toFixed(1)} kWh`}
          icon={<Activity className="w-6 h-6" />}
          colorClass="bg-teal-500"
        />
        <StatCard
          title="Avg Session Cost"
          value={formatCurrency(analytics.overview.averageSessionCost)}
          icon={<TrendingUp className="w-6 h-6" />}
          colorClass="bg-indigo-500"
        />
        <StatCard
          title="Avg Session Duration"
          value={formatDuration(analytics.overview.averageSessionDuration)}
          icon={<Clock className="w-6 h-6" />}
          colorClass="bg-orange-500"
        />
        <StatCard
          title="Average Rating"
          value={analytics.overview.averageRating.toFixed(1)}
          change={`${analytics.overview.totalReviews} reviews`}
          icon={<Star className="w-6 h-6" />}
          colorClass="bg-pink-500"
        />
      </div>

      {/* Recent Activity Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Session Activity
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 24 hours</span>
              <span className="font-semibold">{systemStats.sessions.last24h}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 7 days</span>
              <span className="font-semibold">{systemStats.sessions.last7d}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 30 days</span>
              <span className="font-semibold">{systemStats.sessions.last30d}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Revenue Growth
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 24 hours</span>
              <span className="font-semibold">
                {formatCurrency(systemStats.revenue.last24h)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 7 days</span>
              <span className="font-semibold">
                {formatCurrency(systemStats.revenue.last7d)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 30 days</span>
              <span className="font-semibold">
                {formatCurrency(systemStats.revenue.last30d)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            User Growth
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 24 hours</span>
              <span className="font-semibold">{systemStats.users.newLast24h}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 7 days</span>
              <span className="font-semibold">{systemStats.users.newLast7d}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last 30 days</span>
              <span className="font-semibold">{systemStats.users.newLast30d}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Stations */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            Top Performing Stations
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Station
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sessions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Energy (kWh)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.topStations.map((station, index) => (
                <tr key={station.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {index + 1}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {station.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {station.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {station.totalSessions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(station.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {station.totalEnergy.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live ESP32 Charging Monitor */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${activeChargingSessions.length > 0 ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Cpu className={`w-5 h-5 ${activeChargingSessions.length > 0 ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Live ESP32 Charging Monitor
                </h3>
                <p className="text-sm text-gray-500">
                  Real-time simulated ESP32 device telemetry from active charging sessions
                </p>
              </div>
            </div>
            {activeChargingSessions.length > 0 ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">
                  {activeChargingSessions.length} Active Session{activeChargingSessions.length !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">Polling every 3s</span>
              </div>
            )}
          </div>
        </div>

        {activeChargingSessions.length === 0 ? (
          <div className="p-12 text-center">
            <ZapOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-600 mb-2">No Active Charging Sessions</h4>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              When users start charging during their booking time, real-time voltage, current, and power data will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activeChargingSessions.map((session) => {
              const elapsed = session.elapsedSeconds || 0;
              const h = Math.floor(elapsed / 3600);
              const m = Math.floor((elapsed % 3600) / 60);
              const s = elapsed % 60;
              const elapsedStr = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;

              return (
                <div key={session.sessionId} className="p-6">
                  {/* Session Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-full">
                        <BatteryCharging className="w-5 h-5 text-green-600 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{session.stationName}</h4>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span>User: <span className="font-medium text-gray-700">{session.userName}</span></span>
                          <span>•</span>
                          <span>Connector: <span className="font-medium text-gray-700">{session.connectorType}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Elapsed</div>
                        <div className="text-sm font-mono font-semibold text-gray-700">{elapsedStr}</div>
                      </div>
                      <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Charging
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                      <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium mb-2">
                        <Activity className="w-3.5 h-3.5" />
                        VOLTAGE
                      </div>
                      <div className="text-2xl font-bold text-green-800">
                        {session.voltage.toFixed(1)}
                        <span className="text-sm font-normal text-green-600 ml-1">V</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium mb-2">
                        <Zap className="w-3.5 h-3.5" />
                        CURRENT
                      </div>
                      <div className="text-2xl font-bold text-blue-800">
                        {session.current.toFixed(2)}
                        <span className="text-sm font-normal text-blue-600 ml-1">A</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
                      <div className="flex items-center gap-1.5 text-xs text-yellow-600 font-medium mb-2">
                        <BatteryCharging className="w-3.5 h-3.5" />
                        POWER
                      </div>
                      <div className="text-2xl font-bold text-yellow-800">
                        {(session.power / 1000).toFixed(2)}
                        <span className="text-sm font-normal text-yellow-600 ml-1">kW</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-200">
                      <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium mb-2">
                        <TrendingUp className="w-3.5 h-3.5" />
                        ENERGY
                      </div>
                      <div className="text-2xl font-bold text-purple-800">
                        {session.energyKWh.toFixed(3)}
                        <span className="text-sm font-normal text-purple-600 ml-1">kWh</span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border border-red-200">
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium mb-2">
                        <Thermometer className="w-3.5 h-3.5" />
                        TEMP
                      </div>
                      <div className="text-2xl font-bold text-red-700">
                        {session.temperature.toFixed(1)}
                        <span className="text-sm font-normal text-red-500 ml-1">°C</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Users */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Recent Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.recentUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.displayName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : user.status === 'SUSPENDED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
