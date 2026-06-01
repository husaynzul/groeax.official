import { useEffect, useState } from "react";
import { useAdminStore } from "@/store/adminStore";
import { Image, X } from "lucide-react";

interface MediaItem {
  id: number;
  userName: string;
  userEmail: string;
  plan: string;
  screenshotPath: string;
  status: string;
  createdAt: string;
}

export default function AdminMedia() {
  const { token } = useAdminStore();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/payments?status=all&hasScreenshot=1", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setItems((d.payments ?? []).filter((p: any) => p.screenshotPath)))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Media — Payment Screenshots</h1>
        <p className="text-gray-400 text-sm mt-1">{items.length} screenshot{items.length !== 1 ? "s" : ""} uploaded</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-[#13131a] border border-white/5 rounded-xl p-12 text-center">
          <Image className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No screenshots uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-[#13131a] border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500/40 transition-colors"
              onClick={() => setSelected(item.screenshotPath)}
            >
              <div className="aspect-video bg-[#0a0a0f] flex items-center justify-center overflow-hidden">
                <img
                  src={`/api/payment/screenshot/${item.screenshotPath}`}
                  alt="Screenshot"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="p-3">
                <div className="text-xs text-white font-medium truncate">{item.userName}</div>
                <div className="text-xs text-gray-400 truncate">{item.plan.replace(/_/g, " ")}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    item.status === "verified" ? "bg-green-500/20 text-green-400" :
                    item.status === "rejected" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>{item.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300" onClick={() => setSelected(null)}>
            <X className="w-6 h-6" />
          </button>
          <img
            src={`/api/payment/screenshot/${selected}`}
            alt="Screenshot"
            className="max-w-3xl max-h-[90vh] rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
