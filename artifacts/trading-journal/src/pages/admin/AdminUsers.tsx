import { useEffect, useState, useCallback } from "react";
import { useAdminStore } from "@/store/adminStore";
import { Search, UserX, RefreshCw, ChevronDown, CheckCircle, X, Clock } from "lucide-react";

interface PendingPayment {
  id: number;
  plan: string;
  amount: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  plan: string;
  planExpiresAt: string | null;
  createdAt: string;
  pendingPayment: PendingPayment | null;
}

const PLAN_OPTIONS = ["silver", "platinum", "premium", "suspended"];

const planColors: Record<string, string> = {
  premium: "bg-purple-500/20 text-purple-400",
  platinum: "bg-blue-500/20 text-blue-400",
  suspended: "bg-red-500/20 text-red-400",
  silver: "bg-gray-500/20 text-gray-400",
  free: "bg-gray-500/20 text-gray-400",
};

export default function AdminUsers() {
  const { token } = useAdminStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setUsers(d.users ?? []);
    } catch {
      setMsg({ text: "Failed to load users", ok: false });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Auto-clear message
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  async function changePlan(userId: number, plan: string) {
    setActionUserId(userId);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ plan }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg({ text: `✓ Plan set to ${plan} for user #${userId}`, ok: true });
      fetchUsers();
    } catch (err: any) {
      setMsg({ text: `Error: ${err.message}`, ok: false });
    } finally {
      setActionUserId(null);
    }
  }

  async function suspendUser(userId: number, name: string) {
    if (!confirm(`Suspend ${name}? They will lose all premium access.`)) return;
    await changePlan(userId, "suspended");
  }

  async function approveSubscription(userId: number, paymentId: number, userName: string, plan: string) {
    if (!confirm(`Approve ${plan.replace(/_/g, " ").toUpperCase()} subscription for ${userName}?`)) return;
    setActionUserId(userId);
    try {
      const res = await fetch(`/api/admin/approve-payment/${paymentId}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setMsg({ text: `✓ Subscription activated for ${userName} (${d.user?.plan ?? plan})`, ok: true });
        fetchUsers();
      } else {
        setMsg({ text: `Error: ${d.error ?? "Unknown error"}`, ok: false });
      }
    } catch {
      setMsg({ text: "Network error — approval failed", ok: false });
    } finally {
      setActionUserId(null);
    }
  }

  const pendingCount = users.filter((u) => u.pendingPayment).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-gray-400 text-sm mt-1">
            {users.length} total users
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-yellow-400">
                <Clock className="w-3 h-3" />
                {pendingCount} pending subscription{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Status message */}
      {msg && (
        <div className={`flex items-center justify-between text-sm px-4 py-3 rounded-lg border ${
          msg.ok
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full bg-[#13131a] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Users table */}
      <div className="bg-[#13131a] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">User</th>
              <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">Plan</th>
              <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">Pending Request</th>
              <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">Joined</th>
              <th className="text-right text-xs text-gray-400 font-medium px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500 text-sm">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500 text-sm">No users found</td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  {/* User info */}
                  <td className="px-5 py-3.5">
                    <div className="text-sm text-white font-medium">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                    <div className="text-xs text-gray-600">#{u.id}</div>
                  </td>

                  {/* Current plan */}
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[u.plan] ?? planColors.silver}`}>
                      {u.plan}
                    </span>
                    {u.planExpiresAt && (
                      <div className="text-xs text-gray-600 mt-1">
                        Expires {new Date(u.planExpiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>

                  {/* Pending subscription request */}
                  <td className="px-5 py-3.5">
                    {u.pendingPayment ? (
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-xs text-yellow-400 font-medium">
                            {u.pendingPayment.plan.replace(/_/g, " ").toUpperCase()}
                          </div>
                          <div className="text-xs text-gray-500">{u.pendingPayment.amount} USDT</div>
                        </div>
                        <button
                          onClick={() => approveSubscription(u.id, u.pendingPayment!.id, u.name, u.pendingPayment!.plan)}
                          disabled={actionUserId === u.id}
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {actionUserId === u.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>

                  {/* Join date */}
                  <td className="px-5 py-3.5 text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {/* Plan change dropdown */}
                      <div className="relative">
                        <select
                          value={u.plan}
                          onChange={(e) => changePlan(u.id, e.target.value)}
                          disabled={actionUserId === u.id}
                          className="bg-[#1a1a2e] border border-white/10 text-white text-xs rounded px-2 py-1 focus:outline-none cursor-pointer appearance-none pr-6 disabled:opacity-60"
                        >
                          {PLAN_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                      </div>

                      {/* Suspend button */}
                      {u.plan !== "suspended" && (
                        <button
                          onClick={() => suspendUser(u.id, u.name)}
                          disabled={actionUserId === u.id}
                          className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded transition-colors disabled:opacity-60"
                          title="Suspend User"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
