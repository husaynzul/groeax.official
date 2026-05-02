import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock,
  Copy, Download, ExternalLink, ChevronDown, ChevronUp,
  Wifi, Zap, BarChart2, Globe, Building2, Activity,
  Shield, Key, AlertTriangle,
} from "lucide-react";
import { useBrokerStore, type BrokerConnection, type BrokerType } from "@/store/brokerStore";
import { useTradeStore } from "@/store/tradeStore";
import type { Trade } from "@/types";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

/* ── Broker catalogue ──────────────────────────────────────────────── */
interface BrokerDef {
  type: BrokerType;
  name: string;
  tag: string;
  description: string;
  color: string;
  bgColor: string;
  fields: ("apiKey" | "apiSecret" | "accountId" | "serverUrl" | "paper")[];
  labels: Partial<Record<string, string>>;
  docsUrl: string;
  readOnly?: boolean;
}

const CRYPTO_BROKERS: BrokerDef[] = [
  {
    type: "binance",
    name: "Binance",
    tag: "Crypto",
    description: "World's largest crypto exchange. Import spot & futures trade history.",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/20",
    fields: ["apiKey", "apiSecret"],
    labels: { apiKey: "API Key", apiSecret: "Secret Key" },
    docsUrl: "https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072",
    readOnly: true,
  },
  {
    type: "coinbase",
    name: "Coinbase Advanced",
    tag: "Crypto",
    description: "Coinbase Advanced Trade API for spot & perpetual markets.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    fields: ["apiKey", "apiSecret"],
    labels: { apiKey: "API Key Name", apiSecret: "API Private Key" },
    docsUrl: "https://docs.cdp.coinbase.com/advanced-trade/docs/getting-started",
    readOnly: true,
  },
  {
    type: "kraken",
    name: "Kraken",
    tag: "Crypto",
    description: "Kraken REST API for spot, futures and margin trading history.",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/20",
    fields: ["apiKey", "apiSecret"],
    labels: { apiKey: "API Key", apiSecret: "Private Key" },
    docsUrl: "https://docs.kraken.com/api/docs/guides/global-intro",
    readOnly: true,
  },
  {
    type: "bybit",
    name: "Bybit",
    tag: "Crypto",
    description: "Bybit V5 API for spot, linear, inverse and options history.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/20",
    fields: ["apiKey", "apiSecret"],
    labels: { apiKey: "API Key", apiSecret: "API Secret" },
    docsUrl: "https://bybit-exchange.github.io/docs/v5/intro",
    readOnly: true,
  },
  {
    type: "okx",
    name: "OKX",
    tag: "Crypto",
    description: "OKX REST API for spot, margin, swap and options trading.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
    fields: ["apiKey", "apiSecret", "accountId"],
    labels: { apiKey: "API Key", apiSecret: "Secret Key", accountId: "Passphrase" },
    docsUrl: "https://www.okx.com/docs-v5/en/",
    readOnly: true,
  },
  {
    type: "kucoin",
    name: "KuCoin",
    tag: "Crypto",
    description: "KuCoin API for spot, margin and futures trading history.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    fields: ["apiKey", "apiSecret", "accountId"],
    labels: { apiKey: "API Key", apiSecret: "API Secret", accountId: "API Passphrase" },
    docsUrl: "https://www.kucoin.com/docs/beginners/introduction",
    readOnly: true,
  },
];

const TRAD_BROKERS: BrokerDef[] = [
  {
    type: "mt5",
    name: "MetaTrader 5",
    tag: "Forex / CFD",
    description: "Connect via WebSocket bridge. Works with any MT5 broker — Exness, IC Markets, etc.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    fields: [],
    labels: {},
    docsUrl: "https://www.metatrader5.com",
  },
  {
    type: "alpaca",
    name: "Alpaca Markets",
    tag: "Stocks / Crypto",
    description: "US stocks & crypto. Paper and live trading accounts supported.",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10 border-pink-500/20",
    fields: ["apiKey", "apiSecret", "paper"],
    labels: { apiKey: "API Key ID", apiSecret: "API Secret Key" },
    docsUrl: "https://alpaca.markets/docs/api-references/",
  },
  {
    type: "oanda",
    name: "OANDA",
    tag: "Forex / CFD",
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
    tag: "Multi-asset",
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
    tag: "Futures",
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
    tag: "Forex / CFD",
    description: "Open API for forex/CFD brokers using the cTrader platform.",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10 border-sky-500/20",
    fields: ["apiKey", "apiSecret", "accountId"],
    labels: { apiKey: "Access Token", accountId: "Account ID" },
    docsUrl: "https://connect.spotware.com",
  },
];

const ALL_DEFS = [...CRYPTO_BROKERS, ...TRAD_BROKERS];

/* ── Icons ─────────────────────────────────────────────────────────── */
function BrokerIcon({ type, size = 5 }: { type: BrokerType; size?: number }) {
  const cls = `w-${size} h-${size}`;
  const map: Partial<Record<BrokerType, JSX.Element>> = {
    mt5:       <BarChart2    className={cls} />,
    alpaca:    <Zap          className={cls} />,
    oanda:     <Globe        className={cls} />,
    ibkr:      <Building2    className={cls} />,
    tradovate: <Activity     className={cls} />,
    ctrader:   <Wifi         className={cls} />,
    binance:   <Zap          className={cls} />,
    coinbase:  <Shield       className={cls} />,
    kraken:    <Activity     className={cls} />,
    bybit:     <BarChart2    className={cls} />,
    okx:       <Globe        className={cls} />,
    kucoin:    <Key          className={cls} />,
  };
  return map[type] ?? <ExternalLink className={cls} />;
}

/* ── Status badge ───────────────────────────────────────────────────── */
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

/* ── Crypto Exchange Panel ──────────────────────────────────────────── */
function CryptoPanel({ def }: { def: BrokerDef }) {
  const steps: Record<string, string[]> = {
    binance:  ["Log in to Binance → Profile → API Management", "Create new API key — check 'Enable Reading' only", "Do NOT enable withdrawals or trading permissions", "Copy your API Key and Secret Key below"],
    coinbase: ["Open Coinbase Advanced → Settings → API", "Create new API key with 'View' permissions", "Copy the API Key Name and Private Key (shown once)", "Paste both values below to save"],
    kraken:   ["Log in to Kraken → Security → API", "Click 'Add key' → check 'Query Funds' + 'Query Orders/Trades'", "Do NOT enable any trading or withdrawal permissions", "Copy Key and Private Key below"],
    bybit:    ["Log in to Bybit → Account → API Management", "Create new API key → set to 'Read-Only'", "Enable 'Trade' read permission for history access", "Copy API Key and API Secret below"],
    okx:      ["Log in to OKX → Profile → API Management", "Click 'Create API Key' → set Permission to 'Read-Only'", "Note your Passphrase (you'll need it every time)", "Copy API Key, Secret Key and Passphrase below"],
    kucoin:   ["Log in to KuCoin → My Account → API Management", "Create API → set Permissions to 'General' (read-only)", "Set an API Passphrase (save it securely)", "Copy API Key, Secret and Passphrase below"],
  };
  const stepsForBroker = steps[def.type] ?? steps.binance;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
        <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-xs text-yellow-300/80 leading-relaxed">
          <strong>Read-only keys only.</strong> Only grant "Read" or "View" permissions. Never enable withdrawals or trading permissions for journal integrations.
        </div>
      </div>
      <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-primary" />
          How to create your API key
        </h4>
        <ol className="space-y-2 text-xs text-muted-foreground">
          {stepsForBroker.map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <a href={def.docsUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        <ExternalLink className="w-3 h-3" />
        {def.name} API Documentation
      </a>
    </div>
  );
}

/* ── Connect modal ──────────────────────────────────────────────────── */
interface ConnectFormProps {
  def: BrokerDef;
  onSave: (data: Partial<BrokerConnection>) => void;
  onClose: () => void;
}

const CRYPTO_TYPES: BrokerType[] = ["binance","coinbase","kraken","bybit","okx","kucoin"];

function ConnectForm({ def, onSave, onClose }: ConnectFormProps) {
  const [apiKey,    setApiKey]    = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accountId, setAccountId] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [paper,     setPaper]     = useState(true);
  const [label,     setLabel]     = useState(`My ${def.name}`);
  const isCrypto = CRYPTO_TYPES.includes(def.type);

  const handleSave = () => {
    onSave({ type: def.type, label, apiKey, apiSecret, accountId, serverUrl, paper });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        <div className={`flex items-center gap-3 px-6 py-4 border-b border-border ${def.bgColor} shrink-0`}>
          <div className={`p-2 rounded-lg bg-background/20 ${def.color}`}>
            <BrokerIcon type={def.type} size={5} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Connect {def.name}</h3>
            <p className="text-[10px] text-muted-foreground">{def.tag} · {def.readOnly ? "Read-only trade history" : "Full sync"}</p>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {def.type === "mt5" ? (
            <MT5Panel />
          ) : isCrypto ? (
            <>
              <CryptoPanel def={def} />
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Connection name</label>
                <input value={label} onChange={e => setLabel(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50" />
              </div>
              {def.fields.includes("apiKey") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{def.labels.apiKey ?? "API Key"}</label>
                  <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
                    placeholder="Paste your API key"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}
              {def.fields.includes("apiSecret") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{def.labels.apiSecret ?? "Secret Key"}</label>
                  <input value={apiSecret} onChange={e => setApiSecret(e.target.value)} type="password"
                    placeholder="Paste your secret key"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}
              {def.fields.includes("accountId") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{def.labels.accountId ?? "Passphrase"}</label>
                  <input value={accountId} onChange={e => setAccountId(e.target.value)} type="password"
                    placeholder="Paste your passphrase"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/30 border border-border">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  API keys are stored <strong className="text-foreground">only in your browser</strong>. They are never sent to TradeLog servers.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Connection name</label>
                <input value={label} onChange={e => setLabel(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50" />
              </div>
              {def.fields.includes("apiKey") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{def.labels.apiKey ?? "API Key"}</label>
                  <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
                    placeholder="••••••••••••••••"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}
              {def.fields.includes("apiSecret") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{def.labels.apiSecret ?? "API Secret"}</label>
                  <input value={apiSecret} onChange={e => setApiSecret(e.target.value)} type="password"
                    placeholder="••••••••••••••••"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}
              {def.fields.includes("accountId") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{def.labels.accountId ?? "Account ID"}</label>
                  <input value={accountId} onChange={e => setAccountId(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 font-mono" />
                </div>
              )}
              {def.fields.includes("serverUrl") && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{def.labels.serverUrl ?? "Server URL"}</label>
                  <input value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary/50 font-mono" />
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
          <div className="flex gap-2 px-6 pb-5 shrink-0">
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
          <div className="px-6 pb-5 shrink-0">
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
  const def = ALL_DEFS.find(d => d.type === broker.type);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center gap-3 p-3.5">
        <div className={`p-2 rounded-lg ${def?.bgColor ?? "bg-secondary"} ${def?.color ?? "text-muted-foreground"}`}>
          <BrokerIcon type={broker.type} size={4} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{broker.label}</p>
            {def?.tag && (
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full shrink-0">
                {def.tag}
              </span>
            )}
          </div>
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
            <p className="text-sm font-semibold">{broker.accountCurrency ?? "$"}{broker.accountEquity}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section heading ─────────────────────────────────────────────────── */
function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</h2>
      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">{count}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

/* ── Broker card ─────────────────────────────────────────────────────── */
function BrokerCard({ def, configuredCount, onConnect }: {
  def: BrokerDef;
  configuredCount: number;
  onConnect: () => void;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all hover:brightness-110 ${def.bgColor}`}>
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl bg-background/30 ${def.color}`}>
          <BrokerIcon type={def.type} size={5} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground bg-background/30 px-2 py-0.5 rounded-full">
            {def.tag}
          </span>
          {configuredCount > 0 && (
            <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
              {configuredCount} saved
            </span>
          )}
        </div>
      </div>
      <div>
        <p className="font-semibold text-sm">{def.name}</p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">{def.description}</p>
      </div>
      <button
        onClick={onConnect}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-background/40 border border-border hover:bg-background/60 text-xs font-semibold transition-colors">
        <Plus className="w-3.5 h-3.5" />
        {def.type === "mt5" ? "Setup Bridge" : "Connect"}
      </button>
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
    const def = ALL_DEFS.find(d => d.type === data.type) ?? ALL_DEFS[0];
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
      if (b.type === "alpaca") {
        const res = await fetch(`${BASE}/api/broker/alpaca/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: b.apiKey, apiSecret: b.apiSecret, paper: b.paper }),
        });
        const d = await res.json() as { ok: boolean; error?: string; equity?: string; currency?: string };
        if (d.ok) {
          updateBroker(id, { status: "connected", accountEquity: d.equity, accountCurrency: d.currency, errorMsg: "" });
        } else {
          updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
        }
      } else if (b.type === "oanda") {
        const res = await fetch(`${BASE}/api/broker/oanda/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: b.apiKey, accountId: b.accountId, practice: b.paper }),
        });
        const d = await res.json() as { ok: boolean; error?: string; equity?: string; currency?: string };
        if (d.ok) {
          updateBroker(id, { status: "connected", accountEquity: d.equity, accountCurrency: d.currency, errorMsg: "" });
        } else {
          updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
        }
      } else if (b.type === "binance") {
        const res = await fetch(`${BASE}/api/broker/binance/test`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: b.apiKey, apiSecret: b.apiSecret }),
        });
        const d = await res.json() as { ok: boolean; error?: string };
        d.ok
          ? updateBroker(id, { status: "connected", errorMsg: "" })
          : updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
      } else if (b.type === "coinbase") {
        const res = await fetch(`${BASE}/api/broker/coinbase/test`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: b.apiKey, apiSecret: b.apiSecret }),
        });
        const d = await res.json() as { ok: boolean; error?: string };
        d.ok
          ? updateBroker(id, { status: "connected", errorMsg: "" })
          : updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
      } else if (b.type === "kraken") {
        const res = await fetch(`${BASE}/api/broker/kraken/test`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: b.apiKey, apiSecret: b.apiSecret }),
        });
        const d = await res.json() as { ok: boolean; error?: string };
        d.ok
          ? updateBroker(id, { status: "connected", errorMsg: "" })
          : updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
      } else if (b.type === "bybit") {
        const res = await fetch(`${BASE}/api/broker/bybit/test`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: b.apiKey, apiSecret: b.apiSecret }),
        });
        const d = await res.json() as { ok: boolean; error?: string };
        d.ok
          ? updateBroker(id, { status: "connected", errorMsg: "" })
          : updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
      } else if (b.type === "okx") {
        const res = await fetch(`${BASE}/api/broker/okx/test`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: b.apiKey, apiSecret: b.apiSecret, passphrase: b.accountId }),
        });
        const d = await res.json() as { ok: boolean; error?: string };
        d.ok
          ? updateBroker(id, { status: "connected", errorMsg: "" })
          : updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
      } else if (b.type === "kucoin") {
        const res = await fetch(`${BASE}/api/broker/kucoin/test`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: b.apiKey, apiSecret: b.apiSecret, passphrase: b.accountId }),
        });
        const d = await res.json() as { ok: boolean; error?: string };
        d.ok
          ? updateBroker(id, { status: "connected", errorMsg: "" })
          : updateBroker(id, { status: "error", errorMsg: d.error ?? "Connection failed" });
      } else {
        updateBroker(id, { status: "connected" });
      }
    } catch (e) {
      updateBroker(id, { status: "error", errorMsg: String(e) });
    }
  }, [brokers, updateBroker]);

  const syncTrades = useCallback(async (id: string) => {
    const b = brokers.find(x => x.id === id);
    if (!b) return;
    updateBroker(id, { status: "testing", errorMsg: "" });

    const brokerPost = async (endpoint: string, body: Record<string, unknown>) => {
      const res = await fetch(`${BASE}/api/broker/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json() as Promise<{ ok: boolean; error?: string; trades?: Trade[]; count?: number }>;
    };

    try {
      let d: { ok: boolean; error?: string; trades?: Trade[]; count?: number } | null = null;

      if (b.type === "alpaca") {
        d = await brokerPost("alpaca/sync", { apiKey: b.apiKey, apiSecret: b.apiSecret, paper: b.paper });
      } else if (b.type === "oanda") {
        d = await brokerPost("oanda/sync", { apiKey: b.apiKey, accountId: b.accountId, practice: b.paper });
      } else if (b.type === "binance") {
        d = await brokerPost("binance/sync", { apiKey: b.apiKey, apiSecret: b.apiSecret });
      } else if (b.type === "coinbase") {
        d = await brokerPost("coinbase/sync", { apiKey: b.apiKey, apiSecret: b.apiSecret });
      } else if (b.type === "kraken") {
        d = await brokerPost("kraken/sync", { apiKey: b.apiKey, apiSecret: b.apiSecret });
      } else if (b.type === "bybit") {
        d = await brokerPost("bybit/sync", { apiKey: b.apiKey, apiSecret: b.apiSecret });
      } else if (b.type === "okx") {
        d = await brokerPost("okx/sync", { apiKey: b.apiKey, apiSecret: b.apiSecret, passphrase: b.accountId });
      } else if (b.type === "kucoin") {
        d = await brokerPost("kucoin/sync", { apiKey: b.apiKey, apiSecret: b.apiSecret, passphrase: b.accountId });
      } else {
        updateBroker(id, { status: "connected" });
        return;
      }

      if (d.ok && d.trades) {
        d.trades.forEach(t => addTrade(t));
        updateBroker(id, {
          status: "connected",
          lastSync: Date.now(),
          tradesImported: (b.tradesImported ?? 0) + (d.count ?? d.trades.length),
          errorMsg: d.count === 0 ? "No new trades found." : "",
        });
      } else {
        updateBroker(id, { status: "error", errorMsg: d?.error ?? "Sync failed" });
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
          <h1 className="text-xl font-bold">Broker & Exchange Connections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect your exchange or broker to import trades into your journal
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

        {/* Connected list */}
        {brokers.length > 0 && (
          <section>
            <SectionHeading label="Your Connections" count={brokers.length} />
            <div className="space-y-2">
              {brokers.map(b => (
                <BrokerRow key={b.id} broker={b}
                  onTest={testConnection} onSync={syncTrades} onRemove={removeBroker} />
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
          <h3 className="text-sm font-semibold">How trade sync works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { n: "1", title: "Connect", body: "Enter your read-only API credentials. All keys are stored in your browser — never on our servers." },
              { n: "2", title: "Sync",    body: "Pull your closed orders from any exchange into your TradeLog journal with one click." },
              { n: "3", title: "Analyze", body: "All synced trades appear in your journal, analytics, and AI coaching flow instantly." },
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

        {/* Crypto exchanges */}
        <section>
          <SectionHeading label="Crypto Exchanges" count={CRYPTO_BROKERS.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CRYPTO_BROKERS.map(def => (
              <BrokerCard key={def.type} def={def}
                configuredCount={brokers.filter(b => b.type === def.type).length}
                onConnect={() => setConnectingDef(def)} />
            ))}
          </div>
        </section>

        {/* Traditional brokers */}
        <section>
          <SectionHeading label="Forex, Stocks & Futures" count={TRAD_BROKERS.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TRAD_BROKERS.map(def => (
              <BrokerCard key={def.type} def={def}
                configuredCount={brokers.filter(b => b.type === def.type).length}
                onConnect={() => setConnectingDef(def)} />
            ))}
          </div>
        </section>

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
