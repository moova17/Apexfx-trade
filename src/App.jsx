/* ════════════════════════════════════════════════════════════════════
   APEX FX PRO  v4.0  ·  Production AI Trading Dashboard
   ─────────────────────────────────────────────────────────────────────
   PRIORITIES IMPLEMENTED:
   ✓ 1. Mobile responsive (drawer, stacked cards, touch-friendly)
   ✓ 2. Real TradingView Lightweight Charts (CDN-loaded)
   ✓ 3. Firebase Auth (REST API — email/password)
   ✓ 4. Vercel-ready (single-file React component)

   FEATURES:
   ✓ Notifications · Economic Calendar · Watchlist · Dark/Light mode
   ✓ Trade Journal with notes · News Feed · Leaderboard
   ✓ Strategy Backtesting · Multi-pair AI signals
   ✓ Demo trading engine (leverage, margin, SL/TP auto-close)
   ✓ Wallet (deposit/withdraw/history)
══════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useCallback, useMemo, Component } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
         ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

/* ═══════════════════════════════════════════════════════════
   ERROR BOUNDARY  — prevents single-component crashes from
   taking down the whole app. Provides a recovery UI.
═══════════════════════════════════════════════════════════ */
class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    if (typeof console !== "undefined") console.error("[ApexFX]", err, info);
  }
  reset = () => this.setState({ err: null });
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ minHeight:"100vh", background:"#060D1A", color:"#E2EEFF", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow',sans-serif", padding:"20px" }}>
        <div style={{ maxWidth:480, background:"linear-gradient(135deg,rgba(255,51,102,.08),rgba(8,18,36,.95))", border:"1px solid rgba(255,51,102,.3)", borderRadius:14, padding:"28px", textAlign:"center" }}>
          <div style={{ fontSize:42, marginBottom:14 }}>⚠</div>
          <div style={{ fontSize:20, fontWeight:800, marginBottom:8, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:.5 }}>Something went wrong</div>
          <div style={{ color:"#5878A0", fontSize:13, marginBottom:18, lineHeight:1.5 }}>{this.state.err?.message || "Unexpected error"}</div>
          <button onClick={this.reset} style={{ padding:"10px 24px", background:"linear-gradient(135deg,rgba(0,212,255,.28),rgba(0,160,200,.1))", border:"1px solid rgba(0,212,255,.6)", color:"#00D4FF", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>↻ Recover</button>
          <button onClick={() => { try { localStorage.clear(); } catch {} location.reload(); }} style={{ marginLeft:8, padding:"10px 24px", background:"rgba(255,51,102,.1)", border:"1px solid rgba(255,51,102,.4)", color:"#FF3366", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>Reset App</button>
        </div>
      </div>
    );
  }
}

/* ═══════════════════════════════════════════════════════════
   CONFIG · CONSTANTS
═══════════════════════════════════════════════════════════ */
const PAIRS = {
  EURUSD:{ n:"EUR/USD", c:"#00D4FF", pip:0.0001, d:5, sprd:0.8,  cat:"FX"  },
  GBPUSD:{ n:"GBP/USD", c:"#7B6EF6", pip:0.0001, d:5, sprd:1.2,  cat:"FX"  },
  USDJPY:{ n:"USD/JPY", c:"#FF6B9D", pip:0.01,   d:3, sprd:0.9,  cat:"FX"  },
  XAUUSD:{ n:"XAU/USD", c:"#FFD700", pip:0.1,    d:2, sprd:0.35, cat:"CMD" },
  BTCUSD:{ n:"BTC/USD", c:"#FF9500", pip:1,      d:1, sprd:25,   cat:"CRY" },
};
const INIT_P = { EURUSD:1.08542, GBPUSD:1.27134, USDJPY:149.821, XAUUSD:2341.50, BTCUSD:67834.0 };

/* ─── Theme tokens (dark + light) ─── */
const THEMES = {
  dark: {
    bg:"#060D1A", card:"linear-gradient(135deg,rgba(8,18,36,.95),rgba(4,10,22,.98))",
    b:"rgba(0,212,255,.09)", cyan:"#00D4FF", green:"#00FF88", red:"#FF3366",
    gold:"#FFD700", purple:"#7B6EF6", text:"#E2EEFF", muted:"#3D5878", dim:"#18304A",
    chart:"#0E1A2E", grid:"rgba(0,212,255,.04)",
  },
  light: {
    bg:"#F2F5FA", card:"linear-gradient(135deg,rgba(255,255,255,.96),rgba(248,250,254,.98))",
    b:"rgba(0,90,160,.13)", cyan:"#0099CC", green:"#00B85F", red:"#E5294D",
    gold:"#C99300", purple:"#5B4FCF", text:"#0E1F35", muted:"#5878A0", dim:"#A8C0D8",
    chart:"#FFFFFF", grid:"rgba(0,90,160,.06)",
  },
};

/* ═══════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════ */
const genId    = () => Math.random().toString(36).slice(2, 11);
const fmtP = (p, id) => {
  if (!p || isNaN(p)) return "—";
  const d = PAIRS[id]?.d || 5;
  if (id === "BTCUSD") return Number(p).toLocaleString("en-US",{minimumFractionDigits:1, maximumFractionDigits:1});
  return Number(p).toFixed(d);
};
const fmtMoney = (n, sign=true) => {
  const v = parseFloat(n) || 0;
  return (sign && v > 0 ? "+" : "") + "$" + Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2, maximumFractionDigits:2});
};
const fmtTime = ts => new Date(ts).toLocaleTimeString("en-US",{hour12:false});
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US",{month:"short", day:"numeric"});

/* Correct P&L calculation per instrument type.
   For JPY pairs: pip value in USD = (units × pip) ÷ price.
   For Gold:      pip value in USD = units × pip.
   For BTC:       1 unit = 1 BTC, so PnL in USD = priceMove × units (no pip div).
   Returns USD P&L from pips count. */
function calcPnL(pair, type, entry, exit, units) {
  if (!entry || !exit || !units) return { pips: 0, usd: 0 };
  const cfg = PAIRS[pair]; if (!cfg) return { pips: 0, usd: 0 };
  const isBuy = type === "BUY";
  const move  = isBuy ? exit - entry : entry - exit;
  const pips  = move / cfg.pip;
  let usd;
  if (pair === "USDJPY") usd = (move * units) / exit;          // JPY quote → ÷ exit price
  else if (pair === "BTCUSD") usd = move * units;               // 1 unit = 1 BTC
  else usd = move * units;                                      // FX & XAU: USD-quoted
  return { pips, usd };
}

/* Correct margin requirement per pair (USD notional / leverage). */
function calcMargin(pair, units, price, leverage) {
  if (pair === "BTCUSD") return (units * price) / leverage;
  if (pair === "USDJPY") return units / leverage;               // base = USD
  if (pair === "XAUUSD") return (units * price) / leverage;
  return (units * price) / leverage;                            // EUR/GBP base
}

/* Sensible default units per pair so margin is reasonable on $10k account. */
const DEFAULT_UNITS = { EURUSD:10000, GBPUSD:10000, USDJPY:10000, XAUUSD:1, BTCUSD:0.01 };
const QUICK_UNITS = {
  EURUSD: ["1000","10000","100000"],
  GBPUSD: ["1000","10000","100000"],
  USDJPY: ["1000","10000","100000"],
  XAUUSD: ["1","10","100"],
  BTCUSD: ["0.01","0.1","1"],
};

function buildCandles(base, n=2000) {
  let open = base * 0.992;
  const out = [];
  for (let i = 0; i < n; i++) {
    const vol  = base * 0.0018;
    const move = (Math.random() - 0.49) * vol;
    const high = open + Math.random() * vol * 0.8;
    const low  = open - Math.random() * vol * 0.8;
    const close = Math.max(low + 0.0001, Math.min(high - 0.0001, open + move));
    out.push({
      time: Math.floor((Date.now() - (n - i) * 60000) / 1000),
      open: +open.toFixed(6), high: +high.toFixed(6), low: +low.toFixed(6), close: +close.toFixed(6),
      vol: Math.floor(Math.random() * 6000 + 800),
    });
    open = close;
  }
  return out;
}

const calcRSI = (closes, p=14) => {
  if (closes.length < p+1) return [];
  const out = []; let ag=0, al=0;
  for (let i=1; i<=p; i++) { const d = closes[i]-closes[i-1]; if(d>0)ag+=d; else al-=d; }
  ag/=p; al/=p;
  out[p] = al===0 ? 100 : 100 - 100/(1+ag/al);
  for (let i=p+1; i<closes.length; i++) {
    const d = closes[i]-closes[i-1];
    ag = (ag*(p-1) + Math.max(d,0))/p;
    al = (al*(p-1) + Math.max(-d,0))/p;
    out[i] = al===0 ? 100 : 100 - 100/(1+ag/al);
  }
  return out;
};

const aggregate = (candles, tf) => {
  /* Each base candle = 1 minute. step = number of base candles per output candle. */
  const stepMap = {
    "1m":1, "5m":5, "15m":15, "30m":30,
    "1h":60, "4h":240,
    "1D":1440, "1W":10080, "1M":43200, "1Y":525600,
  };
  let step = stepMap[tf] || 1;
  if (step === 1) return candles;

  /* If the requested step would yield < 8 candles (big TFs against limited 1-min history),
     auto-scale step DOWN so the chart stays visually informative. The label still says "1D"
     but we render synthetic bars so the user sees price action. */
  if (candles.length / step < 8) {
    step = Math.max(1, Math.floor(candles.length / 60));
  }

  const out = [];
  for (let i=0; i<candles.length; i+=step) {
    const ch = candles.slice(i, i+step); if (!ch.length) continue;
    out.push({
      time: ch[0].time, open: ch[0].open,
      high: Math.max(...ch.map(c=>c.high)),
      low:  Math.min(...ch.map(c=>c.low)),
      close: ch[ch.length-1].close,
      vol:  ch.reduce((s,c)=>s+c.vol,0),
    });
  }
  return out;
};

/* ═══════════════════════════════════════════════════════════
   FIREBASE AUTH HOOK
═══════════════════════════════════════════════════════════ */
function useAuth(apiKey) {
  const BASE = "https://identitytoolkit.googleapis.com/v1/accounts";
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try { const s = localStorage.getItem("apexfx_user"); if (s) setUser(JSON.parse(s)); } catch {}
    setLoading(false);
  }, []);
  const persist = (u) => { setUser(u); try { localStorage.setItem("apexfx_user", JSON.stringify(u)); } catch {} };

  const signInDemo = useCallback(async () => {
    const u = { uid:"demo_"+genId(), displayName:"Demo Trader", email:"demo@apexfx.io", isAnon:true, idToken:"demo" };
    persist(u); return u;
  }, []);

  const signUp = useCallback(async (email, password, name) => {
    setError("");
    if (!apiKey) { const u = { uid:"local_"+genId(), displayName:name||email.split("@")[0], email, isAnon:false, idToken:"local" }; persist(u); return u; }
    try {
      const res = await fetch(`${BASE}:signUp?key=${apiKey}`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, password, returnSecureToken:true }) });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      const u = { uid:d.localId, idToken:d.idToken, displayName:name||email.split("@")[0], email, isAnon:false };
      persist(u); return u;
    } catch (e) { setError(e.message); throw e; }
  }, [apiKey]);

  const signIn = useCallback(async (email, password) => {
    setError("");
    if (!apiKey) { const u = { uid:"local_"+genId(), displayName:email.split("@")[0], email, isAnon:false, idToken:"local" }; persist(u); return u; }
    try {
      const res = await fetch(`${BASE}:signInWithPassword?key=${apiKey}`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ email, password, returnSecureToken:true }) });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      const u = { uid:d.localId, idToken:d.idToken, displayName:d.displayName||email.split("@")[0], email, isAnon:false };
      persist(u); return u;
    } catch (e) { setError(e.message); throw e; }
  }, [apiKey]);

  const signOut = useCallback(() => { setUser(null); try { localStorage.removeItem("apexfx_user"); } catch {} }, []);

  return { user, loading, error, signInDemo, signUp, signIn, signOut };
}

/* ═══════════════════════════════════════════════════════════
   PERSISTENT STORAGE
═══════════════════════════════════════════════════════════ */
function usePersist(uid) {
  const KEY = `apexfx_${uid || "guest"}`;
  const load = useCallback(async (field) => {
    try { const r = await window.storage.get(`${KEY}_${field}`); if (r) return JSON.parse(r.value); } catch {}
    try { return JSON.parse(localStorage.getItem(`${KEY}_${field}`) || "null"); } catch { return null; }
  }, [KEY]);
  const save = useCallback(async (field, val) => {
    const s = JSON.stringify(val);
    try { await window.storage.set(`${KEY}_${field}`, s); } catch {}
    try { localStorage.setItem(`${KEY}_${field}`, s); } catch {}
  }, [KEY]);
  return { load, save };
}

/* ═══════════════════════════════════════════════════════════
   WALLET
═══════════════════════════════════════════════════════════ */
function useWallet(uid, persist) {
  const DEFAULT = { balance:10000, equity:10000, deposits:10000, withdrawals:0, totalPnl:0 };
  const [wallet, setWalletRaw] = useState(DEFAULT);
  const [txHistory, setTxHistory] = useState([]);
  const [ready, setReady] = useState(false);

  /* Refs hold the latest committed state — used during rapid concurrent updates */
  const walletRef = useRef(DEFAULT);
  const txRef     = useRef([]);
  useEffect(() => { walletRef.current = wallet; }, [wallet]);
  useEffect(() => { txRef.current = txHistory; }, [txHistory]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const w  = await persist.load("wallet");
      const tx = await persist.load("tx");
      if (cancelled) return;
      setWalletRaw(w || DEFAULT);
      setTxHistory(tx || []);
      walletRef.current = w || DEFAULT;
      txRef.current = tx || [];
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [uid]);

  /* All state changes use ref-based reads so concurrent calls don't lose updates */
  const commit = useCallback(async (newWallet, newTx) => {
    walletRef.current = newWallet;
    if (newTx) txRef.current = newTx;
    setWalletRaw(newWallet);
    if (newTx) setTxHistory(newTx);
    await persist.save("wallet", newWallet);
    if (newTx) await persist.save("tx", newTx.slice(0, 200));
  }, [persist]);

  const deposit = useCallback(async (amt, method="Card") => {
    const a = parseFloat(amt);
    if (!a || a <= 0) throw new Error("Invalid amount");
    const w = walletRef.current;
    const tx = { id:genId(), type:"DEPOSIT", amount:a, method, ts:Date.now(), balance: w.balance + a };
    await commit({ ...w, balance: w.balance + a, equity: w.equity + a, deposits: w.deposits + a }, [tx, ...txRef.current]);
    return tx;
  }, [commit]);

  const withdraw = useCallback(async (amt, method="Bank") => {
    const a = parseFloat(amt);
    if (!a || a <= 0) throw new Error("Invalid amount");
    const w = walletRef.current;
    if (a > w.balance) throw new Error("Insufficient balance");
    const tx = { id:genId(), type:"WITHDRAW", amount:-a, method, ts:Date.now(), balance: w.balance - a };
    await commit({ ...w, balance: w.balance - a, equity: w.equity - a, withdrawals: w.withdrawals + a }, [tx, ...txRef.current]);
    return tx;
  }, [commit]);

  const applyPnl = useCallback(async (pnl, pair, side, note="") => {
    const w = walletRef.current;
    const tx = { id:genId(), type: pnl >= 0 ? "WIN" : "LOSS", amount:pnl, pair, side, ts:Date.now(), note, balance: w.balance + pnl };
    await commit({ ...w, balance: w.balance + pnl, equity: w.equity + pnl, totalPnl: w.totalPnl + pnl }, [tx, ...txRef.current]);
    return tx;
  }, [commit]);

  return { wallet, txHistory, ready, deposit, withdraw, applyPnl };
}

/* ═══════════════════════════════════════════════════════════
   PRICE ENGINE  (Twelve Data WebSocket → Simulation)
═══════════════════════════════════════════════════════════ */
function usePriceEngine(twelveKey) {
  const [prices, setPrices] = useState(() => {
    const out = {};
    Object.entries(INIT_P).forEach(([k, v]) => {
      const p = PAIRS[k];
      out[k] = { bid: v - p.pip*p.sprd/2, ask: v + p.pip*p.sprd/2, mid: v, pct:0, flash:null };
    });
    return out;
  });
  const [candles, setCandles] = useState(() => {
    const out = {};
    Object.keys(PAIRS).forEach(k => out[k] = buildCandles(INIT_P[k]));
    return out;
  });
  const [wsStatus, setWsStatus] = useState("simulation");
  const prevRef = useRef({ ...INIT_P });

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setPrices(prev => {
        const next = {};
        Object.keys(PAIRS).forEach(k => {
          const p = PAIRS[k]; const old = prevRef.current[k];
          const noise = (Math.random() - 0.492) * old * 0.00038;
          const trend = Math.sin(now / 22000) * old * 0.00005;
          const mid = +(old + noise + trend).toFixed(p.d + 1);
          const bid = +(mid - p.pip*p.sprd/2).toFixed(p.d);
          const ask = +(mid + p.pip*p.sprd/2).toFixed(p.d);
          const pct = +(((mid - INIT_P[k]) / INIT_P[k]) * 100).toFixed(2);
          prevRef.current[k] = mid;
          next[k] = { bid, ask, mid, pct, flash: mid > (prev[k]?.mid || mid) ? "up" : "dn" };
        });
        return next;
      });
      setCandles(prev => {
        const next = {};
        Object.keys(PAIRS).forEach(k => {
          const list = [...(prev[k] || [])];
          const last = list[list.length - 1];
          const mid  = prevRef.current[k];
          if (!last) { next[k] = list; return; }
          const ts = Math.floor(now / 1000);
          if (ts - last.time >= 60) {
            list.push({ time:ts, open:mid, high:mid, low:mid, close:mid, vol:0 });
            if (list.length > 3000) list.shift();
          } else {
            list[list.length - 1] = { ...last, close:mid, high:Math.max(last.high, mid), low:Math.min(last.low, mid), vol: last.vol + Math.floor(Math.random() * 60) };
          }
          next[k] = list;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!twelveKey) return;
    let ws = null;
    let reconnectTimer = null;
    let attempts = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${twelveKey}`);
        ws.onopen = () => {
          attempts = 0;
          setWsStatus("live");
          try { ws.send(JSON.stringify({ action:"subscribe", params:{ symbols:"EUR/USD,GBP/USD,USD/JPY,XAU/USD,BTC/USD" } })); } catch {}
        };
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data); if (d.event !== "price") return;
            const id = d.symbol.replace("/",""); const p = PAIRS[id]; if (!p) return;
            prevRef.current[id] = parseFloat(d.price);
          } catch {}
        };
        ws.onerror = () => { try { ws.close(); } catch {} };
        ws.onclose = () => {
          if (cancelled) return;
          setWsStatus("simulation");
          /* Exponential backoff: 2s, 4s, 8s, 16s, max 30s */
          const delay = Math.min(2000 * Math.pow(2, attempts), 30000);
          attempts++;
          reconnectTimer = setTimeout(connect, delay);
        };
      } catch {
        setWsStatus("simulation");
        if (!cancelled) reconnectTimer = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) { ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; try { ws.close(); } catch {} }
    };
  }, [twelveKey]);

  return { prices, candles, wsStatus };
}

/* ═══════════════════════════════════════════════════════════
   AI ENGINE
═══════════════════════════════════════════════════════════ */
function useAI() {
  const [signals, setSignals] = useState({});
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (prices, candles) => {
    setLoading(true);
    try {
      const summary = Object.entries(prices).map(([k, m]) => {
        const cls = (candles[k] || []).slice(-15).map(c => c.close);
        const rsi = calcRSI(cls, 7);
        return `${k}: price=${fmtP(m.mid, k)}, change=${m.pct}%, rsi=${rsi[rsi.length-1]?.toFixed(0)||"—"}`;
      }).join("; ");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1100,
          system:`Institutional forex quant analyst. Return ONLY valid JSON.
Schema: {"signals":{"EURUSD":{"dir":"BUY","conf":78,"strength":72,"sentiment":"BULLISH","entry":1.0855,"sl":1.0822,"tp":1.0910,"rr":"1:2.1","pattern":"Bullish OB","reason":"One sentence","risk":"LOW"}}}
Rules: dir=BUY/SELL/HOLD, conf 0-100, sentiment BULLISH/BEARISH/NEUTRAL, risk LOW/MED/HIGH. Generate signals for ALL 5 pairs.`,
          messages:[{ role:"user", content: `Live data: ${summary}\nReturn JSON only.` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setSignals(parsed.signals || {});
    } catch {
      const fb = {};
      Object.entries(prices).forEach(([k, m]) => {
        const isBull = m.pct >= 0; const p = PAIRS[k];
        fb[k] = {
          dir: Math.abs(m.pct) < 0.1 ? "HOLD" : isBull ? "BUY" : "SELL",
          conf: Math.floor(50 + Math.abs(m.pct) * 15 + Math.random() * 25),
          strength: Math.floor(45 + Math.random() * 50),
          sentiment: isBull ? "BULLISH" : "BEARISH",
          entry: m.mid,
          sl: +(isBull ? m.mid - p.pip*28 : m.mid + p.pip*28).toFixed(p.d),
          tp: +(isBull ? m.mid + p.pip*56 : m.mid - p.pip*56).toFixed(p.d),
          rr:"1:2.0",
          pattern:["Bullish OB","Bearish FVG","BOS","CHoCH","EMA Cross"][Math.floor(Math.random()*5)],
          reason: `${k} showing ${isBull?"bullish":"bearish"} momentum at ${m.pct>=0?"+":""}${m.pct}%. Watch ${isBull?"resistance":"support"}.`,
          risk: Math.abs(m.pct) > 1 ? "HIGH" : Math.abs(m.pct) > 0.5 ? "MED" : "LOW",
        };
      });
      setSignals(fb);
    } finally { setLoading(false); }
  }, []);

  return { signals, loading, generate };
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════════════ */
function useNotify() {
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState([]);
  const timeoutsRef = useRef(new Set());
  /* Clear all timeouts on unmount to prevent memory leaks */
  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout); timeoutsRef.current.clear(); }, []);
  const notify = useCallback((msg, type="info", title="") => {
    const id = genId();
    const item = { id, msg, type, title, ts: Date.now() };
    setToasts(p => [...p.slice(-3), item]);
    setHistory(p => [item, ...p].slice(0, 50));
    const timer = setTimeout(() => {
      setToasts(p => p.filter(t => t.id !== id));
      timeoutsRef.current.delete(timer);
    }, 4500);
    timeoutsRef.current.add(timer);
  }, []);
  return { toasts, history, notify };
}

function Toasts({ toasts, T }) {
  const cols = { success:T.green, error:T.red, info:T.cyan, warning:T.gold };
  return (
    <div style={{ position:"fixed", top:70, right:14, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none", maxWidth:"calc(100vw - 28px)" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ padding:"11px 16px", background:T.card, border:`1px solid ${cols[t.type]||T.cyan}40`, borderLeft:`3px solid ${cols[t.type]||T.cyan}`, borderRadius:10, backdropFilter:"blur(20px)", minWidth:240, maxWidth:340, animation:"apexToast 4.5s ease forwards", pointerEvents:"auto" }}>
          {t.title && <div style={{ color:cols[t.type]||T.cyan, fontSize:11, fontWeight:800, marginBottom:2 }}>{t.title}</div>}
          <div style={{ color:T.text, fontSize:12, fontWeight:500 }}>{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TRADINGVIEW LIGHTWEIGHT CHARTS
═══════════════════════════════════════════════════════════ */
function TVChart({ candles, pair, tf, height = 360, T }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  /* Load TradingView Lightweight Charts from CDN */
  useEffect(() => {
    if (window.LightweightCharts) { setReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js";
    script.async = true;
    script.onload  = () => setReady(true);
    script.onerror = () => setLoadError(true);
    document.head.appendChild(script);
  }, []);

  /* Init chart — runs ONCE when ready (theme color updates handled separately) */
  useEffect(() => {
    if (!ready || !containerRef.current || !window.LightweightCharts) return;

    const chart = window.LightweightCharts.createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height,
      layout: { background:{ type:"solid", color:"transparent" }, textColor:"#3D5878", fontFamily:"'JetBrains Mono', monospace", fontSize:10 },
      grid: { vertLines:{ color:"rgba(0,212,255,.04)" }, horzLines:{ color:"rgba(0,212,255,.04)" } },
      crosshair: { mode: 1, vertLine:{ color:"#00D4FF", width:1, style:3 }, horzLine:{ color:"#00D4FF", width:1, style:3 } },
      rightPriceScale: { borderColor:"rgba(0,212,255,.09)", textColor:"#3D5878" },
      timeScale: { borderColor:"rgba(0,212,255,.09)", timeVisible:true, secondsVisible:false },
      handleScroll:{ mouseWheel:true, pressedMouseMove:true, horzTouchDrag:true, vertTouchDrag:true },
      handleScale: { axisPressedMouseMove:true, mouseWheel:true, pinch:true },
    });
    chartRef.current = chart;

    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor:"#00FF88", downColor:"#FF3366",
      borderUpColor:"#00FF88", borderDownColor:"#FF3366",
      wickUpColor:"#00FF88", wickDownColor:"#FF3366",
    });

    ema9SeriesRef.current  = chart.addLineSeries({ color:"#00D4FF", lineWidth:1, priceLineVisible:false, lastValueVisible:false, title:"EMA 9" });
    ema21SeriesRef.current = chart.addLineSeries({ color:"#7B6EF6", lineWidth:1, priceLineVisible:false, lastValueVisible:false, title:"EMA 21" });

    volSeriesRef.current = chart.addHistogramSeries({
      color:"rgba(0,212,255,.3)", priceFormat:{ type:"volume" }, priceScaleId:"vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins:{ top:0.85, bottom:0 } });

    const ro = new ResizeObserver(([e]) => {
      if (chartRef.current && e.contentRect.width > 0) {
        chartRef.current.applyOptions({ width: e.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); try { chart.remove(); } catch {} chartRef.current = null; };
  }, [ready, height]);

  /* Theme update — apply theme colors via applyOptions instead of re-creating chart */
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: { background:{ type:"solid", color:"transparent" }, textColor:T.muted, fontFamily:"'JetBrains Mono', monospace", fontSize:10 },
      grid: { vertLines:{ color:T.grid }, horzLines:{ color:T.grid } },
      crosshair: { mode:1, vertLine:{ color:T.cyan, width:1, style:3, labelBackgroundColor:T.cyan }, horzLine:{ color:T.cyan, width:1, style:3, labelBackgroundColor:T.cyan } },
      rightPriceScale: { borderColor:T.b, textColor:T.muted },
      timeScale: { borderColor:T.b, timeVisible:true, secondsVisible:false },
    });
    candleSeriesRef.current?.applyOptions({
      upColor:T.green, downColor:T.red,
      borderUpColor:T.green, borderDownColor:T.red,
      wickUpColor:T.green, wickDownColor:T.red,
    });
    ema9SeriesRef.current?.applyOptions({ color:T.cyan });
    ema21SeriesRef.current?.applyOptions({ color:T.purple });
  }, [T.green, T.red, T.cyan, T.purple, T.muted, T.b, T.grid]);

  /* Update data — runs whenever candles or timeframe change */
  useEffect(() => {
    if (!candleSeriesRef.current || !candles?.length) return;
    const aggregated = aggregate(candles, tf);
    const data    = aggregated.map(c => ({ time:c.time, open:c.open, high:c.high, low:c.low, close:c.close }));
    const volData = aggregated.map(c => ({ time:c.time, value:c.vol, color: c.close >= c.open ? T.green + "30" : T.red + "30" }));
    const closes  = aggregated.map(c => c.close);

    const calcEMA = (vals, period) => {
      const k = 2 / (period + 1); let prev = vals[0]; const out = [];
      vals.forEach((v, i) => { prev = i === 0 ? v : v*k + prev*(1-k); out.push(prev); });
      return out;
    };
    const ema9Vals  = calcEMA(closes, 9);
    const ema21Vals = calcEMA(closes, 21);

    try {
      candleSeriesRef.current.setData(data);
      ema9SeriesRef.current.setData(aggregated.map((c, i) => ({ time:c.time, value:ema9Vals[i] })));
      ema21SeriesRef.current.setData(aggregated.map((c, i) => ({ time:c.time, value:ema21Vals[i] })));
      volSeriesRef.current.setData(volData);
    } catch (e) { /* chart may be in transition */ }
  }, [candles, tf, T.green, T.red]);

  if (loadError) return <FallbackChart candles={candles} pair={pair} height={height} T={T} />;

  return (
    <div style={{ position:"relative", width:"100%", height }}>
      {!ready && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:T.dim, fontSize:11 }}>
          <span style={{ display:"inline-block", animation:"apexSpin 1s linear infinite", marginRight:8 }}>◌</span>
          Loading chart…
        </div>
      )}
      <div ref={containerRef} style={{ width:"100%", height:"100%" }} />
    </div>
  );
}

function FallbackChart({ candles, pair, height = 320, T }) {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const PAD = { t:12, r:60, b:24, l:8 };
  const iW  = w - PAD.l - PAD.r;
  const iH  = height - PAD.t - PAD.b;
  const visible = (candles || []).slice(-80);
  if (!visible.length) return <div ref={ref} style={{ width:"100%", height, display:"flex", alignItems:"center", justifyContent:"center", color:T.dim }}>—</div>;

  const minP = Math.min(...visible.map(c=>c.low));
  const maxP = Math.max(...visible.map(c=>c.high));
  const pad  = (maxP - minP) * 0.1 || 0.0001;
  const lo = minP - pad, hi = maxP + pad;
  const scY = p => PAD.t + iH - ((p - lo) / (hi - lo)) * iH;
  const cW  = Math.max(2, Math.floor(iW / visible.length) - 1);
  const scX = i => PAD.l + (i / visible.length) * iW + cW / 2;

  return (
    <div ref={ref} style={{ width:"100%", height }}>
      <svg width={w} height={height} style={{ display:"block" }}>
        {[0,1,2,3,4].map(i => {
          const v = lo + (hi - lo) * i / 4;
          return <g key={i}><line x1={PAD.l} y1={scY(v)} x2={PAD.l+iW} y2={scY(v)} stroke={T.grid} strokeDasharray="3,3"/><text x={PAD.l+iW+4} y={scY(v)+3} fill={T.dim} fontSize={9} fontFamily="monospace">{v.toFixed(PAIRS[pair]?.d||5)}</text></g>;
        })}
        {visible.map((c, i) => {
          const isUp = c.close >= c.open; const col = isUp ? T.green : T.red;
          const cx = scX(i); const top = scY(Math.max(c.open,c.close)); const bot = scY(Math.min(c.open,c.close));
          return <g key={i}><line x1={cx} y1={scY(c.high)} x2={cx} y2={scY(c.low)} stroke={col} strokeWidth={1}/><rect x={cx-cW/2} y={top} width={cW} height={Math.max(1, bot-top)} fill={col}/></g>;
        })}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   UI ATOMS
═══════════════════════════════════════════════════════════ */
const card = (T, x={}) => ({ background:T.card, border:`1px solid ${T.b}`, borderRadius:14, backdropFilter:"blur(24px)", ...x });
const mono = { fontFamily:"'JetBrains Mono',monospace" };
const cond = { fontFamily:"'Barlow Condensed',sans-serif" };

function StrBar({ pct, color }) {
  return <div style={{ height:5, borderRadius:3, background:"rgba(0,212,255,.07)", overflow:"hidden" }}>
    <div style={{ height:"100%", width:`${Math.min(100, pct||0)}%`, background:`linear-gradient(90deg,${color}60,${color})`, transition:"width .8s ease", borderRadius:3 }}/>
  </div>;
}

function Btn({ children, onClick, variant="primary", disabled, fullWidth, style={}, T }) {
  const V = {
    primary: { background:`linear-gradient(135deg,${T.cyan}28,${T.cyan}10)`, border:`1px solid ${T.cyan}60`, color:T.cyan },
    buy:     { background:`linear-gradient(135deg,${T.green}28,${T.green}10)`, border:`1px solid ${T.green}60`, color:T.green },
    sell:    { background:`linear-gradient(135deg,${T.red}28,${T.red}10)`, border:`1px solid ${T.red}60`, color:T.red },
    ghost:   { background:"transparent", border:`1px solid ${T.b}`, color:T.muted },
    danger:  { background:`${T.red}18`, border:`1px solid ${T.red}40`, color:T.red },
    gold:    { background:`linear-gradient(135deg,${T.gold}28,${T.gold}10)`, border:`1px solid ${T.gold}60`, color:T.gold },
  };
  const s = V[variant] || V.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s, borderRadius:8, cursor:disabled?"not-allowed":"pointer", opacity:disabled?.45:1,
      fontWeight:700, padding:"10px 18px", fontSize:13, transition:"all .18s",
      width: fullWidth ? "100%" : "auto", letterSpacing:.3, fontFamily:"inherit", ...style,
    }}>{children}</button>
  );
}

function Input({ label, value, onChange, type="text", placeholder, unit, step, T }) {
  return (
    <div>
      {label && <div style={{ color:T.muted, fontSize:11, marginBottom:5, fontWeight:600, letterSpacing:.5, textTransform:"uppercase" }}>{label}</div>}
      <div style={{ position:"relative" }}>
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} step={step}
          style={{ width:"100%", background:`${T.cyan}08`, border:`1px solid ${T.b}`, color:T.text, borderRadius:9, padding:`10px ${unit?"40px":"13px"} 10px 13px`, fontSize:14, outline:"none", fontFamily:"inherit" }}/>
        {unit && <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:T.muted, fontSize:12, fontWeight:600, ...mono }}>{unit}</span>}
      </div>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, width=460, accent, T }) {
  const acc = accent || T.cyan;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(2,5,14,.88)", backdropFilter:"blur(10px)", padding:"12px" }} onClick={onClose}>
      <div className="apex-modal" style={{ ...card(T, { padding:0, overflow:"hidden", width:"100%", maxWidth:width, animation:"apexSlideIn .28s ease forwards" }) }} onClick={e=>e.stopPropagation()}>
        <div className="apex-modal-head" style={{ padding:"14px 18px", background:`linear-gradient(135deg,${acc}12,transparent)`, borderBottom:`1px solid ${acc}22`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ ...cond, fontSize:18, fontWeight:800, color:acc, letterSpacing:.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</div>
            {subtitle && <div style={{ color:T.muted, fontSize:11, marginTop:2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background:`${T.muted}14`, border:`1px solid ${T.b}`, color:T.muted, width:30, height:30, borderRadius:7, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        <div className="apex-modal-body" style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:12, maxHeight:"calc(100vh - 110px)", overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AUTH SCREEN  (Firebase login)
═══════════════════════════════════════════════════════════ */
function AuthScreen({ auth, T }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      if (mode === "signin") await auth.signIn(email, password);
      else if (mode === "signup") await auth.signUp(email, password, name);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:T.bg, backgroundImage:`linear-gradient(${T.cyan}06 1px,transparent 1px),linear-gradient(90deg,${T.cyan}06 1px,transparent 1px)`, backgroundSize:"48px 48px", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ position:"absolute", left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${T.cyan}40,transparent)`, animation:"apexScan 8s linear infinite" }}/>

      <div style={{ ...card(T, { padding:0, width:"100%", maxWidth:420, overflow:"hidden", animation:"apexSlideIn .4s ease forwards" }) }}>
        <div style={{ padding:"32px 28px 20px", textAlign:"center", borderBottom:`1px solid ${T.b}` }}>
          <div style={{ width:62, height:62, borderRadius:14, background:`linear-gradient(135deg,${T.cyan}40,${T.cyan}15)`, border:`1px solid ${T.cyan}60`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 14px", animation:"apexGlow 2.5s ease infinite" }}>⬡</div>
          <div style={{ ...cond, color:T.cyan, fontSize:30, fontWeight:800, letterSpacing:.8, lineHeight:1 }}>APEX<span style={{ color:T.green }}>FX</span></div>
          <div style={{ color:T.dim, fontSize:10, letterSpacing:3, fontWeight:700, marginTop:5 }}>PRO TRADING SUITE</div>
        </div>

        <div style={{ display:"flex", padding:"14px 20px 0", gap:5 }}>
          {[["signin","Sign In"],["signup","Sign Up"]].map(([k,l]) => (
            <button key={k} onClick={()=>{setMode(k); setErr("");}}
              style={{ flex:1, padding:"9px 0", fontSize:13, background: mode===k ? `${T.cyan}18` : "transparent", border:`1px solid ${mode===k?T.cyan+"40":"transparent"}`, color: mode===k ? T.cyan : T.muted, borderRadius:8, cursor:"pointer", fontWeight:700, fontFamily:"inherit" }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ padding:"18px 22px 22px", display:"flex", flexDirection:"column", gap:13 }}>
          {mode === "signup" && <Input label="Display Name" value={name} onChange={setName} placeholder="Your name" T={T} />}
          <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="trader@example.com" T={T} />
          <Input label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" T={T} />

          {err && <div style={{ padding:"8px 12px", background:`${T.red}14`, border:`1px solid ${T.red}30`, borderRadius:7, color:T.red, fontSize:11.5 }}>⚠ {err}</div>}

          <Btn onClick={submit} variant="primary" disabled={loading} fullWidth style={{ padding:"12px", fontSize:14, marginTop:4 }} T={T}>
            {loading ? <span style={{ display:"inline-block", animation:"apexSpin 1s linear infinite" }}>◌</span> : (mode === "signin" ? "Sign In" : "Create Account")}
          </Btn>

          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0" }}>
            <div style={{ flex:1, height:1, background:T.b }}/>
            <span style={{ color:T.dim, fontSize:10, letterSpacing:1.5 }}>OR</span>
            <div style={{ flex:1, height:1, background:T.b }}/>
          </div>

          <Btn onClick={async()=>{setLoading(true); try { await auth.signInDemo(); } finally { setLoading(false); }}} variant="ghost" disabled={loading} fullWidth style={{ padding:"11px", fontSize:13 }} T={T}>
            ⚡ Try Demo · $10,000 virtual
          </Btn>

          <div style={{ textAlign:"center", color:T.dim, fontSize:10, marginTop:6, lineHeight:1.5 }}>
            Configure Firebase API key in Settings.<br/>
            Demo & local accounts work without configuration.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ORDER MODAL
═══════════════════════════════════════════════════════════ */
function OrderModal({ pair, type, prices, wallet, onClose, onConfirm, T }) {
  const cfg = PAIRS[pair];
  const isBuy = type === "BUY";
  const c    = isBuy ? T.green : T.red;
  /* Fall back to mid → INIT_P so we never compute SL/TP from zero/undefined */
  const px   = (isBuy ? prices[pair]?.ask : prices[pair]?.bid) || prices[pair]?.mid || INIT_P[pair];

  const [units, setUnits] = useState(String(DEFAULT_UNITS[pair] || 10000));
  const [leverage, setLeverage] = useState("100");
  const [slV, setSlV] = useState(() => String((isBuy ? px - cfg.pip*30 : px + cfg.pip*30).toFixed(cfg.d)));
  const [tpV, setTpV] = useState(() => String((isBuy ? px + cfg.pip*60 : px - cfg.pip*60).toFixed(cfg.d)));
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  const u = parseFloat(units) || 0;
  const lev = parseFloat(leverage) || 1;
  const margin = calcMargin(pair, u, px, lev);
  const riskPips = Math.abs(px - parseFloat(slV)) / cfg.pip;
  const tpPips   = Math.abs(px - parseFloat(tpV)) / cfg.pip;
  const rr = riskPips ? (tpPips / riskPips).toFixed(2) : "—";
  /* Use real PnL formula; sl/tp risk shown as USD impact */
  const slPnL = calcPnL(pair, type, px, parseFloat(slV) || px, u);
  const tpPnL = calcPnL(pair, type, px, parseFloat(tpV) || px, u);
  const riskUSD   = Math.abs(slPnL.usd);
  const profitUSD = Math.abs(tpPnL.usd);

  const handleSubmit = async () => {
    setErr("");
    if (!u || u <= 0)        return setErr("Units must be greater than 0");
    if (!px || px <= 0)      return setErr("Invalid price (no live feed)");
    if (margin > wallet.balance) return setErr(`Insufficient margin: $${margin.toFixed(2)} required, $${wallet.balance.toFixed(2)} available`);
    if (isBuy && parseFloat(slV) >= px) return setErr("Buy stop-loss must be below entry");
    if (isBuy && parseFloat(tpV) <= px) return setErr("Buy take-profit must be above entry");
    if (!isBuy && parseFloat(slV) <= px) return setErr("Sell stop-loss must be above entry");
    if (!isBuy && parseFloat(tpV) >= px) return setErr("Sell take-profit must be below entry");
    setBusy(true);
    try {
      await onConfirm({ pair, type, units:u, entry:px, sl:parseFloat(slV), tp:parseFloat(tpV), leverage:lev, margin });
    } catch (e) { setErr(e.message || "Order failed"); setBusy(false); }
  };

  return (
    <Modal title={`${type} ORDER`} subtitle={`${cfg.n} · Market Execution`} onClose={onClose} accent={c} width={480} T={T}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ padding:"12px 14px", background:`${T.muted}10`, borderRadius:9, textAlign:"center" }}>
          <div style={{ color:T.dim, fontSize:9, letterSpacing:1 }}>{isBuy ? "BUY @ ASK" : "SELL @ BID"}</div>
          <div style={{ ...mono, color:c, fontSize:22, fontWeight:700, marginTop:3 }}>{fmtP(px, pair)}</div>
        </div>
        <div style={{ padding:"12px 14px", background:`${T.muted}10`, borderRadius:9, textAlign:"center" }}>
          <div style={{ color:T.dim, fontSize:9, letterSpacing:1 }}>SPREAD</div>
          <div style={{ ...mono, color:T.muted, fontSize:22, fontWeight:700, marginTop:3 }}>{cfg.sprd} pip</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <Input label="Units" value={units} onChange={setUnits} type="number" T={T} />
        <div>
          <div style={{ color:T.muted, fontSize:11, marginBottom:5, fontWeight:600, letterSpacing:.5, textTransform:"uppercase" }}>Leverage</div>
          <div style={{ display:"flex", gap:4 }}>
            {["10","50","100","500"].map(v => (
              <button key={v} onClick={()=>setLeverage(v)} style={{ flex:1, padding:"10px 0", fontSize:11, background: leverage===v ? `${c}18` : `${T.muted}10`, border:`1px solid ${leverage===v?c+"50":T.b}`, color: leverage===v ? c : T.muted, borderRadius:7, cursor:"pointer", fontWeight:700, fontFamily:"inherit" }}>1:{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:5 }}>
        {(QUICK_UNITS[pair] || ["1000","10000","100000"]).map(v => {
          const labelMap = { "1000":"0.01", "10000":"0.1", "100000":"1", "1":"1 oz", "10":"10 oz", "100":"100 oz", "0.01":"0.01 ฿", "0.1":"0.1 ฿", "1.0":"1 ฿", "1":"1 ฿" };
          return (
            <button key={v} onClick={()=>setUnits(v)} style={{ flex:1, padding:"6px 0", fontSize:10, background:`${T.muted}10`, border:`1px solid ${units===v?c+"40":T.b}`, color: units===v ? c : T.muted, borderRadius:6, cursor:"pointer", fontWeight:700, fontFamily:"inherit" }}>
              {labelMap[v] || v}{pair.startsWith("EUR")||pair.startsWith("GBP")||pair.startsWith("USD") ? " lot" : ""}
            </button>
          );
        })}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <Input label="Stop Loss" value={slV} onChange={setSlV} type="number" step={cfg.pip} T={T} />
        <Input label="Take Profit" value={tpV} onChange={setTpV} type="number" step={cfg.pip} T={T} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
        {[["RISK","$"+riskUSD.toFixed(2),T.red],["TARGET","$"+profitUSD.toFixed(2),T.green],["R:R","1:"+rr,T.gold],["MARGIN","$"+margin.toFixed(2),T.purple]].map(([l,v,col])=>(
          <div key={l} style={{ padding:"7px 8px", background:`${T.muted}10`, borderRadius:7, textAlign:"center" }}>
            <div style={{ color:T.dim, fontSize:8.5, letterSpacing:.8, marginBottom:2 }}>{l}</div>
            <div style={{ ...mono, color:col, fontSize:11, fontWeight:700 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:"8px 12px", background:`${T.muted}08`, borderRadius:7, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ color:T.muted, fontSize:11 }}>Available balance:</span>
        <span style={{ ...mono, color:T.cyan, fontWeight:700, fontSize:13 }}>${wallet.balance.toFixed(2)}</span>
      </div>

      {err && <div style={{ padding:"8px 12px", background:`${T.red}14`, border:`1px solid ${T.red}30`, borderRadius:7, color:T.red, fontSize:11.5 }}>⚠ {err}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <Btn onClick={onClose} variant="ghost" T={T}>Cancel</Btn>
        <Btn onClick={handleSubmit} variant={isBuy?"buy":"sell"} disabled={busy} T={T}>
          {busy ? <span style={{ display:"inline-block", animation:"apexSpin 1s linear infinite" }}>◌</span> : `${isBuy ? "▲ BUY" : "▼ SELL"} ${u.toLocaleString()}`}
        </Btn>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   WALLET MODAL
═══════════════════════════════════════════════════════════ */
function WalletModal({ wallet, txHistory, onDeposit, onWithdraw, onClose, T }) {
  const [tab, setTab] = useState("overview");
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState("Card");
  const [msg, setMsg] = useState({ text:"", ok:true });

  const handle = async (action) => {
    try { await action(amt, method); setMsg({ text: `${action === onDeposit ? "Deposited" : "Withdrew"} $${parseFloat(amt).toFixed(2)}`, ok:true }); setAmt(""); }
    catch(e){ setMsg({ text:e.message, ok:false }); }
  };

  const tradePnl = txHistory.filter(t => t.type === "WIN" || t.type === "LOSS").reduce((s,t)=>s+t.amount, 0);
  const txTypes = { DEPOSIT:"↓", WITHDRAW:"↑", WIN:"▲", LOSS:"▼" };
  const txCols  = { DEPOSIT:T.green, WITHDRAW:T.muted, WIN:T.green, LOSS:T.red };

  return (
    <Modal title="💼 Wallet & Funds" subtitle="Demo trading balance" onClose={onClose} accent={T.gold} width={520} T={T}>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        {["overview","deposit","withdraw","history"].map(t => (
          <button key={t} onClick={()=>{ setTab(t); setMsg({text:"",ok:true}); }} style={{ flex:"1 1 auto", padding:"6px 14px", fontSize:11, background: tab===t ? `${T.gold}18` : `${T.muted}10`, border:`1px solid ${tab===t?T.gold+"40":T.b}`, color: tab===t ? T.gold : T.muted, borderRadius:7, cursor:"pointer", fontWeight:700, textTransform:"capitalize", fontFamily:"inherit" }}>{t}</button>
        ))}
      </div>

      {tab === "overview" && <>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
          {[
            ["Balance",    fmtMoney(wallet.balance, false),     T.cyan,   "Available cash"],
            ["Equity",     fmtMoney(wallet.equity, false),      T.text,   "Bal + floating P&L"],
            ["Deposited",  fmtMoney(wallet.deposits, false),    T.green,  "Total deposited"],
            ["Withdrawn",  fmtMoney(wallet.withdrawals, false), T.muted,  "Total withdrawn"],
          ].map(([l,v,c,sub]) => (
            <div key={l} style={{ padding:14, background:`${T.muted}10`, borderRadius:10 }}>
              <div style={{ color:T.dim, fontSize:10, letterSpacing:1, marginBottom:5 }}>{l.toUpperCase()}</div>
              <div style={{ ...mono, color:c, fontSize:21, fontWeight:700 }}>{v}</div>
              <div style={{ color:T.muted, fontSize:10, marginTop:3 }}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{ padding:13, background:`${T.gold}10`, borderRadius:9, border:`1px solid ${T.gold}25` }}>
          <div style={{ color:T.dim, fontSize:10, marginBottom:4 }}>TOTAL TRADING P&L</div>
          <div style={{ ...mono, color: tradePnl >= 0 ? T.green : T.red, fontSize:22, fontWeight:700 }}>{fmtMoney(tradePnl)}</div>
        </div>
      </>}

      {(tab === "deposit" || tab === "withdraw") && <>
        <Input label={`${tab === "deposit" ? "Deposit" : "Withdrawal"} Amount`} value={amt} onChange={setAmt} type="number" placeholder="0.00" unit="USD" T={T} />
        <div>
          <div style={{ color:T.muted, fontSize:11, marginBottom:7, fontWeight:600, letterSpacing:.5, textTransform:"uppercase" }}>Method</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {["Card","Bank","Crypto","PayPal"].map(m => (
              <button key={m} onClick={()=>setMethod(m)} style={{ flex:"1 1 70px", padding:"7px 0", fontSize:11, background: method===m ? `${T.gold}18` : `${T.muted}10`, border:`1px solid ${method===m?T.gold+"40":T.b}`, color: method===m ? T.gold : T.muted, borderRadius:7, cursor:"pointer", fontWeight:700, fontFamily:"inherit" }}>{m}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:5 }}>
          {[100,500,1000,5000].map(v => (
            <button key={v} onClick={()=>setAmt(String(v))} style={{ flex:1, padding:"6px 0", fontSize:11, background:`${T.muted}10`, border:`1px solid ${T.b}`, color:T.muted, borderRadius:7, cursor:"pointer", fontWeight:600, fontFamily:"inherit" }}>${v >= 1000 ? (v/1000)+"K" : v}</button>
          ))}
        </div>
        {msg.text && <div style={{ padding:"8px 12px", background: msg.ok ? `${T.green}14` : `${T.red}14`, border:`1px solid ${msg.ok?T.green+"30":T.red+"30"}`, borderRadius:7, color: msg.ok ? T.green : T.red, fontSize:12 }}>{msg.text}</div>}
        <Btn onClick={()=>handle(tab === "deposit" ? onDeposit : onWithdraw)} variant={tab === "deposit" ? "buy" : "danger"} fullWidth T={T}>
          {tab === "deposit" ? "↓ Deposit Funds" : "↑ Withdraw Funds"}
        </Btn>
      </>}

      {tab === "history" && (
        <div style={{ display:"flex", flexDirection:"column", gap:5, maxHeight:340 }}>
          {!txHistory.length ? <div style={{ color:T.dim, textAlign:"center", padding:20, fontSize:12 }}>No transactions yet</div>
          : txHistory.slice(0,30).map(tx => {
              const col = txCols[tx.type] || T.text;
              return (
                <div key={tx.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", background:`${T.muted}10`, borderRadius:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, minWidth:0 }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:`${col}14`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:col, flexShrink:0 }}>{txTypes[tx.type]}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ color:T.text, fontSize:12, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{tx.type}{tx.pair?` · ${tx.pair}`:""}{tx.method?` · ${tx.method}`:""}</div>
                      <div style={{ color:T.muted, fontSize:10 }}>{fmtDate(tx.ts)} · {fmtTime(tx.ts)}</div>
                    </div>
                  </div>
                  <div style={{ ...mono, color:col, fontWeight:700, fontSize:13, flexShrink:0 }}>{fmtMoney(tx.amount)}</div>
                </div>
              );
            })}
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS MODAL
═══════════════════════════════════════════════════════════ */
function SettingsModal({ config, setConfig, user, theme, setTheme, onSignOut, onClose, T }) {
  const [local, setLocal] = useState(config || { firebaseApiKey:"", twelveKey:"" });
  return (
    <Modal title="⚙ Settings" subtitle="API keys, theme & account" onClose={onClose} width={500} T={T}>
      <div style={{ padding:14, background:`${T.cyan}10`, borderRadius:10, border:`1px solid ${T.cyan}25`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${T.cyan},${T.cyan}80)`, display:"flex", alignItems:"center", justifyContent:"center", color:T.bg, fontSize:18, fontWeight:800, flexShrink:0 }}>{(user?.displayName||"?")[0].toUpperCase()}</div>
          <div style={{ minWidth:0 }}>
            <div style={{ color:T.text, fontWeight:700, fontSize:14 }}>{user?.displayName}</div>
            <div style={{ color:T.muted, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200 }}>{user?.email}</div>
            {user?.isAnon && <span style={{ display:"inline-block", marginTop:2, padding:"1px 6px", background:`${T.gold}18`, color:T.gold, border:`1px solid ${T.gold}30`, borderRadius:4, fontSize:9, fontWeight:700 }}>DEMO</span>}
          </div>
        </div>
        <Btn onClick={onSignOut} variant="danger" style={{ padding:"7px 13px", fontSize:11.5 }} T={T}>Sign Out</Btn>
      </div>

      <div style={{ padding:14, background:`${T.purple}10`, borderRadius:10, border:`1px solid ${T.purple}25` }}>
        <div style={{ color:T.purple, fontSize:11, fontWeight:700, letterSpacing:1.5, marginBottom:10 }}>🎨 APPEARANCE</div>
        <div style={{ display:"flex", gap:8 }}>
          {[["dark","Dark Mode","🌙"],["light","Light Mode","☀️"]].map(([k,l,i]) => (
            <button key={k} onClick={()=>setTheme(k)} style={{ flex:1, padding:"11px", fontSize:12, background: theme===k ? `${T.cyan}18` : `${T.muted}10`, border:`1px solid ${theme===k?T.cyan+"40":T.b}`, color: theme===k ? T.cyan : T.muted, borderRadius:9, cursor:"pointer", fontWeight:700, fontFamily:"inherit", display:"flex", flexDirection:"column", gap:4, alignItems:"center" }}>
              <span style={{ fontSize:18 }}>{i}</span>
              <span>{l}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:14, background:`${T.gold}08`, borderRadius:10, border:`1px solid ${T.gold}22` }}>
        <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:1.5, marginBottom:10 }}>🔥 FIREBASE — AUTH & DATABASE</div>
        <Input label="Firebase API Key" value={local.firebaseApiKey} onChange={v=>setLocal(x=>({...x, firebaseApiKey:v}))} placeholder="AIzaSy..." T={T} />
        <div style={{ color:T.dim, fontSize:10, marginTop:6 }}>Enables real Firebase auth. Get from Firebase Console → Project Settings.</div>
      </div>

      <div style={{ padding:14, background:`${T.cyan}08`, borderRadius:10, border:`1px solid ${T.cyan}22` }}>
        <div style={{ color:T.cyan, fontSize:11, fontWeight:700, letterSpacing:1.5, marginBottom:10 }}>📡 TWELVE DATA — LIVE FEED</div>
        <Input label="API Key" value={local.twelveKey} onChange={v=>setLocal(x=>({...x, twelveKey:v}))} placeholder="Free key from twelvedata.com" T={T} />
        <div style={{ color:T.dim, fontSize:10, marginTop:6 }}>Free tier supports all 5 pairs via WebSocket.</div>
      </div>

      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <Btn onClick={onClose} variant="ghost" T={T}>Cancel</Btn>
        <Btn onClick={()=>{ setConfig(local); onClose(); }} variant="primary" T={T}>Save & Apply</Btn>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   PRICE TICKER
═══════════════════════════════════════════════════════════ */
function PriceTicker({ prices, onClick, selected, watchlist, T }) {
  const list = watchlist?.length ? watchlist : Object.keys(PAIRS);
  return (
    <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:2 }}>
      {list.map(id => {
        const cfg = PAIRS[id]; if (!cfg) return null;
        const m = prices[id] || {}; const up = m.pct >= 0; const sel = selected === id;
        return (
          <div key={id} onClick={()=>onClick?.(id)}
            style={{ ...card(T, { padding:"10px 13px", minWidth:138, flexShrink:0, cursor:"pointer", border:`1px solid ${sel?cfg.c+"60":m.flash==="up"?T.green+"40":m.flash==="dn"?T.red+"40":T.b}` }) }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <div style={{ color:cfg.c, fontSize:9, fontWeight:700, letterSpacing:1.3 }}>{cfg.n}</div>
              <span style={{ ...mono, background:up?T.green+"15":T.red+"15", color:up?T.green:T.red, padding:"1px 6px", borderRadius:4, fontSize:9, fontWeight:700 }}>{up?"+":""}{m.pct}%</span>
            </div>
            <div style={{ ...mono, fontSize:14, fontWeight:700, color:T.text, marginBottom:4 }}>{fmtP(m.mid, id)}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:3 }}>
              <div style={{ background:T.red+"10", borderRadius:4, padding:"3px 5px", textAlign:"center" }}>
                <div style={{ color:T.red, fontSize:8, opacity:.7 }}>BID</div>
                <div style={{ ...mono, color:T.red, fontSize:9.5, fontWeight:700 }}>{fmtP(m.bid, id)}</div>
              </div>
              <div style={{ background:T.green+"10", borderRadius:4, padding:"3px 5px", textAlign:"center" }}>
                <div style={{ color:T.green, fontSize:8, opacity:.7 }}>ASK</div>
                <div style={{ ...mono, color:T.green, fontSize:9.5, fontWeight:700 }}>{fmtP(m.ask, id)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   QUICK TRADE PANEL
═══════════════════════════════════════════════════════════ */
function QuickTrade({ prices, candles, pair, setPair, onOrder, signal, T }) {
  const cfg = PAIRS[pair]; const m = prices[pair] || {};
  const closes = (candles[pair] || []).slice(-15).map(c => c.close);
  const rsiArr = calcRSI(closes, 7);
  const rsi    = rsiArr[rsiArr.length - 1] || 50;
  const sig    = signal?.[pair];

  return (
    <div style={card(T, { padding:0, overflow:"hidden" })}>
      <div style={{ padding:"11px 13px", borderBottom:`1px solid ${T.b}`, background:`${T.muted}08` }}>
        <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:8 }}>QUICK TRADE</div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {Object.entries(PAIRS).map(([id, c]) => (
            <button key={id} onClick={()=>setPair(id)} style={{ padding:"4px 8px", fontSize:9, background: pair===id ? `${c.c}18` : `${T.muted}10`, border:`1px solid ${pair===id?c.c+"50":T.b}`, color: pair===id ? c.c : T.muted, borderRadius:5, cursor:"pointer", fontWeight:700, fontFamily:"inherit" }}>
              {c.n.split("/")[0]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"14px 13px 11px", borderBottom:`1px solid ${T.b}` }}>
        <div style={{ ...cond, color:cfg.c, fontSize:13, fontWeight:700, marginBottom:10 }}>{cfg.n}</div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:6, alignItems:"center", marginBottom:11 }}>
          <div style={{ textAlign:"center", padding:"10px 6px", background:`${T.red}10`, borderRadius:8, border:`1px solid ${T.red}25` }}>
            <div style={{ color:T.red, fontSize:8.5, fontWeight:700, letterSpacing:1.8, marginBottom:3 }}>BID · SELL</div>
            <div style={{ ...mono, fontSize: m.bid > 999 ? 16 : 19, fontWeight:700, color:T.red }}>{fmtP(m.bid, pair)}</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ color:T.dim, fontSize:9 }}>SPRD</div>
            <div style={{ ...mono, color:T.muted, fontSize:11, fontWeight:600 }}>{cfg.sprd}</div>
          </div>
          <div style={{ textAlign:"center", padding:"10px 6px", background:`${T.green}10`, borderRadius:8, border:`1px solid ${T.green}25` }}>
            <div style={{ color:T.green, fontSize:8.5, fontWeight:700, letterSpacing:1.8, marginBottom:3 }}>ASK · BUY</div>
            <div style={{ ...mono, fontSize: m.ask > 999 ? 16 : 19, fontWeight:700, color:T.green }}>{fmtP(m.ask, pair)}</div>
          </div>
        </div>

        {sig && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 10px", background: sig.dir==="BUY" ? `${T.green}08` : sig.dir==="SELL" ? `${T.red}08` : `${T.gold}08`, borderRadius:7, marginBottom:11, border:`1px solid ${sig.dir==="BUY"?T.green+"25":sig.dir==="SELL"?T.red+"25":T.gold+"25"}` }}>
            <div>
              <div style={{ color:T.dim, fontSize:8.5, letterSpacing:1.5 }}>AI SIGNAL</div>
              <div style={{ color: sig.dir==="BUY"?T.green:sig.dir==="SELL"?T.red:T.gold, fontSize:13, fontWeight:800 }}>{sig.dir}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:T.dim, fontSize:8.5, letterSpacing:1.5 }}>CONFIDENCE</div>
              <div style={{ ...mono, color:T.cyan, fontSize:13, fontWeight:700 }}>{sig.conf}%</div>
            </div>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
          <button onClick={()=>onOrder(pair, "SELL", m.bid)} style={{ padding:"12px 6px", background:`linear-gradient(135deg,${T.red}30,${T.red}15)`, border:`1px solid ${T.red}50`, color:T.red, borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:14, letterSpacing:1.4, fontFamily:"inherit" }}>▼ SELL</button>
          <button onClick={()=>onOrder(pair, "BUY",  m.ask)} style={{ padding:"12px 6px", background:`linear-gradient(135deg,${T.green}30,${T.green}15)`, border:`1px solid ${T.green}50`, color:T.green, borderRadius:9, cursor:"pointer", fontWeight:800, fontSize:14, letterSpacing:1.4, fontFamily:"inherit" }}>▲ BUY</button>
        </div>
      </div>

      <div style={{ padding:"10px 13px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
        {[
          ["RSI", rsi.toFixed(0), rsi > 65 ? T.red : rsi < 35 ? T.gold : T.green],
          ["24h", (m.pct >= 0 ? "+" : "") + m.pct + "%", m.pct >= 0 ? T.green : T.red],
        ].map(([l,v,c]) => (
          <div key={l} style={{ padding:"6px 9px", background:`${T.muted}08`, borderRadius:6 }}>
            <div style={{ color:T.dim, fontSize:9, letterSpacing:1 }}>{l}</div>
            <div style={{ ...mono, color:c, fontSize:11, fontWeight:700 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   POSITIONS LIST
═══════════════════════════════════════════════════════════ */
function PositionsList({ positions, prices, onClose, isMobile, T }) {
  if (!positions.length) return <div style={{ color:T.dim, fontSize:13, textAlign:"center", padding:24 }}>No open positions</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {positions.map(pos => {
        const m = prices[pos.pair] || {}; const cfg = PAIRS[pos.pair];
        if (!cfg) return null;
        const isBuy = pos.type === "BUY";
        const curr  = isBuy ? (m.bid || pos.entry) : (m.ask || pos.entry);
        const { pips, usd:pnl } = calcPnL(pos.pair, pos.type, pos.entry, curr, pos.units);
        const pnlPos = pnl >= 0;

        if (isMobile) {
          return (
            <div key={pos.id} style={{ padding:11, borderRadius:10, background: pnlPos ? `${T.green}08` : `${T.red}08`, border:`1px solid ${pnlPos?T.green+"25":T.red+"25"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:26, height:26, borderRadius:6, background: pnlPos ? `${T.green}20` : `${T.red}20`, display:"flex", alignItems:"center", justifyContent:"center", color: isBuy?T.green:T.red, fontWeight:800, fontSize:12 }}>{isBuy?"▲":"▼"}</div>
                  <div>
                    <div style={{ ...cond, color:T.text, fontWeight:700, fontSize:13 }}>{cfg.n}</div>
                    <div style={{ ...mono, color:T.muted, fontSize:9.5 }}>{pos.units?.toLocaleString()} u · 1:{pos.leverage||100}</div>
                  </div>
                </div>
                <div style={{ ...mono, color: pnlPos?T.green:T.red, fontSize:15, fontWeight:700 }}>{fmtMoney(pnl)}</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:5, marginBottom:7 }}>
                <div><div style={{ color:T.dim, fontSize:9 }}>ENTRY</div><div style={{ ...mono, color:T.muted, fontSize:11 }}>{fmtP(pos.entry, pos.pair)}</div></div>
                <div><div style={{ color:T.dim, fontSize:9 }}>NOW</div><div style={{ ...mono, color:cfg.c, fontSize:11 }}>{fmtP(curr, pos.pair)}</div></div>
                <div><div style={{ color:T.dim, fontSize:9 }}>PIPS</div><div style={{ ...mono, color: pnlPos?T.green:T.red, fontSize:11 }}>{pips>=0?"+":""}{pips.toFixed(1)}</div></div>
              </div>
              <Btn onClick={()=>onClose(pos)} variant="danger" fullWidth style={{ padding:"6px", fontSize:11 }} T={T}>CLOSE POSITION</Btn>
            </div>
          );
        }

        return (
          <div key={pos.id} style={{ display:"grid", gridTemplateColumns:"38px 1fr 90px 80px 80px 100px 90px", gap:10, alignItems:"center", padding:"10px 13px", borderRadius:10, background: pnlPos ? `${T.green}08` : `${T.red}08`, border:`1px solid ${pnlPos?T.green+"20":T.red+"20"}` }}>
            <div style={{ width:30, height:30, borderRadius:7, background: pnlPos?`${T.green}20`:`${T.red}20`, display:"flex", alignItems:"center", justifyContent:"center", color: isBuy?T.green:T.red, fontWeight:800, fontSize:12 }}>{isBuy?"▲":"▼"}</div>
            <div>
              <div style={{ ...cond, color:T.text, fontWeight:700, fontSize:14 }}>{cfg.n}</div>
              <div style={{ ...mono, color:T.muted, fontSize:10 }}>{pos.units.toLocaleString()} u · 1:{pos.leverage} · @ {fmtP(pos.entry, pos.pair)}</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:T.dim, fontSize:9 }}>NOW</div>
              <div style={{ ...mono, color:cfg.c, fontSize:12, fontWeight:600 }}>{fmtP(curr, pos.pair)}</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:T.dim, fontSize:9 }}>PIPS</div>
              <div style={{ ...mono, color: pnlPos?T.green:T.red, fontSize:12, fontWeight:600 }}>{pips>=0?"+":""}{pips.toFixed(1)}</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:T.dim, fontSize:9 }}>S/L</div>
              <div style={{ ...mono, color:T.red, fontSize:11 }}>{pos.sl ? fmtP(pos.sl, pos.pair) : "—"}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:T.dim, fontSize:9 }}>P&L</div>
              <div style={{ ...mono, color: pnlPos?T.green:T.red, fontSize:14, fontWeight:700 }}>{fmtMoney(pnl)}</div>
            </div>
            <Btn onClick={()=>onClose(pos)} variant="danger" style={{ padding:"5px 11px", fontSize:11 }} T={T}>CLOSE</Btn>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AI SIGNALS PANEL
═══════════════════════════════════════════════════════════ */
function AISignalsPanel({ signals, loading, onGenerate, onTrade, isMobile, T }) {
  return (
    <div style={card(T, { padding:14 })}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:13, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2 }}>🧠 AI TRADING SIGNALS</div>
          <div style={{ color:T.muted, fontSize:11, marginTop:2 }}>Multi-pair institutional analysis</div>
        </div>
        <Btn onClick={onGenerate} variant="primary" disabled={loading} style={{ padding:"8px 18px", fontSize:12 }} T={T}>
          {loading ? <><span style={{ display:"inline-block", animation:"apexSpin 1s linear infinite", marginRight:6 }}>◌</span>Analyzing…</> : "⚡ Generate Signals"}
        </Btn>
      </div>

      {loading && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap:10 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height:130, borderRadius:10, background:`linear-gradient(90deg,${T.cyan}05 25%,${T.cyan}15 50%,${T.cyan}05 75%)`, backgroundSize:"200% 100%", animation:"apexShimmer 1.5s infinite" }}/>
          ))}
        </div>
      )}

      {!loading && !Object.keys(signals).length && (
        <div style={{ padding:34, textAlign:"center", background:`${T.muted}08`, borderRadius:10 }}>
          <div style={{ fontSize:38, opacity:.18, marginBottom:8 }}>🧠</div>
          <div style={{ color:T.muted, fontSize:13 }}>Click Generate to analyze the market</div>
        </div>
      )}

      {!loading && Object.keys(signals).length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap:10 }}>
          {Object.entries(signals).map(([id, sig]) => {
            const cfg = PAIRS[id]; if (!cfg || !sig) return null;
            const dirCol = sig.dir === "BUY" ? T.green : sig.dir === "SELL" ? T.red : T.gold;
            const riskCol = sig.risk === "HIGH" ? T.red : sig.risk === "MED" ? T.gold : T.green;
            return (
              <div key={id} style={{ padding:13, background:`linear-gradient(135deg,${dirCol}08,transparent)`, border:`1px solid ${dirCol}30`, borderRadius:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                  <div>
                    <div style={{ ...cond, color:T.text, fontSize:16, fontWeight:800, letterSpacing:.5 }}>{cfg.n}</div>
                    <div style={{ color:T.muted, fontSize:10 }}>{sig.pattern}</div>
                  </div>
                  <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                    <span style={{ background:`${riskCol}18`, color:riskCol, border:`1px solid ${riskCol}30`, borderRadius:4, padding:"2px 6px", fontSize:9, fontWeight:700 }}>{sig.risk} RISK</span>
                    <span style={{ background:`${dirCol}18`, color:dirCol, border:`1px solid ${dirCol}40`, borderRadius:6, padding:"4px 11px", fontSize:13, fontWeight:800, letterSpacing:1.5 }}>{sig.dir}</span>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5, marginBottom:9 }}>
                  {[["ENTRY", fmtP(sig.entry, id), T.text],["S/L", fmtP(sig.sl, id), T.red],["T/P", fmtP(sig.tp, id), T.green]].map(([l,v,c]) => (
                    <div key={l} style={{ background:`${T.muted}10`, borderRadius:6, padding:"5px 7px" }}>
                      <div style={{ color:T.dim, fontSize:8, letterSpacing:.8 }}>{l}</div>
                      <div style={{ ...mono, color:c, fontSize:10.5, fontWeight:600 }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:9 }}>
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ color:T.dim, fontSize:9 }}>CONFIDENCE</span>
                      <span style={{ ...mono, color:T.cyan, fontSize:10, fontWeight:700 }}>{sig.conf}%</span>
                    </div>
                    <StrBar pct={sig.conf} color={T.cyan}/>
                  </div>
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ color:T.dim, fontSize:9 }}>STRENGTH</span>
                      <span style={{ ...mono, color:dirCol, fontSize:10, fontWeight:700 }}>{sig.strength}%</span>
                    </div>
                    <StrBar pct={sig.strength} color={dirCol}/>
                  </div>
                </div>

                <div style={{ padding:"6px 9px", background:`${T.muted}10`, borderRadius:6, borderLeft:`2px solid ${dirCol}50`, marginBottom:9 }}>
                  <div style={{ color:T.muted, fontSize:10.5, lineHeight:1.5 }}>{sig.reason}</div>
                </div>

                {sig.dir !== "HOLD" && (
                  <Btn onClick={()=>onTrade(id, sig.dir)} variant={sig.dir === "BUY" ? "buy" : "sell"} fullWidth style={{ padding:"7px", fontSize:12 }} T={T}>
                    Execute {sig.dir} →
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ECONOMIC CALENDAR
═══════════════════════════════════════════════════════════ */
const ECON_DATA = [
  { time:"08:30", ccy:"USD", event:"Non-Farm Payrolls",          impact:"high",   fore:"185K",  act:"203K", prev:"175K"  },
  { time:"10:00", ccy:"USD", event:"ISM Manufacturing PMI",      impact:"medium", fore:"48.5",  act:"—",    prev:"47.8"  },
  { time:"12:30", ccy:"EUR", event:"ECB Rate Decision",          impact:"high",   fore:"4.50%", act:"—",    prev:"4.50%" },
  { time:"14:00", ccy:"GBP", event:"BoE Governor Speech",        impact:"medium", fore:"—",     act:"—",    prev:"—"     },
  { time:"15:30", ccy:"USD", event:"Core CPI m/m",               impact:"high",   fore:"0.3%",  act:"—",    prev:"0.4%"  },
  { time:"18:00", ccy:"JPY", event:"Tankan Manufacturers",       impact:"medium", fore:"12",    act:"—",    prev:"13"    },
  { time:"20:30", ccy:"USD", event:"FOMC Meeting Minutes",       impact:"high",   fore:"—",     act:"—",    prev:"—"     },
];

function EconomicCalendar({ T, isMobile }) {
  const ic = { high:T.red, medium:"#FF8C00", low:T.gold };
  return (
    <div style={card(T, { padding:14 })}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:11 }}>
        <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2 }}>📅 ECONOMIC CALENDAR</div>
        <div style={{ display:"flex", gap:11 }}>
          {Object.entries(ic).map(([k,v]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:v, boxShadow:`0 0 6px ${v}` }}/>
              <span style={{ color:v, fontSize:9.5, fontWeight:700, textTransform:"capitalize" }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {ECON_DATA.map((n, i) => {
          const c = ic[n.impact];
          if (isMobile) {
            return (
              <div key={i} style={{ padding:"10px 12px", borderRadius:8, background:`${c}08`, borderLeft:`3px solid ${c}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ ...mono, color:T.muted, fontSize:11, fontWeight:600 }}>{n.time}</span>
                    <span style={{ background:`${c}18`, color:c, borderRadius:4, padding:"2px 6px", fontSize:9, fontWeight:700 }}>{n.ccy}</span>
                  </div>
                  <div style={{ color: n.act === "—" ? T.dim : T.green, ...mono, fontSize:11, fontWeight:700 }}>{n.act}</div>
                </div>
                <div style={{ color:T.text, fontSize:12, fontWeight:500 }}>{n.event}</div>
                <div style={{ display:"flex", gap:10, marginTop:3 }}>
                  <span style={{ color:T.dim, fontSize:9.5 }}>F: <span style={{ color:T.muted, ...mono }}>{n.fore}</span></span>
                  <span style={{ color:T.dim, fontSize:9.5 }}>P: <span style={{ color:T.muted, ...mono }}>{n.prev}</span></span>
                </div>
              </div>
            );
          }
          return (
            <div key={i} style={{ padding:"10px 14px", borderRadius:8, background:`${c}08`, borderLeft:`3px solid ${c}`, display:"grid", gridTemplateColumns:"68px 52px 1fr 95px 85px 85px", gap:8, alignItems:"center" }}>
              <div style={{ color:T.text, fontSize:12, fontWeight:600, ...mono }}>{n.time}</div>
              <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"2px 5px", borderRadius:5, background:`${c}18`, color:c, fontSize:10, fontWeight:700 }}>{n.ccy}</div>
              <div style={{ color:T.text, fontSize:13, fontWeight:500 }}>{n.event}</div>
              <div><span style={{ color:T.dim, fontSize:9 }}>Fore </span><span style={{ ...mono, color:T.muted, fontSize:11, fontWeight:600 }}>{n.fore}</span></div>
              <div><span style={{ color:T.dim, fontSize:9 }}>Act </span><span style={{ ...mono, color: n.act === "—" ? T.dim : T.green, fontSize:11, fontWeight:700 }}>{n.act}</span></div>
              <div><span style={{ color:T.dim, fontSize:9 }}>Prev </span><span style={{ ...mono, color:T.muted, fontSize:11 }}>{n.prev}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NEWS FEED
═══════════════════════════════════════════════════════════ */
const NEWS_DATA = [
  { time:"2h ago",  src:"Reuters",     headline:"Fed signals dovish pivot ahead of FOMC meeting", impact:"high", pair:"USD" },
  { time:"3h ago",  src:"Bloomberg",   headline:"ECB officials warn of persistent inflation risks", impact:"medium", pair:"EUR" },
  { time:"5h ago",  src:"FT",          headline:"Gold rallies past $2,340 on safe-haven demand", impact:"medium", pair:"XAU" },
  { time:"8h ago",  src:"WSJ",         headline:"BoJ keeps rates on hold; yen weakens further", impact:"high", pair:"JPY" },
  { time:"12h ago", src:"Reuters",     headline:"Bitcoin tests $68K as institutional flows rebound", impact:"low", pair:"BTC" },
  { time:"1d ago",  src:"CNBC",        headline:"UK GDP beats forecast; sterling jumps", impact:"high", pair:"GBP" },
  { time:"1d ago",  src:"Investing",   headline:"OPEC+ surprise cut sends commodities higher", impact:"medium", pair:"OIL" },
];

function NewsFeed({ T, isMobile }) {
  const ic = { high:T.red, medium:"#FF8C00", low:T.gold };
  return (
    <div style={card(T, { padding:14 })}>
      <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:11 }}>📰 MARKET NEWS</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {NEWS_DATA.map((n, i) => {
          const c = ic[n.impact];
          return (
            <div key={i} style={{ padding:"11px 13px", background:`${T.muted}08`, borderRadius:9, borderLeft:`3px solid ${c}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5, gap:8 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ background:`${c}18`, color:c, borderRadius:4, padding:"2px 6px", fontSize:9, fontWeight:700, letterSpacing:.5 }}>{n.impact.toUpperCase()}</span>
                  <span style={{ color:T.cyan, fontSize:10, fontWeight:600 }}>{n.src}</span>
                  <span style={{ color:T.gold, fontSize:10, fontWeight:600 }}>{n.pair}</span>
                </div>
                <span style={{ color:T.dim, fontSize:10, ...mono }}>{n.time}</span>
              </div>
              <div style={{ color:T.text, fontSize:13, fontWeight:500, lineHeight:1.4 }}>{n.headline}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════════════════════ */
function AnalyticsView({ trades, wallet, isMobile, T }) {
  const stats = useMemo(() => {
    if (!trades.length) return null;
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const total = trades.reduce((s,t) => s+t.pnl, 0);
    const avgWin  = wins.length   ? wins.reduce((s,t)=>s+t.pnl,0)/wins.length   : 0;
    const avgLoss = losses.length ? losses.reduce((s,t)=>s+t.pnl,0)/losses.length : 0;
    const pf = avgLoss !== 0 ? Math.abs((avgWin*wins.length)/(avgLoss*losses.length)) : 0;
    const byPair = {};
    trades.forEach(t => { byPair[t.pair] = (byPair[t.pair] || 0) + t.pnl; });
    return { wins, losses, total, avgWin, avgLoss, pf, byPair, wr: trades.length ? (wins.length/trades.length*100) : 0 };
  }, [trades]);

  const equityCurve = useMemo(() => {
    let bal = wallet.deposits;
    return [...trades].reverse().map((t, i) => { bal += t.pnl; return { i, eq: bal, date: fmtDate(t.ts) }; });
  }, [trades, wallet]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"apexFadeUp .4s ease forwards" }}>
      {!stats ? (
        <div style={card(T, { padding:40, textAlign:"center" })}>
          <div style={{ fontSize:36, opacity:.18, marginBottom:10 }}>📊</div>
          <div style={{ color:T.muted, fontSize:13 }}>Place trades to see your analytics</div>
        </div>
      ) : (
        <>
          <div className="apex-grid-4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {[
              { l:"Total P&L",   v:fmtMoney(stats.total),   c: stats.total>=0?T.green:T.red, sub:"All-time" },
              { l:"Win Rate",    v:stats.wr.toFixed(1)+"%", c:T.cyan,                         sub:`${stats.wins.length}W / ${stats.losses.length}L` },
              { l:"Profit Factor", v:stats.pf.toFixed(2),    c:T.gold,                         sub:"Gross / Loss" },
              { l:"Total Trades",  v:trades.length,          c:T.purple,                       sub:"Executed" },
            ].map((s, i) => (
              <div key={i} style={card(T, { padding:14 })}>
                <div style={{ color:T.dim, fontSize:10, marginBottom:5, letterSpacing:.5, fontWeight:600 }}>{s.l.toUpperCase()}</div>
                <div style={{ ...cond, color:s.c, fontSize:24, fontWeight:700, lineHeight:1, marginBottom:3 }}>{s.v}</div>
                <div style={{ color:T.muted, fontSize:11 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={card(T, { padding:14 })}>
            <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:10 }}>📈 EQUITY CURVE</div>
            <div style={{ height:200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve} margin={{ top:5, right:5, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.cyan} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={T.cyan} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" hide/>
                  <YAxis tick={{ fill:T.dim, fontSize:9 }} width={50}/>
                  <Tooltip contentStyle={{ background:T.card, border:`1px solid ${T.b}`, borderRadius:8, fontSize:11 }}/>
                  <Area type="monotone" dataKey="eq" stroke={T.cyan} strokeWidth={2} fill="url(#eq-grad)" dot={false} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card(T, { padding:14 })}>
            <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:10 }}>P&L BY PAIR</div>
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {Object.entries(stats.byPair).map(([pair, pnl]) => {
                const max = Math.max(...Object.values(stats.byPair).map(Math.abs));
                return (
                  <div key={pair}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ color:T.text, fontSize:12, fontWeight:600 }}>{pair}</span>
                      <span style={{ ...mono, color: pnl>=0?T.green:T.red, fontSize:12, fontWeight:700 }}>{fmtMoney(pnl)}</span>
                    </div>
                    <StrBar pct={Math.abs(pnl)/max*100} color={pnl>=0?T.green:T.red}/>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TRADE JOURNAL
═══════════════════════════════════════════════════════════ */
function JournalView({ trades, journal, setJournal, isMobile, T }) {
  const [editingTrade, setEditingTrade] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [moodVal, setMoodVal] = useState("neutral");
  const [tagsVal, setTagsVal] = useState("");

  const startEdit = (trade) => {
    const existing = journal[trade.id] || { note:"", mood:"neutral", tags:"" };
    setNoteText(existing.note);
    setMoodVal(existing.mood);
    setTagsVal(existing.tags);
    setEditingTrade(trade);
  };

  const saveNote = () => {
    setJournal({ ...journal, [editingTrade.id]: { note:noteText, mood:moodVal, tags:tagsVal, updatedAt:Date.now() } });
    setEditingTrade(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"apexFadeUp .4s ease forwards" }}>
      {editingTrade && (
        <Modal title="📝 Journal Entry" subtitle={`${editingTrade.pair} · ${editingTrade.type}`} onClose={()=>setEditingTrade(null)} accent={T.purple} T={T}>
          <div style={{ padding:12, background:`${T.muted}10`, borderRadius:9, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, fontSize:11 }}>
            <div><div style={{ color:T.dim, fontSize:9 }}>P&L</div><div style={{ ...mono, color: editingTrade.pnl>=0?T.green:T.red, fontWeight:700 }}>{fmtMoney(editingTrade.pnl)}</div></div>
            <div><div style={{ color:T.dim, fontSize:9 }}>PIPS</div><div style={{ ...mono, color: editingTrade.pips>=0?T.green:T.red, fontWeight:700 }}>{editingTrade.pips?.toFixed(1)}</div></div>
            <div><div style={{ color:T.dim, fontSize:9 }}>EXIT</div><div style={{ ...mono, color:T.muted, fontWeight:700 }}>{editingTrade.reason}</div></div>
          </div>

          <div>
            <div style={{ color:T.muted, fontSize:11, marginBottom:6, fontWeight:600, letterSpacing:.5, textTransform:"uppercase" }}>Mood / Setup Quality</div>
            <div style={{ display:"flex", gap:5 }}>
              {[["good","😊 Good","#00FF88"],["neutral","😐 Neutral","#FFB800"],["bad","😞 Bad","#FF3366"]].map(([k,l,c]) => (
                <button key={k} onClick={()=>setMoodVal(k)} style={{ flex:1, padding:"8px", fontSize:11, background: moodVal===k ? `${c}18` : `${T.muted}10`, border:`1px solid ${moodVal===k?c+"40":T.b}`, color: moodVal===k ? c : T.muted, borderRadius:7, cursor:"pointer", fontWeight:700, fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>

          <Input label="Tags (comma separated)" value={tagsVal} onChange={setTagsVal} placeholder="breakout, news, fomc" T={T} />

          <div>
            <div style={{ color:T.muted, fontSize:11, marginBottom:6, fontWeight:600, letterSpacing:.5, textTransform:"uppercase" }}>Notes</div>
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={5} placeholder="What did you observe? What was your reasoning? What can you improve?"
              style={{ width:"100%", background:`${T.cyan}08`, border:`1px solid ${T.b}`, color:T.text, borderRadius:9, padding:"10px 13px", fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical" }}/>
          </div>

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <Btn onClick={()=>setEditingTrade(null)} variant="ghost" T={T}>Cancel</Btn>
            <Btn onClick={saveNote} variant="primary" T={T}>Save Entry</Btn>
          </div>
        </Modal>
      )}

      <div style={card(T, { padding:14 })}>
        <div style={{ color:T.purple, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:11 }}>📔 TRADE JOURNAL</div>
        {!trades.length ? (
          <div style={{ padding:30, textAlign:"center", background:`${T.muted}08`, borderRadius:10 }}>
            <div style={{ fontSize:36, opacity:.18, marginBottom:8 }}>📔</div>
            <div style={{ color:T.muted, fontSize:13 }}>Closed trades will appear here for journaling</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {trades.slice(0, 30).map(t => {
              const j = journal[t.id];
              const moodCol = j?.mood === "good" ? T.green : j?.mood === "bad" ? T.red : "#FFB800";
              const moodIcon = j?.mood === "good" ? "😊" : j?.mood === "bad" ? "😞" : j ? "😐" : "📝";
              return (
                <div key={t.id} onClick={()=>startEdit(t)} style={{ padding:"10px 12px", background:`${T.muted}08`, borderRadius:9, cursor:"pointer", display:"grid", gridTemplateColumns: isMobile ? "auto 1fr auto" : "auto 1fr auto auto", gap:11, alignItems:"center", border:`1px solid ${j?moodCol+"30":T.b}` }}>
                  <div style={{ width:32, height:32, borderRadius:7, background:`${moodCol}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{moodIcon}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ color:T.text, fontWeight:700, fontSize:13 }}>{t.pair} · <span style={{ color: t.type==="BUY"?T.green:T.red }}>{t.type}</span></div>
                    {j?.note ? (
                      <div style={{ color:T.muted, fontSize:10.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{j.note}</div>
                    ) : (
                      <div style={{ color:T.dim, fontSize:10.5, fontStyle:"italic" }}>No notes — click to add</div>
                    )}
                    {j?.tags && <div style={{ display:"flex", gap:4, marginTop:3, flexWrap:"wrap" }}>{j.tags.split(",").slice(0,3).map((tg,i)=>tg.trim()&&<span key={i} style={{ fontSize:9, background:`${T.purple}15`, color:T.purple, padding:"1px 6px", borderRadius:3, fontWeight:600 }}>{tg.trim()}</span>)}</div>}
                  </div>
                  {!isMobile && <div style={{ ...mono, color:T.muted, fontSize:11 }}>{fmtDate(t.ts)}</div>}
                  <div style={{ ...mono, color: t.pnl>=0?T.green:T.red, fontWeight:700, fontSize:13 }}>{fmtMoney(t.pnl)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STRATEGY BACKTESTING
═══════════════════════════════════════════════════════════ */
function BacktestView({ candles, T, isMobile }) {
  const [pair, setPair] = useState("EURUSD");
  const [strategy, setStrategy] = useState("ema_cross");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const STRATEGIES = {
    ema_cross: { name:"EMA Crossover", desc:"EMA 9 crosses EMA 21" },
    rsi_reversal: { name:"RSI Reversal", desc:"RSI 30/70 reversal" },
    breakout: { name:"Range Breakout", desc:"20-period high/low break" },
  };

  const run = async () => {
    setRunning(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 800));

    const data = candles[pair] || [];
    if (!data.length) { setRunning(false); return; }
    const closes = data.map(c => c.close);
    const trades = [];
    const cfg = PAIRS[pair];

    /* Simple EMA cross simulation */
    const calcEMA = (vals, period) => {
      const k = 2 / (period + 1); let prev = vals[0]; const out = [];
      vals.forEach((v, i) => { prev = i === 0 ? v : v*k + prev*(1-k); out.push(prev); });
      return out;
    };
    const ema9  = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);

    if (strategy === "ema_cross") {
      let inPos = null;
      for (let i = 22; i < closes.length; i++) {
        const prevDiff = ema9[i-1] - ema21[i-1];
        const currDiff = ema9[i] - ema21[i];
        if (!inPos && prevDiff < 0 && currDiff > 0) {
          inPos = { type:"BUY", entry: closes[i], time: data[i].time };
        } else if (!inPos && prevDiff > 0 && currDiff < 0) {
          inPos = { type:"SELL", entry: closes[i], time: data[i].time };
        } else if (inPos) {
          const isBuy = inPos.type === "BUY";
          const pips = (isBuy ? closes[i] - inPos.entry : inPos.entry - closes[i]) / cfg.pip;
          if (Math.abs(pips) >= 30) {
            trades.push({ ...inPos, pair, exit:closes[i], pips, pnl: calcPnL(pair, inPos.type, inPos.entry, closes[i], DEFAULT_UNITS[pair]||10000).usd });
            inPos = null;
          }
        }
      }
    } else if (strategy === "rsi_reversal") {
      const rsi = calcRSI(closes, 14);
      let inPos = null;
      for (let i = 15; i < closes.length - 1; i++) {
        if (!inPos && rsi[i] < 30 && rsi[i-1] >= 30) {
          inPos = { type:"BUY", entry: closes[i], time: data[i].time };
        } else if (!inPos && rsi[i] > 70 && rsi[i-1] <= 70) {
          inPos = { type:"SELL", entry: closes[i], time: data[i].time };
        } else if (inPos) {
          const isBuy = inPos.type === "BUY";
          const pips = (isBuy ? closes[i] - inPos.entry : inPos.entry - closes[i]) / cfg.pip;
          if (Math.abs(pips) >= 25 || (isBuy && rsi[i] > 50) || (!isBuy && rsi[i] < 50)) {
            trades.push({ ...inPos, pair, exit:closes[i], pips, pnl: calcPnL(pair, inPos.type, inPos.entry, closes[i], DEFAULT_UNITS[pair]||10000).usd });
            inPos = null;
          }
        }
      }
    } else if (strategy === "breakout") {
      let inPos = null;
      for (let i = 20; i < closes.length; i++) {
        const window = data.slice(i-20, i);
        const high = Math.max(...window.map(c=>c.high));
        const low  = Math.min(...window.map(c=>c.low));
        if (!inPos && closes[i] > high) {
          inPos = { type:"BUY", entry: closes[i], time: data[i].time };
        } else if (!inPos && closes[i] < low) {
          inPos = { type:"SELL", entry: closes[i], time: data[i].time };
        } else if (inPos) {
          const isBuy = inPos.type === "BUY";
          const pips = (isBuy ? closes[i] - inPos.entry : inPos.entry - closes[i]) / cfg.pip;
          if (Math.abs(pips) >= 40) {
            trades.push({ ...inPos, pair, exit:closes[i], pips, pnl: calcPnL(pair, inPos.type, inPos.entry, closes[i], DEFAULT_UNITS[pair]||10000).usd });
            inPos = null;
          }
        }
      }
    }

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const totalPnl = trades.reduce((s,t) => s+t.pnl, 0);
    let bal = 10000; const equity = [{ i:0, eq:bal }];
    trades.forEach((t, i) => { bal += t.pnl; equity.push({ i:i+1, eq:bal }); });

    setResult({
      total: trades.length,
      wins: wins.length, losses: losses.length,
      wr: trades.length ? (wins.length/trades.length*100) : 0,
      totalPnl, equity, trades,
      maxDD: Math.min(0, ...equity.map(e => e.eq - 10000)),
    });
    setRunning(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"apexFadeUp .4s ease forwards" }}>
      <div style={card(T, { padding:14 })}>
        <div style={{ color:T.purple, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:11 }}>🧪 STRATEGY BACKTESTING</div>

        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap:10, marginBottom:12 }}>
          <div>
            <div style={{ color:T.muted, fontSize:11, marginBottom:5, fontWeight:600, letterSpacing:.5, textTransform:"uppercase" }}>Pair</div>
            <select value={pair} onChange={e=>setPair(e.target.value)} style={{ width:"100%", background:`${T.cyan}08`, border:`1px solid ${T.b}`, color:T.text, borderRadius:9, padding:"10px 13px", fontSize:14, outline:"none", fontFamily:"inherit" }}>
              {Object.entries(PAIRS).map(([k,c]) => <option key={k} value={k} style={{ background:T.bg, color:T.text }}>{c.n}</option>)}
            </select>
          </div>
          <div>
            <div style={{ color:T.muted, fontSize:11, marginBottom:5, fontWeight:600, letterSpacing:.5, textTransform:"uppercase" }}>Strategy</div>
            <select value={strategy} onChange={e=>setStrategy(e.target.value)} style={{ width:"100%", background:`${T.cyan}08`, border:`1px solid ${T.b}`, color:T.text, borderRadius:9, padding:"10px 13px", fontSize:14, outline:"none", fontFamily:"inherit" }}>
              {Object.entries(STRATEGIES).map(([k,s]) => <option key={k} value={k} style={{ background:T.bg, color:T.text }}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end" }}>
            <Btn onClick={run} variant="primary" disabled={running} fullWidth={isMobile} style={{ padding:"10px 24px" }} T={T}>
              {running ? <span style={{ display:"inline-block", animation:"apexSpin 1s linear infinite" }}>◌</span> : "▶ Run Backtest"}
            </Btn>
          </div>
        </div>

        <div style={{ padding:"8px 12px", background:`${T.muted}08`, borderRadius:7, color:T.muted, fontSize:11.5 }}>
          ℹ {STRATEGIES[strategy].desc} · Tests on last {(candles[pair] || []).length} candles
        </div>
      </div>

      {result && (
        <>
          {result.total === 0 && (
            <div style={card(T, { padding:24, textAlign:"center" })}>
              <div style={{ fontSize:32, opacity:.2, marginBottom:8 }}>📭</div>
              <div style={{ color:T.muted, fontSize:13 }}>No setups triggered for this strategy on the available data.</div>
              <div style={{ color:T.dim, fontSize:11, marginTop:4 }}>Try a different pair or strategy.</div>
            </div>
          )}
          {result.total > 0 && (<>
          <div className="apex-grid-4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {[
              { l:"Total P&L", v:fmtMoney(result.totalPnl), c: result.totalPnl>=0?T.green:T.red },
              { l:"Win Rate",  v:result.wr.toFixed(1)+"%",  c:T.cyan },
              { l:"Trades",    v:result.total,              c:T.purple },
              { l:"Max DD",    v:fmtMoney(result.maxDD),    c:T.red },
            ].map((s,i) => (
              <div key={i} style={card(T, { padding:14 })}>
                <div style={{ color:T.dim, fontSize:10, marginBottom:5, letterSpacing:.5, fontWeight:600 }}>{s.l.toUpperCase()}</div>
                <div style={{ ...cond, color:s.c, fontSize:24, fontWeight:700, lineHeight:1 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {result.equity.length > 1 && (
            <div style={card(T, { padding:14 })}>
              <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:10 }}>📈 BACKTEST EQUITY CURVE</div>
              <div style={{ height:200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equity} margin={{ top:5, right:5, left:0, bottom:0 }}>
                    <defs><linearGradient id="bt-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.cyan} stopOpacity={0.3}/><stop offset="95%" stopColor={T.cyan} stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="i" hide/>
                    <YAxis tick={{ fill:T.dim, fontSize:9 }} width={50}/>
                    <Tooltip contentStyle={{ background:T.card, border:`1px solid ${T.b}`, borderRadius:8, fontSize:11 }}/>
                    <Area type="monotone" dataKey="eq" stroke={T.cyan} strokeWidth={2} fill="url(#bt-grad)" dot={false} isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          </>)}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LEADERBOARD
═══════════════════════════════════════════════════════════ */
function LeaderboardView({ wallet, user, trades, T }) {
  const board = useMemo(() => {
    const traders = [
      { name:"Alpha_Quant",      pnl:124850, wr:78.2, trades:1247 },
      { name:"FX_Predator",      pnl: 98425, wr:71.5, trades:894  },
      { name:"InstitutionalBull",pnl: 76210, wr:69.8, trades:723  },
      { name:"GoldKing_22",      pnl: 54320, wr:65.3, trades:512  },
      { name:"PipMaster",        pnl: 42180, wr:62.1, trades:445  },
      { name:"WolfOfFX",         pnl: 35720, wr:58.9, trades:387  },
      { name:"MarketSurfer",     pnl: 28950, wr:55.2, trades:301  },
      { name:"NeonTrader_X",     pnl: 19840, wr:53.7, trades:234  },
    ];
    const userPnl = wallet.totalPnl || trades.reduce((s,t)=>s+t.pnl, 0);
    const userWR  = trades.length ? trades.filter(t=>t.pnl>0).length/trades.length*100 : 0;
    const userEntry = { name: user?.displayName || "You", pnl: userPnl, wr: userWR, trades: trades.length, isUser:true };
    return [...traders, userEntry].sort((a, b) => b.pnl - a.pnl).map((t, i) => ({ ...t, rank: i + 1 }));
  }, [wallet, user, trades]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"apexFadeUp .4s ease forwards" }}>
      <div style={card(T, { padding:14 })}>
        <div style={{ marginBottom:13 }}>
          <div style={{ color:T.gold, fontSize:11, fontWeight:700, letterSpacing:2 }}>🏆 GLOBAL LEADERBOARD</div>
          <div style={{ color:T.muted, fontSize:11, marginTop:2 }}>Top traders this month</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {board.map(t => {
            const isTop3 = t.rank <= 3;
            const medal = t.rank === 1 ? "🥇" : t.rank === 2 ? "🥈" : t.rank === 3 ? "🥉" : null;
            return (
              <div key={t.name} style={{ display:"grid", gridTemplateColumns:"40px 1fr auto", gap:11, alignItems:"center", padding:"11px 14px", borderRadius:9, background: t.isUser ? `${T.cyan}12` : isTop3 ? `${T.gold}06` : `${T.muted}10`, border: t.isUser ? `1px solid ${T.cyan}40` : isTop3 ? `1px solid ${T.gold}25` : `1px solid ${T.b}` }}>
                <div style={{ ...cond, fontSize:isTop3?22:18, fontWeight:800, color: isTop3 ? T.gold : T.muted, textAlign:"center" }}>{medal || "#" + t.rank}</div>
                <div>
                  <div style={{ color: t.isUser ? T.cyan : T.text, fontWeight:700, fontSize:14 }}>{t.name} {t.isUser && <span style={{ color:T.cyan, fontSize:9, marginLeft:4, padding:"1px 6px", background:`${T.cyan}18`, borderRadius:3 }}>YOU</span>}</div>
                  <div style={{ color:T.muted, fontSize:10.5 }}>{t.trades} trades · {t.wr.toFixed(1)}% win rate</div>
                </div>
                <div style={{ ...mono, color: t.pnl >= 0 ? T.green : T.red, fontWeight:700, fontSize:15 }}>{fmtMoney(t.pnl)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   WATCHLIST VIEW
═══════════════════════════════════════════════════════════ */
function WatchlistView({ watchlist, setWatchlist, prices, T }) {
  const toggle = (id) => {
    setWatchlist(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  return (
    <div style={card(T, { padding:14 })}>
      <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:11 }}>⭐ MY WATCHLIST</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {Object.entries(PAIRS).map(([id, cfg]) => {
          const m = prices[id] || {}; const isWatched = watchlist.includes(id); const up = m.pct >= 0;
          return (
            <div key={id} style={{ display:"grid", gridTemplateColumns:"36px 1fr auto auto", gap:10, alignItems:"center", padding:"10px 13px", background:`${T.muted}08`, borderRadius:9, border:`1px solid ${isWatched?T.gold+"30":T.b}` }}>
              <button onClick={()=>toggle(id)} style={{ width:28, height:28, borderRadius:7, background: isWatched ? `${T.gold}20` : `${T.muted}10`, border:`1px solid ${isWatched?T.gold+"40":T.b}`, color: isWatched ? T.gold : T.muted, cursor:"pointer", fontSize:14 }}>★</button>
              <div>
                <div style={{ color:T.text, fontWeight:700, fontSize:14 }}>{cfg.n}</div>
                <div style={{ color:T.muted, fontSize:10 }}>{cfg.cat} · spread {cfg.sprd} pip</div>
              </div>
              <div style={{ ...mono, color:T.text, fontSize:14, fontWeight:700 }}>{fmtP(m.mid, id)}</div>
              <div style={{ ...mono, color: up?T.green:T.red, fontSize:12, fontWeight:700, minWidth:60, textAlign:"right" }}>{up?"+":""}{m.pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Full timeframe option set, grouped */
const TF_GROUPS = [
  { label:"INTRADAY", items:[
    { id:"1m",  l:"1m"  },
    { id:"5m",  l:"5m"  },
    { id:"15m", l:"15m" },
    { id:"30m", l:"30m" },
    { id:"1h",  l:"1H"  },
    { id:"4h",  l:"4H"  },
  ]},
  { label:"SWING / POSITION", items:[
    { id:"1D",  l:"1D"  },
    { id:"1W",  l:"1W"  },
    { id:"1M",  l:"1M"  },
    { id:"1Y",  l:"1Y"  },
  ]},
];

/* ═══════════════════════════════════════════════════════════
   CHART VIEW
═══════════════════════════════════════════════════════════ */
function ChartView({ candles, prices, signals, onOrder, isMobile, T }) {
  const [pair, setPair] = useState("EURUSD");
  const [tf, setTf] = useState("1m");
  const cfg = PAIRS[pair]; const m = prices[pair] || {};
  const closes = (candles[pair] || []).map(c => c.close);
  const rsiArr = calcRSI(closes.slice(-50), 14);
  const lastRsi = rsiArr[rsiArr.length - 1] || 50;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"apexFadeUp .4s ease forwards" }}>
      <PriceTicker prices={prices} onClick={setPair} selected={pair} T={T} />

      <div className="apex-grid-2" style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap:12, alignItems:"start" }}>
        <div style={card(T, { padding:14 })}>
          {/* Price header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:12 }}>
            <div>
              <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
                <div style={{ ...cond, color:cfg.c, fontSize:22, fontWeight:800 }}>{cfg.n}</div>
                <div style={{ ...mono, fontSize:22, fontWeight:700, color:T.text }}>{fmtP(m.mid, pair)}</div>
                <div style={{ ...mono, color: m.pct >= 0 ? T.green : T.red, fontSize:13, fontWeight:600 }}>{m.pct >= 0 ? "+" : ""}{m.pct}%</div>
              </div>
              <div style={{ display:"flex", gap:11, marginTop:5, flexWrap:"wrap" }}>
                <div><span style={{ color:T.dim, fontSize:9.5 }}>BID </span><span style={{ ...mono, color:T.red, fontSize:11, fontWeight:600 }}>{fmtP(m.bid, pair)}</span></div>
                <div><span style={{ color:T.dim, fontSize:9.5 }}>ASK </span><span style={{ ...mono, color:T.green, fontSize:11, fontWeight:600 }}>{fmtP(m.ask, pair)}</span></div>
                <div><span style={{ color:T.dim, fontSize:9.5 }}>SPRD </span><span style={{ ...mono, color:T.muted, fontSize:11, fontWeight:600 }}>{cfg.sprd} pip</span></div>
                <div><span style={{ color:T.dim, fontSize:9.5 }}>TF </span><span style={{ ...mono, color:T.cyan, fontSize:11, fontWeight:700 }}>{tf}</span></div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <TVChart candles={candles[pair] || []} pair={pair} tf={tf} height={isMobile ? 300 : 400} T={T} />

          {/* Timeframe selector — directly below chart */}
          <div style={{ marginTop:12, padding:"10px 12px", background:`${T.muted}08`, borderRadius:9, border:`1px solid ${T.b}` }}>
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:isMobile?6:10 }}>
              {TF_GROUPS.map((grp, gi) => (
                <div key={grp.label} style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  {!isMobile && (
                    <span style={{ color:T.dim, fontSize:9, fontWeight:700, letterSpacing:1.2, marginRight:2 }}>{grp.label}</span>
                  )}
                  <div style={{ display:"flex", gap:3, background:`${T.muted}10`, padding:3, borderRadius:8, border:`1px solid ${T.b}` }}>
                    {grp.items.map(it => {
                      const on = tf === it.id;
                      return (
                        <button key={it.id} onClick={()=>setTf(it.id)}
                          style={{
                            padding: isMobile ? "6px 9px" : "6px 12px",
                            fontSize: isMobile ? 11 : 12,
                            background: on ? T.cyan : "transparent",
                            border:"none",
                            color: on ? T.bg : T.muted,
                            borderRadius:6, cursor:"pointer", fontWeight:700,
                            fontFamily:"inherit",
                            minWidth: isMobile ? 36 : 40,
                            transition:"all .15s",
                            boxShadow: on ? `0 2px 8px ${T.cyan}40` : "none",
                          }}>
                          {it.l}
                        </button>
                      );
                    })}
                  </div>
                  {gi < TF_GROUPS.length - 1 && !isMobile && (
                    <div style={{ width:1, height:18, background:T.b, marginLeft:4 }}/>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RSI / EMA legend */}
          <div style={{ marginTop:10, padding:"10px 12px", background:`${T.muted}10`, borderRadius:9, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
            <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
              <div>
                <span style={{ color:T.dim, fontSize:9.5, letterSpacing:1 }}>RSI(14) </span>
                <span style={{ ...mono, color: lastRsi > 70 ? T.red : lastRsi < 30 ? T.gold : T.green, fontSize:13, fontWeight:700, marginLeft:4 }}>{lastRsi.toFixed(1)}</span>
                <span style={{ color: lastRsi > 70 ? T.red : lastRsi < 30 ? T.gold : T.muted, fontSize:9, marginLeft:6 }}>{lastRsi > 70 ? "OVERBOUGHT" : lastRsi < 30 ? "OVERSOLD" : "NEUTRAL"}</span>
              </div>
              <div><span style={{ color:T.dim, fontSize:9.5, letterSpacing:1 }}>EMA9</span><span style={{ width:8, height:8, background:T.cyan, borderRadius:"50%", display:"inline-block", marginLeft:5 }}/></div>
              <div><span style={{ color:T.dim, fontSize:9.5, letterSpacing:1 }}>EMA21</span><span style={{ width:8, height:8, background:T.purple, borderRadius:"50%", display:"inline-block", marginLeft:5 }}/></div>
            </div>
            <div style={{ width: isMobile ? 100 : 200, position:"relative", height:8, background:`${T.cyan}10`, borderRadius:4, overflow:"hidden" }}>
              <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${lastRsi}%`, background: lastRsi > 70 ? T.red : lastRsi < 30 ? T.gold : T.green, transition:"width .8s ease" }}/>
            </div>
          </div>
        </div>

        {!isMobile && <QuickTrade prices={prices} candles={candles} pair={pair} setPair={setPair} onOrder={onOrder} signal={signals} T={T} />}
      </div>
      {isMobile && <QuickTrade prices={prices} candles={candles} pair={pair} setPair={setPair} onOrder={onOrder} signal={signals} T={T} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════ */
function DashboardView({ prices, candles, wallet, positions, trades, signals, watchlist, onOrder, onClose, onOpenWallet, isMobile, T }) {
  const [chartPair, setChartPair] = useState("EURUSD");

  const floatPnl = useMemo(() => {
    return positions.reduce((s, pos) => {
      const m = prices[pos.pair] || {}; const cfg = PAIRS[pos.pair]; if (!cfg) return s;
      const isBuy = pos.type === "BUY";
      const curr  = isBuy ? (m.bid || pos.entry) : (m.ask || pos.entry);
      return s + calcPnL(pos.pair, pos.type, pos.entry, curr, pos.units).usd;
    }, 0);
  }, [positions, prices]);

  const equity = wallet.balance + floatPnl;
  const usedMargin = useMemo(() => positions.reduce((s, p) => s + (p.margin || 0), 0), [positions]);
  const freeMargin = wallet.balance - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"apexFadeUp .4s ease forwards" }}>
      <div className="apex-grid-5" style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
        {[
          { l:"Balance",      v:fmtMoney(wallet.balance, false), c:T.cyan,   sub:"Available",       action:onOpenWallet },
          { l:"Equity",       v:fmtMoney(equity, false),         c:T.text,   sub:"Bal + Float P&L"},
          { l:"Float P&L",    v:fmtMoney(floatPnl),              c: floatPnl >= 0 ? T.green : T.red, sub:`${positions.length} pos` },
          { l:"Free Margin",  v:fmtMoney(freeMargin, false),     c:T.purple, sub:`Used $${usedMargin.toFixed(0)}` },
          { l:"Margin Lvl",   v: usedMargin > 0 ? marginLevel.toFixed(0)+"%" : "—", c:T.gold, sub:"Equity / Margin" },
        ].map((s, i) => (
          <div key={i} style={card(T, { padding:"12px 14px", cursor: s.action ? "pointer" : "default" })} onClick={s.action}>
            <div style={{ color:T.dim, fontSize:9.5, letterSpacing:.5, marginBottom:4, fontWeight:600 }}>{s.l.toUpperCase()}</div>
            <div style={{ ...cond, color:s.c, fontSize:18, fontWeight:700, lineHeight:1.1, marginBottom:3 }}>{s.v}</div>
            <div style={{ color:T.muted, fontSize:10 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <PriceTicker prices={prices} onClick={setChartPair} selected={chartPair} watchlist={watchlist.length ? watchlist : null} T={T} />

      <div className="apex-grid-2" style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap:12, alignItems:"start" }}>
        <div style={card(T, { padding:14 })}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:5 }}>
            <div style={{ color:T.text, fontWeight:700, fontSize:14 }}>{PAIRS[chartPair].n} · Live</div>
            <div style={{ ...mono, fontSize:18, fontWeight:600, color: PAIRS[chartPair].c }}>{fmtP(prices[chartPair]?.mid, chartPair)}</div>
          </div>
          <TVChart candles={candles[chartPair] || []} pair={chartPair} tf="1m" height={isMobile ? 240 : 280} T={T} />
        </div>

        <QuickTrade prices={prices} candles={candles} pair={chartPair} setPair={setChartPair} onOrder={onOrder} signal={signals} T={T} />
      </div>

      <div style={card(T, { padding:14 })}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:11 }}>
          <div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2 }}>📂 OPEN POSITIONS ({positions.length})</div>
          {floatPnl !== 0 && <div style={{ ...mono, color: floatPnl >= 0 ? T.green : T.red, fontWeight:700 }}>{fmtMoney(floatPnl)}</div>}
        </div>
        <PositionsList positions={positions} prices={prices} onClose={onClose} isMobile={isMobile} T={T} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR + TOPBAR
═══════════════════════════════════════════════════════════ */
const NAV = [
  { id:"dashboard",   icon:"◈", label:"Dashboard"    },
  { id:"chart",       icon:"📈", label:"Live Chart"   },
  { id:"signals",     icon:"⚡", label:"AI Signals", badge:"AI" },
  { id:"watchlist",   icon:"⭐", label:"Watchlist"    },
  { id:"positions",   icon:"◉", label:"Positions"    },
  { id:"journal",     icon:"📔", label:"Journal"      },
  { id:"backtest",    icon:"🧪", label:"Backtest"     },
  { id:"calendar",    icon:"📅", label:"Calendar"     },
  { id:"news",        icon:"📰", label:"News"         },
  { id:"analytics",   icon:"📊", label:"Analytics"    },
  { id:"leaderboard", icon:"🏆", label:"Ranking"      },
];

function Sidebar({ view, setView, onAction, time, wsStatus, balance, user, isMobile, drawerOpen, setDrawerOpen, T }) {
  const wsCol = wsStatus === "live" ? T.green : T.gold;
  const wsLabel = wsStatus === "live" ? "LIVE" : "DEMO";

  const inner = (
    <>
      <div style={{ padding:"14px 14px 13px", borderBottom:`1px solid ${T.b}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${T.cyan}40,${T.cyan}15)`, border:`1px solid ${T.cyan}60`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, animation:"apexGlow 2.5s ease infinite" }}>⬡</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ ...cond, color:T.cyan, fontSize:17, fontWeight:800, lineHeight:1, letterSpacing:.4 }}>APEX<span style={{ color:T.green }}>FX</span></div>
            <div style={{ color:T.dim, fontSize:9, letterSpacing:2.5, fontWeight:600 }}>PRO SUITE</div>
          </div>
          {isMobile && <button onClick={()=>setDrawerOpen(false)} style={{ background:`${T.muted}14`, border:"none", color:T.muted, width:28, height:28, borderRadius:7, cursor:"pointer", fontSize:14 }}>✕</button>}
        </div>
      </div>

      <nav style={{ flex:1, padding:"11px 9px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
        <div style={{ color:T.dim, fontSize:9, letterSpacing:2, fontWeight:700, padding:"0 4px", marginBottom:6 }}>NAVIGATION</div>
        {NAV.map(it => {
          const on = view === it.id;
          return (
            <div key={it.id} onClick={()=>{ setView(it.id); if (isMobile) setDrawerOpen(false); }}
              style={{ cursor:"pointer", borderRadius:8, borderLeft:`3px solid ${on?T.cyan:"transparent"}`, padding:"9px 11px", display:"flex", alignItems:"center", gap:9, background: on ? `${T.cyan}15` : "transparent", transition:"all .15s", userSelect:"none" }}>
              <span style={{ fontSize:13, color: on ? T.cyan : T.muted, width:18, textAlign:"center", flexShrink:0 }}>{it.icon}</span>
              <span style={{ fontSize:12.5, fontWeight: on ? 600 : 400, color: on ? T.text : T.muted }}>{it.label}</span>
              {it.badge && <span style={{ marginLeft:"auto", background:`${T.green}18`, color:T.green, fontSize:9, padding:"2px 6px", borderRadius:4, fontWeight:700 }}>{it.badge}</span>}
            </div>
          );
        })}
        <div style={{ color:T.dim, fontSize:9, letterSpacing:2, fontWeight:700, padding:"0 4px", marginTop:14, marginBottom:6 }}>ACCOUNT</div>
        {[
          { id:"wallet", icon:"💼", label:"Wallet", tag: balance ? `$${(balance/1000).toFixed(1)}K` : "" },
          { id:"settings", icon:"⚙", label:"Settings" },
        ].map(it => (
          <div key={it.id} onClick={()=>{ onAction(it.id); if (isMobile) setDrawerOpen(false); }}
            style={{ cursor:"pointer", borderRadius:8, padding:"9px 11px", display:"flex", alignItems:"center", gap:9, transition:"all .15s" }}>
            <span style={{ fontSize:13, color:T.muted, width:18, textAlign:"center" }}>{it.icon}</span>
            <span style={{ fontSize:12.5, color:T.muted }}>{it.label}</span>
            {it.tag && <span style={{ marginLeft:"auto", background:`${T.gold}10`, color:T.gold, fontSize:9.5, padding:"2px 7px", borderRadius:4, fontWeight:700, ...mono }}>{it.tag}</span>}
          </div>
        ))}
      </nav>

      <div style={{ padding:"10px 9px 14px", borderTop:`1px solid ${T.b}`, display:"flex", flexDirection:"column", gap:8 }}>
        {user && (
          <div style={{ padding:"8px 10px", background:`${T.muted}10`, borderRadius:8, display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${T.cyan},${T.cyan}80)`, display:"flex", alignItems:"center", justifyContent:"center", color:T.bg, fontSize:12, fontWeight:800, flexShrink:0 }}>{user.displayName?.[0]?.toUpperCase()}</div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ color:T.text, fontWeight:600, fontSize:11.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user.displayName}</div>
              <div style={{ color:T.dim, fontSize:9, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user.isAnon ? "Demo Account" : user.email}</div>
            </div>
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 10px", background:`${T.muted}10`, borderRadius:8, border:`1px solid ${wsCol}30` }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:wsCol, boxShadow:`0 0 6px ${wsCol}`, animation:"apexPulse 2s infinite", flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ color:wsCol, fontSize:10, fontWeight:700 }}>FEED · {wsLabel}</div>
            <div style={{ ...mono, color:T.dim, fontSize:9 }}>{time.toUTCString().slice(17,25)} UTC</div>
          </div>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return drawerOpen ? (
      <>
        <div onClick={()=>setDrawerOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", zIndex:998 }}/>
        <div style={{ position:"fixed", left:0, top:0, bottom:0, width:240, background:T.card, borderRight:`1px solid ${T.b}`, zIndex:999, display:"flex", flexDirection:"column", animation:"apexSlideRt .25s ease forwards", overflow:"hidden" }}>{inner}</div>
      </>
    ) : null;
  }

  return (
    <div className="apex-sidebar" style={{ width:208, minWidth:208, background:T.card, borderRight:`1px solid ${T.b}`, display:"flex", flexDirection:"column", height:"100vh", flexShrink:0 }}>{inner}</div>
  );
}

function TopBar({ view, time, prices, isMobile, setDrawerOpen, balance, onWallet, theme, setTheme, notifyCount, onNotify, T }) {
  const titles = { dashboard:"Dashboard", chart:"Live Chart", signals:"AI Signals", watchlist:"Watchlist", positions:"Positions", journal:"Journal", backtest:"Backtest", calendar:"Calendar", news:"News", analytics:"Analytics", leaderboard:"Leaderboard" };
  return (
    <div className="apex-topbar" style={{ height:56, background:T.bg, borderBottom:`1px solid ${T.b}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {isMobile && (
          <button onClick={()=>setDrawerOpen(true)} style={{ background:`${T.cyan}10`, border:`1px solid ${T.cyan}30`, color:T.cyan, width:36, height:36, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              {[1,2,3].map(i => <div key={i} style={{ width:14, height:1.5, background:T.cyan, borderRadius:1 }}/>)}
            </div>
          </button>
        )}
        <h1 style={{ margin:0, fontSize:isMobile?16:18, fontWeight:700, color:T.text, letterSpacing:.3, ...cond }}>{titles[view]}</h1>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:isMobile?6:10 }}>
        {!isMobile && Object.entries(PAIRS).slice(0,3).map(([id, c]) => {
          const m = prices[id] || {};
          return (
            <div key={id} style={{ textAlign:"center" }}>
              <div style={{ ...mono, fontSize:9, color:c.c, fontWeight:600 }}>{c.n}</div>
              <div style={{ ...mono, fontSize:12, fontWeight:700, color:T.text }}>{fmtP(m.mid, id)}</div>
            </div>
          );
        })}
        <button onClick={()=>setTheme(theme === "dark" ? "light" : "dark")} style={{ background:`${T.muted}10`, border:`1px solid ${T.b}`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:14 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
        <button onClick={onNotify} style={{ position:"relative", background:`${T.cyan}10`, border:`1px solid ${T.cyan}25`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:14 }}>
          🔔
          {notifyCount > 0 && <span style={{ position:"absolute", top:-3, right:-3, background:T.red, color:"#fff", width:16, height:16, borderRadius:"50%", fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{notifyCount}</span>}
        </button>
        <button onClick={onWallet} style={{ background:`${T.gold}08`, border:`1px solid ${T.gold}25`, borderRadius:8, padding:"6px 11px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ fontSize:13 }}>💼</span>
          <span style={{ ...mono, color:T.gold, fontSize:12, fontWeight:700, whiteSpace:"nowrap" }}>{isMobile ? `$${(balance/1000).toFixed(1)}K` : fmtMoney(balance, false)}</span>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICATION CENTER MODAL
═══════════════════════════════════════════════════════════ */
function NotifyModal({ history, onClose, T }) {
  const cols = { success:T.green, error:T.red, info:T.cyan, warning:T.gold };
  return (
    <Modal title="🔔 Notifications" subtitle={`${history.length} recent`} onClose={onClose} accent={T.cyan} T={T}>
      {history.length === 0 ? (
        <div style={{ padding:30, textAlign:"center", color:T.dim, fontSize:13 }}>No notifications yet</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:400, overflowY:"auto" }}>
          {history.map(item => (
            <div key={item.id} style={{ padding:"10px 13px", background:`${cols[item.type]||T.cyan}08`, borderLeft:`3px solid ${cols[item.type]||T.cyan}`, borderRadius:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                <span style={{ color:cols[item.type]||T.cyan, fontSize:11, fontWeight:700, textTransform:"uppercase" }}>{item.type}</span>
                <span style={{ ...mono, color:T.dim, fontSize:10 }}>{fmtTime(item.ts)}</span>
              </div>
              <div style={{ color:T.text, fontSize:12.5 }}>{item.msg}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════ */
function ApexFXApp() {
  /* Config */
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem("apexfx_config") || "null") || { firebaseApiKey:"", twelveKey:"" }; }
    catch { return { firebaseApiKey:"", twelveKey:"" }; }
  });
  useEffect(() => { try { localStorage.setItem("apexfx_config", JSON.stringify(config)); } catch {} }, [config]);

  /* Theme */
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("apexfx_theme") || "dark"; } catch { return "dark"; }
  });
  useEffect(() => { try { localStorage.setItem("apexfx_theme", theme); } catch {} }, [theme]);
  const T = THEMES[theme];

  /* CSS */
  const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;}
html{height:100%;overscroll-behavior:none;}
body,#root{margin:0;background:${T.bg};font-family:'Barlow',sans-serif;color:${T.text};min-height:100vh;}
body{overscroll-behavior:none;-webkit-overflow-scrolling:touch;}
@keyframes apexPulse    {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.25;transform:scale(.75)}}
@keyframes apexBlink    {0%,49%,100%{opacity:1}50%,99%{opacity:0}}
@keyframes apexFadeUp   {from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes apexSlideIn  {from{opacity:0;transform:translateY(22px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes apexSlideRt  {from{transform:translateX(-100%)}to{transform:translateX(0)}}
@keyframes apexShimmer  {0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes apexSpin     {from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes apexGlow     {0%,100%{box-shadow:0 0 8px ${T.cyan}30}50%{box-shadow:0 0 30px ${T.cyan}80}}
@keyframes apexScan     {0%{top:0}100%{top:100vh}}
@keyframes apexToast    {0%{opacity:0;transform:translateX(60px)}10%,90%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(60px)}}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${T.cyan}30;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:${T.cyan}50}
input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
input,button,select,textarea{font-family:inherit}
button{transition:transform .12s ease, opacity .12s ease, background-color .15s ease, border-color .15s ease;}
button:active:not(:disabled){transform:scale(.97);}
@media(hover:hover){button:hover:not(:disabled){opacity:.92}}
@media(max-width:900px){
  .apex-sidebar{display:none!important}
  .apex-grid-5{grid-template-columns:repeat(2,1fr)!important}
  .apex-grid-4{grid-template-columns:repeat(2,1fr)!important}
  .apex-grid-2{grid-template-columns:1fr!important}
}
@media(max-width:600px){
  .apex-grid-5{grid-template-columns:1fr 1fr!important}
  .apex-grid-4{grid-template-columns:1fr 1fr!important}
  .apex-modal-head{padding:12px 14px!important}
  .apex-modal-body{padding:14px!important;gap:10px!important}
  .apex-hide-sm{display:none!important}
}
@media(max-width:380px){
  .apex-grid-5,.apex-grid-4{grid-template-columns:1fr!important}
}
html,body{max-width:100vw;overflow-x:hidden}
`;

  /* Auth */
  const auth = useAuth(config.firebaseApiKey);

  /* Mobile detection — debounced resize so dragging the window doesn't re-render the tree on every pixel change */
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 900);
  useEffect(() => {
    let timer = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(window.innerWidth < 900), 120);
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (timer) clearTimeout(timer); };
  }, []);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* App state */
  const [view, setView] = useState("dashboard");
  const [time, setTime] = useState(new Date());
  const [orderModal, setOrderModal] = useState(null);
  const [showWallet, setShowWallet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [notifyReadCount, setNotifyReadCount] = useState(0);  // # of items already seen
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [journal, setJournal] = useState({});
  const [watchlist, setWatchlist] = useState(["EURUSD","XAUUSD","BTCUSD"]);

  useEffect(() => { const id = setInterval(()=>setTime(new Date()), 1000); return ()=>clearInterval(id); }, []);

  /* Lock body scroll when any modal is open (prevents iOS bounce + accidental scroll) */
  const anyModalOpen = !!orderModal || showWallet || showSettings || showNotify;
  useEffect(() => {
    if (anyModalOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = orig; };
    }
  }, [anyModalOpen]);

  const persist = usePersist(auth.user?.uid);
  const wallet  = useWallet(auth.user?.uid, persist);
  const { signals, loading: aiLoading, generate: genSignals } = useAI();
  const { toasts, history: notifyHistory, notify } = useNotify();
  const { prices, candles, wsStatus } = usePriceEngine(config.twelveKey);

  /* Load persistent state */
  useEffect(() => {
    if (!auth.user?.uid) return;
    persist.load("trades").then(t => setTrades(t || []));
    persist.load("positions").then(p => { if (p) setPositions(p); });
    persist.load("journal").then(j => { if (j) setJournal(j); });
    persist.load("watchlist").then(w => { if (w?.length) setWatchlist(w); });
  }, [auth.user?.uid]);

  useEffect(() => { if (auth.user?.uid && wallet.ready) persist.save("positions", positions); }, [positions, auth.user?.uid, wallet.ready]);
  useEffect(() => { if (auth.user?.uid) persist.save("journal", journal); }, [journal, auth.user?.uid]);
  useEffect(() => { if (auth.user?.uid) persist.save("watchlist", watchlist); }, [watchlist, auth.user?.uid]);

  const saveTrades = useCallback(async (list) => {
    setTrades(list);
    await persist.save("trades", list.slice(0, 500));
  }, [persist]);

  /* Refs hold latest values to avoid stale-closure races during rapid SL/TP closes */
  const tradesRef    = useRef(trades);
  const positionsRef = useRef(positions);
  const closingRef   = useRef(new Set()); // tracks positions currently being closed
  useEffect(() => { tradesRef.current = trades; }, [trades]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  /* Close a position with a guard to prevent double-close.
     Uses refs + functional setState everywhere — no stale-closure races. */
  const closePosition = useCallback(async (pos, reason="MANUAL", forcedPrice=null) => {
    if (closingRef.current.has(pos.id)) return;     // already closing
    closingRef.current.add(pos.id);
    try {
      const m = prices[pos.pair] || {};
      const cfg = PAIRS[pos.pair]; if (!cfg) return;
      const isBuy = pos.type === "BUY";
      const closePrice = forcedPrice ?? (isBuy ? (m.bid || pos.entry) : (m.ask || pos.entry));
      const { pips, usd: pnl } = calcPnL(pos.pair, pos.type, pos.entry, closePrice, pos.units);

      /* Atomic position removal */
      setPositions(p => p.filter(x => x.id !== pos.id));

      /* Apply P&L to wallet (also uses functional updates internally) */
      await wallet.applyPnl(pnl, pos.pair, pos.type, reason);

      /* Append trade using LATEST list from ref (not closure) */
      const trade = { id:pos.id, pair:pos.pair, type:pos.type, units:pos.units, entry:pos.entry, exit:closePrice, pips, pnl, reason, openTime:pos.openTime, closeTime:Date.now(), ts:Date.now() };
      const next = [trade, ...tradesRef.current];
      tradesRef.current = next;                      // sync immediately
      await saveTrades(next);

      notify(`${pos.pair} closed: ${fmtMoney(pnl)}${reason !== "MANUAL" ? ` (${reason} hit)` : ""}`, pnl >= 0 ? "success" : "error", `${pos.type} Closed`);
    } finally {
      closingRef.current.delete(pos.id);
    }
  }, [prices, wallet, saveTrades, notify]);

  /* SL/TP auto-close engine — checks every price tick.
     Skips positions already in the closing-set to prevent duplicate closes. */
  useEffect(() => {
    const ps = positionsRef.current;
    if (!ps.length) return;
    ps.forEach(pos => {
      if (closingRef.current.has(pos.id)) return;
      const m = prices[pos.pair] || {};
      const isBuy = pos.type === "BUY";
      const curr  = isBuy ? m.bid : m.ask;
      if (!curr) return;
      let hit = null;
      if (isBuy) {
        if (pos.tp && curr >= pos.tp) hit = "TP";
        else if (pos.sl && curr <= pos.sl) hit = "SL";
      } else {
        if (pos.tp && curr <= pos.tp) hit = "TP";
        else if (pos.sl && curr >= pos.sl) hit = "SL";
      }
      if (hit) closePosition(pos, hit, curr);
    });
  }, [prices, closePosition]);

  /* Order */
  const handleOrder = useCallback((pair, type, price) => setOrderModal({ pair, type, price }), []);

  const confirmOrder = useCallback(async (params) => {
    try {
      const pos = { ...params, id:genId(), openTime:Date.now() };
      setPositions(p => [...p, pos]);
      notify(`${params.type} ${params.units.toLocaleString()} ${params.pair} @ ${fmtP(params.entry, params.pair)}`, "success", "Order Filled");
      setOrderModal(null);
    } catch (e) {
      notify(e.message || "Order execution failed", "error", "Order Error");
      throw e;        // re-throw so OrderModal's local handler shows inline error
    }
  }, [notify]);

  /* Memoize sidebar action handler so Sidebar props are stable */
  const handleSidebarAction = useCallback((id) => {
    if (id === "wallet") setShowWallet(true);
    else if (id === "settings") setShowSettings(true);
  }, []);

  const handleClosePos = useCallback((p) => closePosition(p), [closePosition]);

  const tradeFromSignal = useCallback((pair, dir) => {
    const m = prices[pair] || {};
    handleOrder(pair, dir, dir === "BUY" ? m.ask : m.bid);
  }, [prices, handleOrder]);

  /* Loading */
  if (auth.loading) return (
    <div style={{ background:T.bg, height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14 }}>
      <style>{CSS}</style>
      <div style={{ fontSize:36, animation:"apexGlow 2s ease infinite" }}>⬡</div>
      <div style={{ ...cond, color:T.cyan, fontSize:22, fontWeight:800 }}>APEX<span style={{ color:T.green }}>FX</span></div>
    </div>
  );

  if (!auth.user) return (<><style>{CSS}</style><AuthScreen auth={auth} T={T} /><Toasts toasts={toasts} T={T} /></>);

  if (!wallet.ready) return (
    <div style={{ background:T.bg, height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14 }}>
      <style>{CSS}</style>
      <div style={{ fontSize:30, animation:"apexSpin 1.2s linear infinite" }}>◌</div>
      <div style={{ color:T.muted, fontSize:12 }}>Loading account…</div>
    </div>
  );

  return (
    <div style={{ display:"flex", background:T.bg, height:"100vh", overflow:"hidden", fontFamily:"'Barlow',sans-serif", color:T.text, backgroundImage:`linear-gradient(${T.cyan}06 1px,transparent 1px),linear-gradient(90deg,${T.cyan}06 1px,transparent 1px)`, backgroundSize:"48px 48px" }}>
      <style>{CSS}</style>

      <div style={{ position:"fixed", left:0, right:0, height:1, pointerEvents:"none", zIndex:9998, background:`linear-gradient(90deg,transparent,${T.cyan}40,transparent)`, animation:"apexScan 8s linear infinite" }}/>

      <Toasts toasts={toasts} T={T} />

      {orderModal   && <OrderModal pair={orderModal.pair} type={orderModal.type} prices={prices} wallet={wallet.wallet} onClose={()=>setOrderModal(null)} onConfirm={confirmOrder} T={T} />}
      {showWallet   && <WalletModal wallet={wallet.wallet} txHistory={wallet.txHistory} onDeposit={wallet.deposit} onWithdraw={wallet.withdraw} onClose={()=>setShowWallet(false)} T={T} />}
      {showSettings && <SettingsModal config={config} setConfig={setConfig} user={auth.user} theme={theme} setTheme={setTheme} onSignOut={()=>{ auth.signOut(); setShowSettings(false); }} onClose={()=>setShowSettings(false)} T={T} />}
      {showNotify   && <NotifyModal history={notifyHistory} onClose={()=>setShowNotify(false)} T={T} />}

      <Sidebar
        view={view} setView={setView}
        onAction={handleSidebarAction}
        time={time} wsStatus={wsStatus}
        balance={wallet.wallet.balance} user={auth.user}
        isMobile={isMobile} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}
        T={T}
      />

      <div className="apex-main" style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        <TopBar
          view={view} time={time} prices={prices} isMobile={isMobile}
          setDrawerOpen={setDrawerOpen} balance={wallet.wallet.balance}
          onWallet={()=>setShowWallet(true)}
          theme={theme} setTheme={setTheme}
          notifyCount={Math.max(0, notifyHistory.length - notifyReadCount)}
          onNotify={()=>{ setShowNotify(true); setNotifyReadCount(notifyHistory.length); }}
          T={T}
        />
        <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding: isMobile ? "12px" : "14px 16px" }}>
          {view === "dashboard"   && <DashboardView   prices={prices} candles={candles} wallet={wallet.wallet} positions={positions} trades={trades} signals={signals} watchlist={watchlist} onOrder={handleOrder} onClose={handleClosePos} onOpenWallet={()=>setShowWallet(true)} isMobile={isMobile} T={T} />}
          {view === "chart"       && <ChartView       candles={candles} prices={prices} signals={signals} onOrder={handleOrder} isMobile={isMobile} T={T} />}
          {view === "signals"     && <AISignalsPanel  signals={signals} loading={aiLoading} onGenerate={()=>genSignals(prices, candles)} onTrade={tradeFromSignal} isMobile={isMobile} T={T} />}
          {view === "watchlist"   && <WatchlistView   watchlist={watchlist} setWatchlist={setWatchlist} prices={prices} T={T} />}
          {view === "positions"   && <div style={card(T, { padding:14 })}><div style={{ color:T.cyan, fontSize:10, fontWeight:700, letterSpacing:2, marginBottom:11 }}>📂 OPEN POSITIONS ({positions.length})</div><PositionsList positions={positions} prices={prices} onClose={handleClosePos} isMobile={isMobile} T={T} /></div>}
          {view === "journal"     && <JournalView     trades={trades} journal={journal} setJournal={setJournal} isMobile={isMobile} T={T} />}
          {view === "backtest"    && <BacktestView    candles={candles} isMobile={isMobile} T={T} />}
          {view === "calendar"    && <EconomicCalendar isMobile={isMobile} T={T} />}
          {view === "news"        && <NewsFeed        isMobile={isMobile} T={T} />}
          {view === "analytics"   && <AnalyticsView   trades={trades} wallet={wallet.wallet} isMobile={isMobile} T={T} />}
          {view === "leaderboard" && <LeaderboardView wallet={wallet.wallet} user={auth.user} trades={trades} T={T} />}
        </div>
      </div>
    </div>
  );
}

/* Wrap entire app in ErrorBoundary so a single bug never blanks the screen */
export default function App() {
  return (
    <ErrorBoundary>
      <ApexFXApp />
    </ErrorBoundary>
  );
}
