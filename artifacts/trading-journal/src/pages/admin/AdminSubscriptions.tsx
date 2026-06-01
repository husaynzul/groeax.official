import { useEffect, useState } from "react";
import { useAdminStore } from "@/store/adminStore";
import { CheckCircle, XCircle, RefreshCw, Eye } from "lucide-react";

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
  createdAt: string;
}

type Filter = "all" | "pending" | "verified" | "rejected";

export default function AdminSubscriptions() {
  const { token } = useAdminStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const fetchPayments = () => {
    setLoading(true);
    fetch(`/api/admin/payments?status=${filter}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayments(); }, [filter, token]);

  async function approve(id: number) {
    if (!confirm("Approve this payment and activate the user subscription?")) return;
    const res = await fetch(`/api/admin/approve-payment/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminToken: token }),
    });
    const d = await res.json();
    if (d.success) {
      setMsg(`✓ Payment #${id} approved`);
      fetchPayments();
    } else {
      setMsg(`Error: ${d.error}`);
    }
  }

  async function reject(id: number) {
    if (!confirm("Reject this payment?")) return;
    const res = await fetch(`/api/admin/payments/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    if (d.success) {
      setMsg(`Payment #${id} rejected`);
      fetchPayments();
    } else {
      setMsg(`Error: ${d.error}`);
    }
  }

  const filters: Filter[] = ["all", "pending", "verified", "rejected"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Subscription Requests</h1>
          <p className="text-gray-400 text-sm mt-1">{payments.length} {filter} requests</p>
        </div>
        <button onClick={fetchPayments} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-3 rounded-lg border ${msg.startsWith("Error") ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green-500/10 border-green-500/30 text-green-400"}`}>
          {msg}
        </div>
      )}

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
          >{f}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : payments.length === 0 ? (
        <div className="bg-[#13131a] border border-white/5 rounded-xl p-12 text-center text-gray-500 text-sm">
          No {filter} subscription requests
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => (
            <div key={p.id} className="bg-[#13131a] border border-white/5 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-white font-medium">{p.userName}</div>
                  <div className="text-gray-400 text-sm">{p.userEmail}</div>
                  <div className="text-gray-500 text-xs mt-1">{new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  p.status === "verified" ? "bg-green-500/20 text-green-400" :
                  p.status === "rejected" ? "bg-red-500/20 text-red-400" :
                  "bg-yellow-500/20 text-yellow-400"
                }`}>{p.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Plan</div>
                  <div className="text-sm text-white font-medium">{p.plan.replace(/_/g, " ").toUpperCase()}</div>
                </div>
                <div className="bg-[#0a0a0f] rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Amount</div>
                  <div className="text-sm text-white font-medium">{p.amount} USDT</div>
                </div>
                {p.txHash && (
                  <div className="bg-[#0a0a0f] rounded-lg p-3 col-span-2">
                    <div className="text-xs text-gray-500 mb-1">TX Hash</div>
                    <div className="text-xs text-gray-300 font-mono break-all">{p.txHash}</div>
                  </div>
                )}
              </div>

              {p.screenshotPath && (
                <div className="mb-4">
                  <button
                    onClick={() => setPreview(preview === p.screenshotPath ? null : p.screenshotPath)}
                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {preview === p.screenshotPath ? "Hide" : "View"} Screenshot
                  </button>
                  {preview === p.screenshotPath && (
                    <img
                      src={`/api/payment/screenshot/${p.screenshotPath}`}
                      alt="Payment proof"
                      className="mt-3 max-w-sm rounded-lg border border-white/10"
                    />
                  )}
                </div>
              )}

              {p.status === "pending" && (
                <div className="flex gap-3">
                  <button
                    onClick={() => approve(p.id)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve & Activate
                  </button>
                  <button
                    onClick={() => reject(p.id)}
                    className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold px-4 py-2 rounded-lg transition-colors border border-red-500/30"
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

      {preview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreview(null)}>
          <img
            src={`/api/payment/screenshot/${preview}`}
            alt="Screenshot"
            className="max-w-2xl max-h-[90vh] rounded-xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
