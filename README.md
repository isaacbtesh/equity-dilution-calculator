# Equity Dilution Calculator

A web-based calculator that models equity investment returns accounting for dilution across funding rounds. Built for investors evaluating direct investments or fund/SPV structures.

## Features

- **Direct Investment & Fund/SPV modes** - Toggle between investing directly or through a fund with management fees and carry
- **Dilution modeling** - Simulate ownership dilution across multiple funding rounds
- **Returns analysis** - Calculate gross/net proceeds, MOIC, and profit after carry
- **Interactive chart** - Visualize ownership dilution over rounds with Recharts
- **Tooltips** - Hover explanations for financial terms (MOIC, carry, dilution, SPV, etc.)

## Default Parameters

| Parameter | Default |
|---|---|
| Investment Amount | $200,000 |
| Post-Money Valuation | $20,000,000 |
| Dilution per Round | 15% |
| Management Fees | 10% |
| Carry to VC | 20% |
| Exit Valuation | $1,000,000,000 |

## Tech Stack

- [Next.js 14](https://nextjs.org/) with App Router
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) for data visualization
- [Lucide React](https://lucide.dev/) for icons

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy to Vercel

The easiest way to deploy is with [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import the repository on [vercel.com/new](https://vercel.com/new)
3. Vercel will auto-detect Next.js and deploy

## Author

Built by [@defikito](https://twitter.com/defikito) | [LinkedIn](https://www.linkedin.com/in/isaacbtesh/)
