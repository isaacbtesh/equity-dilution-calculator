# Equity Dilution Calculator

**Models equity investment returns accounting for dilution across funding rounds. Toggle between direct investments and fund/SPV structures with management fees and carry.**

🔗 **[Live demo →](https://equity-dilution-calculator.vercel.app)** _(deploy pending)_

<!-- TODO: replace with hero screenshot -->
<!-- ![Dilution Calculator](docs/hero.png) -->

## Why I built it

I work in venture and angel investing. Whenever I'm sizing up a check, I want to see what my ownership actually looks like after the next 3-4 rounds — not just at entry. Most online dilution calculators only model one round, ignore SPV economics, or assume you understand carry math. I built this to be the one I'd actually use myself: dilution across N rounds, fund vs. direct, MOIC after carry, all visualized.

## What it does

- **Direct Investment & Fund/SPV modes** — toggle between investing directly or through a fund with management fees and carry
- **Multi-round dilution modeling** — simulate ownership dilution across however many funding rounds you specify
- **Full returns analysis** — gross/net proceeds, MOIC, profit after carry
- **Interactive chart** — Recharts visualization of ownership over rounds
- **Plain-English tooltips** — hover explanations for MOIC, carry, dilution, SPV, etc. so it's usable without a finance background

## Default scenario

| Parameter | Default |
|---|---|
| Investment Amount | $200,000 |
| Post-Money Valuation | $20,000,000 |
| Dilution per Round | 15% |
| Management Fees | 10% |
| Carry to VC | 20% |
| Exit Valuation | $1,000,000,000 |

## Tech

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts · Lucide

## Run locally

```bash
git clone https://github.com/isaacbtesh/equity-dilution-calculator
cd equity-dilution-calculator
npm install
npm run dev
```

No API keys, no backend — pure client-side math.

