# 22DPCS024DBproject

## LoanWise

A student education-loan EMI and early-prepayment planner built with React, TypeScript, and Vite.

## Run locally

```sh
npm install
npm run dev
```

## Features

- Live EMI and payoff estimates with linked amount, interest-rate, tenure, and prepayment controls.
- Standard-versus-prepayment balance chart and principal-versus-interest chart.
- Dated month-by-month repayment schedule.
- Dark/light theme, financial education, FAQs, and a downloadable repayment report.

## Calculation assumptions

The estimate uses a fixed annual interest rate divided into monthly periods. Interest during the moratorium is assumed to capitalize monthly. The selected tenure is the repayment period after the moratorium. Extra monthly payments begin with the first EMI, and the one-time payment is applied with the first EMI. Fees, subsidies, tax effects, rate resets, and lender-specific rounding are excluded. Confirm your loan agreement with your lender before making decisions.

## Production build

```sh
npm run build
npm run preview
```

## Publish with GitHub and Vercel

1. Create a GitHub repository and push this project to it.
2. In Vercel, import the GitHub repository and keep the detected Vite defaults.
3. Deploy. Vercel runs `npm run build` and serves the generated `dist` directory.

The build output is ignored by Git; commit the source files and lockfile, not `dist/` or `node_modules/`.
