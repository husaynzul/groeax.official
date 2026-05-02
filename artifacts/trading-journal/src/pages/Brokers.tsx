import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock,
  Copy, Download, ExternalLink, ChevronDown, ChevronUp,
  Wifi, AlertCircle, Zap, BarChart2, Globe, Building2, Activity,
} from "lucide-react";
import { useBrokerStore, type BrokerConnection, type BrokerType } from "@/store/brokerStore";
import { useTradeStore } from "@/store/tradeStore";
import type { Trade } from "@/types";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

/* ── Broker catalogue ──────────────────────────────────────────────── */
interface BrokerDef {
  type: BrokerType;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  fields: ("apiKey" | "apiSecret" | "accountId" | "serverUrl" | "paper")[];
  labels: Partial<Record<string, string>>;
  docsUrl: string;
}

const BROKER_DEFS: BrokerDef[] = [
  {
    type: "mt5",
    name: "MetaTrader 5",
    description: "Connect via WebSocket bridge EA. Supports all MT5 brokers.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    fields: [],
    labels: {},
    docsUrl: "https://www.metatrader5.com",
  },
  {
    type: "alpaca",
    name: "Alpaca Markets",
    description: "US stocks & crypto. Paper and live trading accounts supported.",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    fields: ["apiKey", "apiSecret", "paper"],
    labels: { apiKey: "API Key ID", apiSecret: "API Secret Key" },
    docsUrl: "https://alpaca.markets/docs/api-references/",
  },
  {
    type: "oanda",
    name: "OANDA",
    description: "Forex & CFDs. Supports v20 REST API (practice and live).",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    fields: ["apiKey", "accountId", "paper"],
    labels: { apiKey: "API Token", accountId: "Account ID" },
    docsUrl: "https://developer.oanda.com/rest-live-v20/introduction/",
  },
  {
    type: "ibkr",
    name: "Interactive Brokers",
    description: "Connect via IB Gateway or TWS with Client Portal API.",
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    fields: ["serverUrl", "accountId"],
    labels: { serverUrl: "Gateway URL (e.g. localhost:5000)", accountId: "Account ID" },
    docsUrl: "https://interactivebrokers.github.io/cpwebapi/",
  },
  {
    type: "tradovate",
    name: "Tradovate",
    description: "Futures trading platform with REST & WebSocket API.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    fields: ["apiKey", "apiSecret", "accountId", "paper"],
    labels: { apiKey: "Client ID", apiSecret: "Client Secret" },
    docsUrl: "https://api.tradovate.com",
  },
  {
    type: "ctrader",
    name: "cTrader / cBroker",
    description: "Open API for forex/CFD brokers using the cTrader platform.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
    fields: ["apiKey", "apiSecret", "accountId"],
    labels: { apiKey: "Access Token", accountId: "Account ID" },
    docsUrl: "https://connect.spotware.com",
  },
  {
    type: "custom" as BrokerType,
    name: "Exness",
    description: "Connect via MT5 bridge. Exness supports all major MT5 features including scalping.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/20",
    fields: [],
    labels: {},
    docsUrl: "https://www.exness.com/trading/platform/mt5/",
  },
];

/* ── Icons ─────────────────────────────────────────────────────────── */
function BrokerIcon({ type, size = 5 }: { type: BrokerType; size?: number }) {
  const cls = `w-${size} h-${size}`;
  const map: Record<BrokerType, JSX.Element> = {
    mt5:       <BarChart2  className={cls} />,
    alpaca:    <Zap        className={cls} />,
    oanda:     <Globe      className={cls} />,
    ibkr:      <Building2  className={cls} />,
    tradovate: <Activity   className={cls} />,
    ctrader:   <Wifi       className={cls} />,
    custom:    <ExternalLink className={cls} />,
  };
  return map[type] ?? map.custom;
}

function StatusBadge({ status }: { status: BrokerConnection["status"] }) {
  const map = {
    idle:      { label: "Not tested", color: "text-muted-foreground", icon: Clock },
    testing:   { label: "Testing…",   color: "text-yellow-400",       icon: RefreshCw },
    connected: { label: "Connected",  color: "text-emerald-400",      icon: CheckCircle },
    error:     { label: "Error",      color: "text-red-400",          icon: XCircle },
  };
  const s = map[status] ?? map.idle;
  const Icon = s.icon;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium ${s.color}`}>
      <Icon className={`w-3 h-3 ${status === "testing" ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
}

/* ── MT5 Panel ──────────────────────────────────────────────────────── */
function MT5Panel() {
  const [info, setInfo] = useState<{ wsUrl: string; pythonScript: string } | null>(null);
  const [copied, setCopied] = useState<"url" | "script" | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/broker/mt5/info`)
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => {});
  }, []);

  const copy = (text: string, type: "url" | "script") => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const download = () => {
    if (!info) return;
    const blob = new Blob([info.pythonScript], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tradelog_mt5_bridge.py";
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
        <h4 className="text-sm font-semibold">How it works</h4>
        <ol className="space-y-2 text-xs text-muted-foreground">
          {[
            "Download the Python bridge script below",
            "Install dependencies: pip install MetaTrader5 websockets",
            "Run the script while MT5 is open",
            "Your positions will stream live to this dashboard",
          ].map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {info && (
        <>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">WebSocket Bridge URL</p>
            <div className="flex gap-2">
              <code className="flex-1 text-[11px] font-mono bg-secondary/40 border border-border rounded-lg px-3 py-2 text-emerald-400 truncate">
                {info.wsUrl}
              </code>
              <button onClick={() => copy(info.wsUrl, "url")}
                className="shrink-0 p-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary transition-colors">
                {copied === "url" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={download}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              <Download className="w-4 h-4" />
              Download Python Bridge
            </button>
            <button onClick={() => copy(info.pythonScript, "script")}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-xs text-muted-foreground transition-colors">
              {copied === "script" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copy
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Connect modal / form ────────────────────────────────────────────── */
interface ConnectFormProps {
  def: BrokerDef;
  onSave: (data: Partial<BrokerConnection>) => void;
  onClose: () => void;
}

function ConnectForm({ def, onSave, onClose }: ConnectFormProps) {
  const [apiKey, setApiKey]       = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accountId, setAccountId] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [paper, setPaper]         = useState(true);
  const [label, setLabel]         = useState(`My ${def.name}`);

  const handleSave = () => {
    onSave({ type: def.type, label, apiKey, apiSecret, accountId, serverUrl, paper });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">

        <div className={`flex items-center gap-3 px-6 py-4 border-b border-border ${def.bgColor}`}>
          <div className={`p-2 rounded-lg bg-background/20 ${def.color}`}>
            <BrokerIcon type={def.type} size={5} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Connect {def.name}</h3>
            <p className="text-[10px] text-muted-foreground">{def.description}</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {def.type === "mt5" ? (
            <MT5Panel />
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Connection name</label>
                <input value={label} onChange={e => setLabel(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50" />
              </div>

              {def.fields.includes("apiKey") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {def.labels.apiKey ?? "API Key"}
                  </label>
                  <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
                    placeholder="••••••••••••••••"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}

              {def.fields.includes("apiSecret") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {def.labels.apiSecret ?? "API Secret"}
                  </label>
                  <input value={apiSecret} onChange={e => setApiSecret(e.target.value)} type="password"
                    placeholder="••••••••••••••••"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}

              {def.fields.includes("accountId") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {def.labels.accountId ?? "Account ID"}
                  </label>
                  <input value={accountId} onChange={e => setAccountId(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}

              {def.fields.includes("serverUrl") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {def.labels.serverUrl ?? "Server URL"}
                  </label>
                  <input value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}

              {def.fields.includes("paper") && (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div onClick={() => setPaper(!paper)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${paper ? "bg-primary" : "bg-secondary border border-border"}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${paper ? "translate-x-4" : ""}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{paper ? "Paper / Demo account" : "Live account"}</p>
                    <p className="text-[10px] text-muted-foreground">{paper ? "Using sandbox/practice endpoints" : "Real money — use with care"}</p>
                  </div>
                </label>
              )}

              <a href={def.docsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="w-3 h-3" />
                {def.name} API Documentation
              </a>
            </>
          )}
        </div>

        {def.type !== "mt5" && (
          <div className="flex gap-2 px-6 pb-5">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-medium text-muted-foreground transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              Save Connection
            </button>
          </div>
        )}
        {def.type === "mt5" && (
          <div className="px-6 pb-5">
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-sm font-medium text-muted-foreground transition-colors">
              Done
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Connected broker row ───────────────────────────────────────────── */
interface BrokerRowProps {
  broker: BrokerConnection;
  onTest: (id: string) => void;
  onSync: (id: string) => void;
  onRemove: (id: string) => void;
}

function BrokerRow({ broker, onTest, onSync, onRemove }: BrokerRowProps) {
  const def = BROKER_DEFS.find(d => d.type === broker.type);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center gap-3 p-3.5">
        <div className={`p-2 rounded-lg ${def?.bgColor ?? "bg-secondary"} ${def?.color ?? "text-muted-foreground"}`}>
          <BrokerIcon type={broker.type} size={4} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{broker.label}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <StatusBadge status={broker.status} />
            {broker.lastSync && (
              <span className="text-[10px] text-muted-foreground">
                Synced {new Date(broker.lastSync).toLocaleDateString()}
              </span>
            )}
            {broker.tradesImported > 0 && (
              <span className="text-[10px] text-primary">{broker.tradesImported} trades</span>
            )}
          </div>
          {broker.errorMsg && (
            <p className="text-[10px] text-red-400 mt-0.5 truncate">{broker.errorMsg}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {broker.type !== "mt5" && (
            <>
              <button onClick={() => onTest(broker.id)}
                title="Test connection"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Wifi className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onSync(broker.id)}
                title="Sync trades"
                disabled={broker.status === "testing"}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${broker.status === "testing" ? "animate-spin" : ""}`} />
              </button>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onRemove(broker.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && broker.type === "mt5" && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          <MT5Panel />
        </div>
      )}
      {expanded && broker.accountEquity && (
        <div className="px-4 pb-3 pt-1 border-t border-border flex gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground">Equity</p>
            <p className="text-sm font-semibold">{broker.accountCurrency ?? "$"} {broker.accountEquity}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function Brokers() {
  const { brokers, addBroker, updateBroker, removeBroker } = useBrokerStore();
  const { addTrade } = useTradeStore();
  const [connectingDef, setConnectingDef] = useState<BrokerDef | null>(null);

  const handleSave = useCallback((data: Partial<BrokerConnection>) => {
    if (!data.type) return;
    const def = BROKER_DEFS.find(d => d.type === data.type)!;
    addBroker({
      type: data.type,
      label: data.label ?? `My ${def.name}`,
      apiKey: data.apiKey ?? "",
      apiSecret: data.apiSecret ?? "",
      accountId: data.accountId ?? "",
      serverUrl: data.serverUrl ?? "",
      paper: data.paper ?? true,
    });
  }, [addBroker]);

  const testConnection = useCallback(async (id: string) => {
    const b = brokers.find(x => x.id === id);
    if (!b) return;
    updateBroker(id, { status: "testing", errorMsg: "" });
    try {
      let endpoint = "";
      let body: Record<string, unknown> = {};
      if (b.type === "alpaca") {
        endpoint = "/api/broker/alpaca/test";
        body = { apiKey: b.apiKey, apiSecret: b.apiSecret, paper: b.paper };
      } else if (b.type === "oanda") {
        endpoint = "/api/broker/oanda/test";
        body = { apiKey: b.apiKey, accountId: b.accountId, practice: b.paper };
      } else {
        updateBroker(id, { status: "connected" });
        return;
      }
      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json() as { ok: boolean; error?: string; equity?: string; currency?: string; accountId?: string };
      if (d.ok) {
        updateBroker(id, { status: "connected", accountEquity: d.equity, accountCurrency: d.currency, errorMsg: "" });
      } else {
        updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
      }
    } catch (e) {
      updateBroker(id, { status: "error", errorMsg: String(e) });
    }
  }, [brokers, updateBroker]);

  const syncTrades = useCallback(async (id: string) => {
    const b = brokers.find(x => x.id === id);
    if (!b) return;
    updateBroker(id, { status: "testing" });
    try {
      let endpoint = "";
      let body: Record<string, unknown> = {};
      if (b.type === "alpaca") {
        endpoint = "/api/broker/alpaca/sync";
        body = { apiKey: b.apiKey, apiSecret: b.apiSecret, paper: b.paper };
      } else if (b.type === "oanda") {
        endpoint = "/api/broker/oanda/sync";
        body = { apiKey: b.apiKey, accountId: b.accountId, practice: b.paper };
      } else {
        updateBroker(id, { status: "connected" });
        return;
      }
      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json() as { ok: boolean; error?: string; trades?: Trade[]; count?: number };
      if (d.ok && d.trades) {
        d.trades.forEach(t => addTrade(t));
        updateBroker(id, {
          status: "connected",
          lastSync: Date.now(),
          tradesImported: (b.tradesImported ?? 0) + (d.count ?? d.trades.length),
          errorMsg: "",
        });
      } else {
        updateBroker(id, { status: "error", errorMsg: d.error ?? "Sync failed" });
      }
    } catch (e) {
      updateBroker(id, { status: "error", errorMsg: String(e) });
    }
  }, [brokers, updateBroker, addTrade]);

  const connectedCount = brokers.filter(b => b.status === "connected").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold">Broker Connections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your broker to auto-sync trades directly into your journal
          </p>
        </div>
        {connectedCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">{connectedCount} connected</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* Connected brokers */}
        {brokers.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Connections</h2>
            <div className="space-y-2">
              {brokers.map(b => (
                <BrokerRow key={b.id} broker={b}
                  onTest={testConnection}
                  onSync={syncTrades}
                  onRemove={removeBroker}
                />
              ))}
            </div>
          </section>
        )}

        {/* How it works banner */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
          <h3 className="text-sm font-semibold">How trade sync works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { n: "1", title: "Connect", body: "Enter your broker API credentials. All keys are stored locally — never on our servers." },
              { n: "2", title: "Sync",    body: "Pull closed orders from your broker into your TradeLog journal with one click." },
              { n: "3", title: "Analyze", body: "All synced trades appear in your journal, analytics, and AI coaching flow." },
            ].map(s => (
              <div key={s.n} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">{s.n}</span>
                <div>
                  <p className="text-xs font-semibold">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Available brokers grid */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Available Brokers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BROKER_DEFS.map(def => {
              const existing = brokers.filter(b => b.type === def.type).length;
              return (
                <div key={def.type}
                  className={`rounded-xl border p-4 space-y-3 transition-all ${def.bgColor}`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl bg-background/30 ${def.color}`}>
                      <BrokerIcon type={def.type} size={5} />
                    </div>
                    {existing > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {existing} configured
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{def.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{def.description}</p>
                  </div>
                  <button
                    onClick={() => setConnectingDef(def)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-background/40 border border-border hover:bg-background/70 text-xs font-semibold transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    {def.type === "mt5" ? "Setup Bridge" : "Connect"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Security notice */}
        <div className="rounded-xl border border-border bg-secondary/20 p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Your credentials are safe.</span> API keys are stored only in your browser's local storage and are never transmitted to TradeLog servers. All broker API calls are proxied through your local API server. We strongly recommend using <strong>read-only</strong> or <strong>paper trading</strong> API keys.
          </div>
        </div>
      </div>

      {/* Connect modal */}
      <AnimatePresence>
        {connectingDef && (
          <ConnectForm
            def={connectingDef}
            onSave={handleSave}
            onClose={() => setConnectingDef(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
