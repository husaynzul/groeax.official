import { useEffect, useState } from "react";
import { useAdminStore } from "@/store/adminStore";
import { Search, UserX, RefreshCw, ChevronDown } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  plan: string;
  planExpiresAt: string | null;
  createdAt: string;
}

const PLAN_OPTIONS = ["silver", "platinum", "premium", "suspended"];

export default function AdminUsers() {
  const { token } = useAdminStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const fetchUsers = () => {
    setLoading(true);
    fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [token]);

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  async function changePlan(userId: number, plan: string) {
    setActionUserId(userId);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg(`✓ Plan updated for user #${userId}`);
      fetchUsers();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setActionUserId(null);
    }
  }

  async function suspendUser(userId: number) {
    if (!confirm("Suspend this user? They will lose all premium access.")) return;
    await changePlan(userId, "suspended");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-gray-400 text-sm mt-1">{users.length} total users</p>
        </div>
        <button onClick={fetchUsers} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-3 rounded-lg border ${msg.startsWith("Error") ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green-500/10 border-green-500/30 text-green-400"}`}>
          {msg}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full bg-[#13131a] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="bg-[#13131a] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">User</th>
              <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">Plan</th>
              <th className="text-left text-xs text-gray-400 font-medium px-5 py-3">Joined</th>
              <th className="text-right text-xs text-gray-400 font-medium px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-500 text-sm">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-500 text-sm">No users found</td></tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                  <td className="px-5 py-3">
                    <div className="text-sm text-white font-medium">{u.name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.plan === "premium" ? "bg-purple-500/20 text-purple-400" :
                      u.plan === "platinum" ? "bg-blue-500/20 text-blue-400" :
                      u.plan === "suspended" ? "bg-red-500/20 text-red-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>{u.plan}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="relative group">
                        <select
                          defaultValue={u.plan}
                          onChange={(e) => changePlan(u.id, e.target.value)}
                          disabled={actionUserId === u.id}
                          className="bg-[#1a1a2e] border border-white/10 text-white text-xs rounded px-2 py-1 focus:outline-none cursor-pointer appearance-none pr-6"
                        >
                          {PLAN_OPTIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                      </div>
                      <button
                        onClick={() => suspendUser(u.id)}
                        className="p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 rounded transition-colors"
                        title="Suspend User"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
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
