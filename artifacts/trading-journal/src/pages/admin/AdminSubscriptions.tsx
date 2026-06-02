import { useEffect, useState, useCallback } from "react";
import { useAdminStore } from "@/store/adminStore";
import { CheckCircle, XCircle, RefreshCw, Eye, EyeOff, X } from "lucide-react";

interface Payment {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  plan: string;
  amount: string;
  txHash: string | null;
  screenshotPath: string | null;
  status: string;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

type Filter = "all" | "pending" | "verified" | "rejected";

export default function AdminSubscriptions() {
  const { token } = useAdminStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/payments?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setPayments(d.payments ?? []);
    } catch {
      setMsg({ text: "Failed to load payments", ok: false });
    } finally {
      setLoading(false);
    }
  }, [filter, token]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Auto-clear message after 4s
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  async function approve(p: Payment) {
    if (!confirm(`Approve this payment and activate ${p.plan.replace(/_/g, " ").toUpperCase()} for ${p.userName}?`)) return;
    setActionId(p.id);
    try {
      const res = await fetch(`/api/admin/approve-payment/${p.id}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setMsg({ text: `✓ Subscription activated for ${p.userName} (${d.user?.plan ?? p.plan})`, ok: true });
        fetchPayments();
      } else {
        setMsg({ text: `Error: ${d.error ?? "Unknown error"}`, ok: false });
      }
    } catch {
      setMsg({ text: "Network error — approval failed", ok: false });
    } finally {
      setActionId(null);
    }
  }

  async function reject(p: Payment) {
    if (!confirm(`Reject payment from ${p.userName}?`)) return;
    setActionId(p.id);
    try {
      const res = await fetch(`/api/admin/payments/${p.id}/reject`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setMsg({ text: `Payment #${p.id} from ${p.userName} rejected`, ok: true });
        fetchPayments();
      } else {
        setMsg({ text: `Error: ${d.error ?? "Unknown error"}`, ok: false });
      }
    } catch {
      setMsg({ text: "Network error — rejection failed", ok: false });
    } finally {
      setActionId(null);
    }
  }

  const filters: Filter[] = ["all", "pending", "verified", "rejected"];
  const pending = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Subscription Requests</h1>
          <p className="text-gray-400 text-sm mt-1">
            {payments.length} {filter} request{payments.length !== 1 ? "s" : ""}
            {filter !== "pending" && pending > 0 && (
              <span className="ml-2 text-yellow-400 font-medium">({pending} pending action)</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchPayments}
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

      {/* Filter tabs */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-white/5 text-gray-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Payment cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-[#13131a] border border-white/5 rounded-xl p-12 text-center">
          <div className="text-gray-500 text-sm">No {filter} subscription requests</div>
          {filter === "pending" && (
            <p className="text-gray-600 text-xs mt-2">New requests will appear here when users submit payment screenshots</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => (
            <div key={p.id} className="bg-[#13131a] border border-white/5 rounded-xl p-5">
              {/* Card header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-white font-medium">{p.userName || "Unknown User"}</div>
                  <div className="text-gray-400 text-sm">{p.userEmail || "—"}</div>
                  <div className="text-gray-500 text-xs mt-1">
                    Submitted: {new Date(p.createdAt).toLocaleString()}
                    {p.verifiedAt && (
                      <span className="ml-2">· Processed: {new Date(p.verifiedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    p.status === "verified" ? "bg-green-500/20 text-green-400" :
                    p.status === "rejected" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>{p.status}</span>
                  <span className="text-xs text-gray-600">#{p.id}</span>
                </div>
              </div>

              {/* Payment details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Plan</div>
                  <div className="text-sm text-white font-medium">{p.plan.replace(/_/g, " ").toUpperCase()}</div>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Amount</div>
                  <div className="text-sm text-white font-medium">{p.amount} USDT</div>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">User ID</div>
                  <div className="text-sm text-white font-medium">#{p.userId}</div>
                </div>
                {p.txHash && (
                  <div className="bg-[#0a0a0f] rounded-lg p-3 col-span-2 sm:col-span-3">
                    <div className="text-xs text-gray-500 mb-1">TX Hash</div>
                    <div className="text-xs text-gray-300 font-mono break-all">{p.txHash}</div>
                  </div>
                )}
              </div>

              {/* Screenshot viewer */}
              {p.screenshotPath ? (
                <div className="mb-4">
                  <button
                    onClick={() => setPreview(preview === p.screenshotPath ? null : p.screenshotPath)}
                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {preview === p.screenshotPath ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {preview === p.screenshotPath ? "Hide" : "View"} Payment Screenshot
                  </button>
                  {preview === p.screenshotPath && (
                    <div className="mt-3 relative">
                      <img
                        src={`/api/payment/screenshot/${p.screenshotPath}`}
                        alt="Payment proof"
                        className="max-w-sm rounded-lg border border-white/10 cursor-zoom-in"
                        onClick={() => setPreview(`lightbox:${p.screenshotPath}`)}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-4 text-xs text-gray-600 italic">No screenshot uploaded</div>
              )}

              {/* Action buttons — only for pending */}
              {p.status === "pending" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => approve(p)}
                    disabled={actionId === p.id}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    {actionId === p.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    Approve & Activate
                  </button>
                  <button
                    onClick={() => reject(p)}
                    disabled={actionId === p.id}
                    className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-60 text-red-400 text-xs font-semibold px-4 py-2 rounded-lg transition-colors border border-red-500/30"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox for full-size screenshot */}
      {preview?.startsWith("lightbox:") && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-3 -right-3 w-7 h-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-10"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <img
              src={`/api/payment/screenshot/${preview.replace("lightbox:", "")}`}
              alt="Payment screenshot"
              className="max-w-3xl max-h-[90vh] rounded-xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
