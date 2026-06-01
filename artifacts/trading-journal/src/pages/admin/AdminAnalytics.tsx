import { useEffect, useState } from "react";
import { useAdminStore } from "@/store/adminStore";

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  pendingPayments: number;
  approvedPayments: number;
  rejectedPayments: number;
}

export default function AdminAnalytics() {
  const { token } = useAdminStore();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats);
  }, [token]);

  if (!stats) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;

  const total = stats.approvedPayments + stats.rejectedPayments + stats.pendingPayments;
  const approvalRate = total > 0 ? Math.round((stats.approvedPayments / total) * 100) : 0;
  const premiumRate = stats.totalUsers > 0 ? Math.round((stats.premiumUsers / stats.totalUsers) * 100) : 0;

  const bars = [
    { label: "Approved", value: stats.approvedPayments, max: total || 1, color: "bg-green-500" },
    { label: "Pending", value: stats.pendingPayments, max: total || 1, color: "bg-yellow-500" },
    { label: "Rejected", value: stats.rejectedPayments, max: total || 1, color: "bg-red-500" },
    { label: "Premium", value: stats.premiumUsers, max: stats.totalUsers || 1, color: "bg-blue-500" },
    { label: "Free/Silver", value: stats.totalUsers - stats.premiumUsers, max: stats.totalUsers || 1, color: "bg-gray-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">Platform performance overview</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#13131a] border border-white/5 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-2">Payment Approval Rate</div>
          <div className="text-3xl font-bold text-white">{approvalRate}%</div>
          <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${approvalRate}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-2">{stats.approvedPayments} of {total} payments approved</div>
        </div>

        <div className="bg-[#13131a] border border-white/5 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-2">Premium Conversion Rate</div>
          <div className="text-3xl font-bold text-white">{premiumRate}%</div>
          <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${premiumRate}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-2">{stats.premiumUsers} of {stats.totalUsers} users are premium</div>
        </div>
      </div>

      <div className="bg-[#13131a] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-5">Distribution Overview</h2>
        <div className="space-y-4">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>{b.label}</span>
                <span>{b.value}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${b.color}`}
                  style={{ width: `${(b.value / b.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#13131a] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Summary</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            <div className="text-xs text-gray-400 mt-1">Total Users</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{stats.approvedPayments}</div>
            <div className="text-xs text-gray-400 mt-1">Approved</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">{stats.pendingPayments}</div>
            <div className="text-xs text-gray-400 mt-1">Pending</div>
          </div>
        </div>
      </div>
    </div>
  );
}
