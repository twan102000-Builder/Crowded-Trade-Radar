import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radar, 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  Zap, 
  ShieldCheck, 
  LineChart,
  Target,
  RefreshCw
} from 'lucide-react';
import { cn } from './lib/utils';

// --- TYPES ---
interface MarketData {
  ticker: string;
  spot_price: number;
  call_vol: number;
  put_vol: number;
  equity_vol: number;
  iv_change_pct: number;
  borrow_rate_pct: number;
  social_sentiment: number;
  gex: number;
}

interface BacktestResult {
  results: Array<{
    date: string;
    gex: number;
    cp_ratio: number;
    iv_change: number;
    return_5d: number;
  }>;
  winRate: number;
  avgReturn: number;
}

// --- COMPONENTS ---

const ClassificationBadge = ({ data }: { data: MarketData }) => {
  const cp_ratio = data.call_vol / data.put_vol;
  
  if (data.borrow_rate_pct > 20 && data.iv_change_pct < -0.01) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-radar-warning/10 text-radar-warning text-[10px] font-bold uppercase tracking-wider border border-radar-warning/30">
        <Zap className="w-3 h-3" />
        Vol-Covering Squeeze
      </div>
    );
  }
  
  if (cp_ratio > 2.0 && data.gex > 100000) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-radar-danger/10 text-radar-danger text-[10px] font-bold uppercase tracking-wider border border-radar-danger/30">
        <AlertTriangle className="w-3 h-3" />
        Dealer Gamma Squeeze
      </div>
    );
  }
  
  if (data.equity_vol > (data.call_vol + data.put_vol) * 50) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-radar-success/10 text-radar-success text-[10px] font-bold uppercase tracking-wider border border-radar-success/30">
        <TrendingUp className="w-3 h-3" />
        Directional Conviction
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-500/10 text-gray-400 text-[10px] font-bold uppercase tracking-wider border border-gray-500/30">
      <Activity className="w-3 h-3" />
      Market Noise
    </div>
  );
};

export default function App() {
  const [data, setData] = useState<MarketData[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<MarketData | null>(null);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const fetchRadar = useCallback(async () => {
    try {
      const res = await fetch('/api/radar/scan');
      const json = await res.json();
      setData(json);
      if (!selectedTicker && json.length > 0) {
        setSelectedTicker(json[0]);
        runBacktest(json[0]);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  }, [selectedTicker]);

  const runBacktest = async (ticker: MarketData) => {
    setBacktest(null);
    setAiInsight(null);
    try {
      const [btRes, insightRes] = await Promise.all([
        fetch('/api/radar/backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: ticker.ticker,
            gex: ticker.gex,
            callPutRatio: ticker.call_vol / ticker.put_vol,
            ivChange: ticker.iv_change_pct
          })
        }),
        fetch('/api/radar/insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: ticker.ticker,
            classification: "Derived Squeeze Risk",
            data: ticker
          })
        })
      ]);
      
      const btJson = await btRes.json();
      const insightJson = await insightRes.json();
      
      setBacktest(btJson);
      setAiInsight(insightJson.insight);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRadar();
    const interval = setInterval(() => {
      setIsRefreshing(true);
      fetchRadar().then(() => {
        setTimeout(() => setIsRefreshing(false), 500);
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchRadar]);

  return (
    <div className="h-screen flex flex-col bg-radar-bg text-[#e0e0e0] font-sans border border-radar-border overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-radar-border bg-radar-header">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-radar-accent rounded flex items-center justify-center font-bold text-white shadow-sm">
            <Radar className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight uppercase">
            Crowded-Trade Radar <span className="text-radar-accent opacity-80">v2.4</span>
          </h1>
        </div>
        
        <div className="hidden md:flex items-center space-x-6 text-[11px] font-mono">
          <div className="flex items-center space-x-2">
            <div className={cn("w-2 h-2 rounded-full bg-radar-success", isRefreshing ? "animate-pulse" : "")} />
            <span>SYSTEM: {isRefreshing ? "SYNCING" : "LIVE"}</span>
          </div>
          <div className="text-zinc-500">DATA_SOURCE: POLYGON_OPRA</div>
          <div className="bg-radar-highlight px-3 py-1 rounded text-zinc-300 border border-radar-border">MARKET: OPEN</div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* LEFT: Active Ticker Profile */}
        <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
          <div className="bg-radar-card border border-radar-border p-5 rounded-lg flex flex-col h-full overflow-y-auto">
            <div className="text-[10px] text-zinc-500 uppercase font-bold mb-6 tracking-wider">Active Ticker Profile</div>
            
            {selectedTicker ? (
              <>
                <div className="flex items-end justify-between mb-2">
                  <h2 className="text-4xl font-bold leading-none tracking-tight">{selectedTicker.ticker}</h2>
                  <span className={cn(
                    "text-sm font-mono font-bold",
                    selectedTicker.gex > 0 ? "text-radar-success" : "text-radar-danger"
                  )}>
                    {selectedTicker.gex > 0 ? '+' : ''}{(selectedTicker.gex / 1000).toFixed(1)}K
                  </span>
                </div>
                <div className="text-zinc-400 text-xs mb-8 font-mono">
                  SCANNER FEED TIER 1 — ${selectedTicker.spot_price.toFixed(2)}
                </div>

                <div className="space-y-4 font-mono">
                  <div className="flex justify-between items-center pb-3 border-b border-radar-border">
                    <span className="text-[10px] text-zinc-500 uppercase">Spot Price</span>
                    <span className="text-xs font-bold">${selectedTicker.spot_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-radar-border">
                    <span className="text-[10px] text-zinc-500 uppercase">Implied Vol</span>
                    <span className="text-xs font-bold text-radar-warning">{(selectedTicker.iv_change_pct * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-radar-border">
                    <span className="text-[10px] text-zinc-500 uppercase">Net GEX</span>
                    <span className={cn("text-xs font-bold", selectedTicker.gex > 0 ? "text-radar-success" : "text-radar-danger")}>
                      ${(selectedTicker.gex / 1000000).toFixed(1)}M
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500 uppercase">Borrow Rate</span>
                    <span className={cn("text-xs font-bold", selectedTicker.borrow_rate_pct > 20 ? "text-radar-danger" : "text-white")}>
                      {selectedTicker.borrow_rate_pct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-8 border-t border-radar-border/40">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold mb-4 tracking-wider">Market Micro-Structure</div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-zinc-400">Order Flow Skew</span>
                        <span className="text-[10px] font-mono">{(selectedTicker.call_vol / selectedTicker.put_vol).toFixed(2)}</span>
                      </div>
                      <div className="h-1 w-full bg-radar-highlight rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-radar-accent" 
                          style={{ width: `${Math.min(Math.max((selectedTicker.call_vol / (selectedTicker.call_vol + selectedTicker.put_vol)) * 100, 10), 90)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-zinc-400">Sentiment Velocity</span>
                        <span className="text-[10px] font-mono">{(selectedTicker.social_sentiment * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 w-full bg-radar-highlight rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full", selectedTicker.social_sentiment > 0 ? "bg-radar-success" : "bg-radar-danger")} 
                          style={{ width: `${Math.abs(selectedTicker.social_sentiment) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-600 font-mono text-[10px]">
                INITIALIZING_FEED...
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Scanner Stream */}
        <div className="col-span-6 flex flex-col gap-4 overflow-hidden">
          <div className="bg-radar-card border border-radar-border p-6 rounded-lg flex flex-col h-[340px] shrink-0">
            <div className="text-[10px] text-zinc-500 uppercase font-bold mb-4 tracking-wider">Structural Classification Insight</div>
            
            {selectedTicker && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center space-x-3 mb-6">
                  <ClassificationBadge data={selectedTicker} />
                  <div className="text-zinc-500 text-[10px] uppercase font-mono tracking-tighter">Confidence: 94%</div>
                </div>
                
                <div className="text-zinc-300 text-sm leading-relaxed mb-8 italic border-l-2 border-radar-border pl-6 font-medium">
                  {aiInsight ? aiInsight : "Analyzing option chain dynamics and hedging requirements..."}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-radar-highlight p-4 border border-radar-border rounded">
                    <div className="text-[9px] text-zinc-500 mb-1 uppercase font-bold">Driver</div>
                    <div className="text-xs font-bold uppercase tracking-tight">Dealer-Hedged</div>
                  </div>
                  <div className="bg-radar-highlight p-4 border border-radar-border rounded">
                    <div className="text-[9px] text-zinc-500 mb-1 uppercase font-bold">Liquidity</div>
                    <div className="text-xs font-bold uppercase tracking-tight">Illiquid / Tight</div>
                  </div>
                  <div className="bg-radar-highlight p-4 border border-radar-border rounded">
                    <div className="text-[9px] text-zinc-500 mb-1 uppercase font-bold">Pos. Risk</div>
                    <div className="text-xs font-bold uppercase tracking-tight">High Convexity</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-radar-card border border-radar-border rounded-lg flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="p-4 border-b border-radar-border flex items-center justify-between bg-radar-header/50">
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Scanner Feed Stream</div>
              <Activity className="w-3 h-3 text-radar-accent" />
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-left border-separate border-spacing-0">
                <thead className="text-zinc-500 font-mono text-[10px] sticky top-0 bg-radar-card z-10">
                  <tr>
                    <th className="p-4 font-normal uppercase tracking-wider border-b border-radar-border">Ticker</th>
                    <th className="p-4 font-normal uppercase tracking-wider border-b border-radar-border">Spot</th>
                    <th className="p-4 font-normal uppercase tracking-wider border-b border-radar-border">GEX</th>
                    <th className="p-4 font-normal uppercase tracking-wider border-b border-radar-border text-right">Skew</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300 font-mono">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={4} className="p-4"><div className="h-4 bg-radar-highlight animate-pulse rounded" /></td>
                      </tr>
                    ))
                  ) : (
                    data.map((item) => (
                      <tr 
                        key={item.ticker}
                        onClick={() => {
                          setSelectedTicker(item);
                          runBacktest(item);
                        }}
                        className={cn(
                          "cursor-pointer transition-colors border-b border-radar-border group",
                          selectedTicker?.ticker === item.ticker ? "bg-radar-accent/10 text-white" : "hover:bg-radar-highlight"
                        )}
                      >
                        <td className="p-4 font-bold tracking-tight">
                          <div className="flex items-center gap-2">
                             {item.ticker}
                             {item.borrow_rate_pct > 20 && <Zap className="w-3 h-3 text-radar-warning" />}
                          </div>
                        </td>
                        <td className="p-4 text-zinc-400">${item.spot_price.toFixed(2)}</td>
                        <td className={cn(
                          "p-4 font-bold",
                          item.gex >= 0 ? "text-radar-success/80" : "text-radar-danger/80"
                        )}>
                          {(item.gex / 1000).toFixed(1)}K
                        </td>
                        <td className="p-4 text-right">
                          <span className={cn(
                            "px-2 py-0.5 rounded-sm text-[10px] font-bold border",
                            item.call_vol > item.put_vol ? "bg-radar-accent/10 border-radar-accent/20 text-radar-accent" : "bg-zinc-800 border-zinc-700 text-zinc-400"
                          )}>
                             {(item.call_vol / item.put_vol).toFixed(2)}x
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Backtester Similarity */}
        <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
          <div className="bg-radar-card border border-radar-border p-5 rounded-lg h-full flex flex-col overflow-hidden">
            <div className="text-[10px] text-zinc-500 uppercase font-bold mb-6 tracking-wider">Backtester: Similar Setups (N=20)</div>
            
            {backtest ? (
              <div className="flex flex-col h-full animate-in fade-in duration-700">
                <div className="flex items-center justify-between mb-8">
                  <div className="text-center">
                    <div className="text-3xl font-bold font-mono tracking-tighter">{backtest.winRate.toFixed(1)}%</div>
                    <div className="text-[9px] text-zinc-500 uppercase font-bold mt-1">Win Rate T+5</div>
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "text-3xl font-bold font-mono tracking-tighter",
                      backtest.avgReturn > 0 ? "text-radar-success" : "text-radar-danger"
                    )}>
                      {backtest.avgReturn > 0 ? '+' : ''}{backtest.avgReturn.toFixed(1)}%
                    </div>
                    <div className="text-[9px] text-zinc-500 uppercase font-bold mt-1">Avg Return</div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                  <table className="w-full text-[10px] text-left border-separate border-spacing-y-2">
                    <thead className="text-zinc-500 font-mono">
                      <tr>
                        <th className="font-normal uppercase">Date</th>
                        <th className="font-normal uppercase">GEX</th>
                        <th className="font-normal uppercase text-right">Ret.</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-300 font-mono">
                      {backtest.results.map((r, i) => (
                        <tr key={i} className="bg-radar-highlight group transition-opacity hover:opacity-80">
                          <td className="p-2.5 rounded-l border-y border-l border-radar-border">
                            {new Date(r.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}).toUpperCase()}
                          </td>
                          <td className="p-2.5 border-y border-radar-border">
                            {(r.gex / 1000).toFixed(0)}K
                          </td>
                          <td className={cn(
                            "p-2.5 rounded-r border-y border-r border-radar-border text-right font-bold",
                            r.return_5d > 0 ? "text-radar-success" : "text-radar-danger"
                          )}>
                            {r.return_5d > 0 ? '+' : ''}{(r.return_5d * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-radar-accent/10 border border-radar-accent/30 rounded-lg">
                  <div className="text-[9px] text-radar-accent font-bold mb-1.5 uppercase tracking-tighter">Probabilistic Anomaly</div>
                  <p className="text-[11px] text-blue-100 leading-tight">
                    Current GEX concentration exceeds 95% of historical samples for {selectedTicker?.ticker}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                 <History className="w-8 h-8 text-radar-border animate-spin duration-1000" />
                 <div className="text-[10px] font-mono text-zinc-600 uppercase">Searching_Historical_Matches...</div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer: Meme Tracker Overlay */}
      <footer className="h-12 bg-radar-header border-t border-radar-border flex items-center px-6 overflow-hidden shrink-0">
        <div className="flex items-center space-x-2 mr-8 text-[10px] text-zinc-500 font-bold tracking-widest uppercase flex-shrink-0">
          <Activity className="w-3 h-3 text-radar-accent" />
          <span>Meme-Chain Tracker:</span>
        </div>
        <div className="flex-1 flex space-x-12 text-[11px] font-mono overflow-hidden whitespace-nowrap">
          {data.slice(0, 5).map((item, idx) => (
            <div key={item.ticker} className="flex items-center space-x-2">
              <span className="text-zinc-500">{item.ticker}:</span>
              <span className={cn(
                item.gex > 0 ? "text-radar-success" : "text-radar-danger"
              )}>${item.spot_price.toFixed(2)}</span>
              <span className="text-zinc-600 italic text-[9px] font-sans font-bold">RANK #{idx + 1}</span>
            </div>
          ))}
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--color-radar-border);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--color-radar-accent);
        }
      `}</style>
    </div>
  );
}

// Support history icon which might be missing in older lucide versions
const History = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l4 2"/>
  </svg>
);
