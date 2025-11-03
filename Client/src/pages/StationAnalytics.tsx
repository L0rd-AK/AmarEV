import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, LoadingSpinner } from '@/components/UI';
import { stationService, StationAnalytics as AnalyticsData } from '@/services/stationService';
import { 
  TrendingUp, Zap, DollarSign, Activity, 
  Calendar, BarChart3 
} from 'lucide-react';

export const StationAnalytics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [id, period, dateRange]);

  const fetchAnalytics = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await stationService.getStationAnalytics(
        id,
        dateRange.start,
        dateRange.end,
        period
      );

      if (response.success && response.data) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
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

  if (!analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-600">No analytics data available</div>
      </div>
    );
  }

  const { overview, connectorStats, timeSeries } = analytics;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Station Analytics</h1>

          {/* Date Range and Period Selector */}
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
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
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'day' | 'month')}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="day">Daily</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {overview.totalSessions}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  {overview.completedSessions} completed
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  ৳{overview.totalRevenue.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Avg: ৳{overview.avgSessionCost.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Energy Delivered</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {overview.totalEnergy.toFixed(1)} kWh
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Avg: {overview.avgEnergyDelivered.toFixed(2)} kWh
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Connector Performance */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Connector Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectorStats.map((connector, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">
                    {connector.type} - {connector.standard}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      connector.status === 'available'
                        ? 'bg-green-100 text-green-800'
                        : connector.status === 'occupied'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {connector.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sessions:</span>
                    <span className="font-semibold">{connector.sessionsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Energy:</span>
                    <span className="font-semibold">
                      {connector.totalEnergy.toFixed(1)} kWh
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Time Series Chart */}
        {timeSeries && timeSeries.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Trends Over Time
            </h2>
            <div className="space-y-4">
              {timeSeries.map((data, idx) => (
                <div key={idx} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Period {idx + 1}
                    </span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600">
                        Sessions: <strong>{data.sessions}</strong>
                      </span>
                      <span className="text-gray-600">
                        Revenue: <strong>৳{data.revenue.toFixed(2)}</strong>
                      </span>
                      <span className="text-gray-600">
                        Energy: <strong>{data.energy.toFixed(1)} kWh</strong>
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (data.revenue / Math.max(...timeSeries.map((d) => d.revenue))) *
                            100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StationAnalytics;
