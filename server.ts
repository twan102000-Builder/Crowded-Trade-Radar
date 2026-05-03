import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI(process.env.GEMINI_API_KEY) : null;

// --- QUANT ENGINE ---

const TICKERS = ["SPY", "QQQ", "USO", "OXY", "GME", "AMC", "TSLA", "NVDA", "MSTR"];

interface MarketData {
  ticker: string;
  spot_price: number;
  call_vol: number;
  put_vol: number;
  equity_vol: number;
  iv_change_pct: number;
  borrow_rate_pct: number;
  social_sentiment: number; // -1 to 1
  gex: number;
  risk_score: number; // 0 to 100
  stop_loss: number;
}

function calculateRiskScore(data: Partial<MarketData>): number {
  let score = 0;
  if (data.borrow_rate_pct && data.borrow_rate_pct > 20) score += 30;
  if (data.iv_change_pct && Math.abs(data.iv_change_pct) > 0.05) score += 20;
  if (data.gex && Math.abs(data.gex) > 500000) score += 30;
  if (data.social_sentiment && Math.abs(data.social_sentiment) > 0.7) score += 20;
  return Math.min(score, 100);
}

function generateMockMarketData(ticker: string): MarketData {
  const spot = ticker === "SPY" ? 500 + Math.random() * 50 : 10 + Math.random() * 200;
  const call_vol = Math.floor(Math.random() * 100000);
  const put_vol = Math.floor(Math.random() * 80000);
  const gex = (call_vol - put_vol) * (spot * 0.002) * (Math.random() * 2);
  const borrow_rate = ticker === "GME" || ticker === "AMC" ? Math.random() * 50 : Math.random() * 5;
  const iv_change = (Math.random() - 0.5) * 0.1;
  const sentiment = (Math.random() - 0.5) * 2;
  
  const partialData = { borrow_rate_pct: borrow_rate, iv_change_pct: iv_change, gex, social_sentiment: sentiment };
  const risk_score = calculateRiskScore(partialData);
  const stop_loss = spot * (1 - (0.02 + Math.random() * 0.05));

  return {
    ticker,
    spot_price: spot,
    call_vol,
    put_vol,
    equity_vol: Math.floor(Math.random() * 10000000),
    iv_change_pct: iv_change,
    borrow_rate_pct: borrow_rate,
    social_sentiment: sentiment,
    gex,
    risk_score,
    stop_loss
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/radar/scan', async (req, res) => {
    // In a real app, you'd check process.env.POLYGON_API_KEY here
    // for (const ticker of TICKERS) { fetchFromPolygon(ticker) }
    const data = TICKERS.map(ticker => generateMockMarketData(ticker));
    res.json(data);
  });

  app.post('/api/radar/backtest', (req, res) => {
    const { ticker, gex, callPutRatio, ivChange } = req.body;
    
    // Simulate finding 20 nearest neighbors by generating a focused historical slice
    const results = Array.from({ length: 20 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (i + 1) * 7);
      
      return {
        date: date.toISOString().split('T')[0],
        gex: gex * (0.9 + Math.random() * 0.2),
        cp_ratio: callPutRatio * (0.9 + Math.random() * 0.2),
        iv_change: ivChange * (0.9 + Math.random() * 0.2),
        return_5d: (Math.random() - 0.4) * 0.1 // Slight positive bias for demo
      };
    });

    const winRate = (results.filter(r => r.return_5d > 0).length / results.length) * 100;
    const avgReturn = (results.reduce((acc, r) => acc + r.return_5d, 0) / results.length) * 100;

    res.json({ results, winRate, avgReturn });
  });

  app.post('/api/radar/insight', async (req, res) => {
    const { ticker, classification, data } = req.body;
    
    if (!genAI) {
      return res.json({ insight: "AI analysis unavailable (Missing API Key). Manual override: Technical indicators suggest structural crowding." });
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Act as a quantitative macro analyst. Ticker: ${ticker}. Classification: ${classification}. 
      Current Data: GEX ${data.gex}, Borrow Rate ${data.borrow_rate_pct}%, IV Change ${data.iv_change_pct}%.
      Provide a 2-sentence sharp insight on the structural risk of this trade.`;
      
      const result = await model.generateContent(prompt);
      res.json({ insight: result.response.text() });
    } catch (err) {
      res.status(500).json({ error: "Failed to generate insight" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Radar Engine live at http://localhost:${PORT}`);
  });
}

startServer();
