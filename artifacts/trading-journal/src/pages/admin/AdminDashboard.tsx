import { useEffect, useState } from "react";
import { useAdminStore } from "@/store/adminStore";
import { Users, CreditCard, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react";

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  pendingPayments: number;
  approvedPayments: number;
  rejectedPayments: number;
  recentUsers: Array<{ id: number; name: string; email: string; plan: string; createdAt: string }>;
  recentPayments: Array<{ id: number; userName: string; plan: string; amount: string; status: string; createdAt: string }>;
}

export default function AdminDashboard() {
  const { token } = useAdminStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "blue" },
    { label: "Premium Users", value: stats?.premiumUsers ?? 0, icon: TrendingUp, color: "green" },
    { label: "Pending Requests", value: stats?.pendingPayments ?? 0, icon: Clock, color: "yellow" },
    { label: "Approved", value: stats?.approvedPayments ?? 0, icon: CheckCircle, color: "green" },
    { label: "Rejected", value: stats?.rejectedPayments ?? 0, icon: XCircle, color: "red" },
    { label: "Total Payments", value: (stats?.approvedPayments ?? 0) + (stats?.rejectedPayments ?? 0) + (stats?.pendingPayments ?? 0), icon: CreditCard, color: "purple" },
  ];

  const colorMap: Record<string, string> = {
    blue: "text-blue-400 bg-blue-400/10",
    green: "text-green-400 bg-green-400/10",
    yellow: "text-yellow-400 bg-yellow-400/10",
    red: "text-red-400 bg-red-400/10",
    purple: "text-purple-400 bg-purple-400/10",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-gray-400 text-sm mt-1">System statistics and recent activity</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-[#13131a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[card.color]}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="bg-[#13131a] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Recent Payment Requests</h2>
          {!stats?.recentPayments?.length ? (
            <p className="text-gray-500 text-sm">No payment requests yet</p>
          ) : (
            <div className="space-y-3">
              {stats.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{p.userName}</div>
                    <div className="text-xs text-gray-400">{p.plan.replace(/_/g, " ")} · {p.amount} USDT</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.status === "verified" ? "bg-green-500/20 text-green-400" :
                    p.status === "rejected" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Users */}
        <div className="bg-[#13131a] border border-white/5 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Recent Users</h2>
          {!stats?.recentUsers?.length ? (
            <p className="text-gray-500 text-sm">No users yet</p>
          ) : (
            <div className="space-y-3">
              {stats.recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.plan === "premium" ? "bg-purple-500/20 text-purple-400" :
                    u.plan === "platinum" ? "bg-blue-500/20 text-blue-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>{u.plan}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
