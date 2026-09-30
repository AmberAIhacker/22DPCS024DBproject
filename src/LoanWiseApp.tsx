import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";

const RepaymentCharts = lazy(() => import("./RepaymentCharts"));

type Installment = {
  month: number;
  date: Date;
  openingBalance: number;
  emi: number;
  extra: number;
  lumpSum: number;
  interest: number;
  principal: number;
  closingBalance: number;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const formatINR = (amount: number) => currency.format(Number.isFinite(amount) ? amount : 0);
const formatReportINR = (amount: number) => `INR ${Math.round(amount).toLocaleString("en-IN")}`;
const formatCompact = (amount: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
const isoDate = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};
const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  return result;
};
const formatDate = (date: Date) =>
  date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function createSchedule(
  balanceAtStart: number,
  monthlyRate: number,
  emi: number,
  extraMonthly: number,
  lumpSum: number,
  firstPaymentDate: Date
): Installment[] {
  let balance = balanceAtStart;
  const rows: Installment[] = [];

  for (let month = 1; balance > 0.005 && month <= 1200; month += 1) {
    const openingBalance = balance;
    const interest = openingBalance * monthlyRate;
    const extra = extraMonthly;
    const lumpSumThisMonth = month === 1 ? lumpSum : 0;
    const totalPayment = Math.min(openingBalance + interest, emi + extra + lumpSumThisMonth);
    const principal = Math.max(0, totalPayment - interest);
    balance = Math.max(0, openingBalance - principal);

    rows.push({
      month,
      date: addMonths(firstPaymentDate, month - 1),
      openingBalance,
      emi: Math.min(emi, totalPayment),
      extra: Math.min(extra, Math.max(0, totalPayment - Math.min(emi, totalPayment))),
      lumpSum: Math.min(lumpSumThisMonth, Math.max(0, totalPayment - emi - extra)),
      interest,
      principal,
      closingBalance: balance,
    });
  }

  return rows;
}

function LoanWiseApp() {
  const [loanAmount, setLoanAmount] = useState(1000000);
  const [interestRate, setInterestRate] = useState(10);
  const [tenure, setTenure] = useState(10);
  const [moratorium, setMoratorium] = useState(12);
  const [extraPayment, setExtraPayment] = useState(1500);
  const [oneTimePayment, setOneTimePayment] = useState(0);
  const [firstPaymentDate, setFirstPaymentDate] = useState(() => isoDate(addMonths(new Date(), 1)));
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return window.localStorage.getItem("loanwise-theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const safeLoan = Math.max(0, loanAmount);
  const safeRate = Math.max(0, interestRate);
  const safeTenure = Math.max(1, tenure);
  const safeMoratorium = Math.max(0, moratorium);
  const monthlyRate = safeRate / 1200;
  const repaymentMonths = safeTenure * 12;
  const moratoriumInterest = safeLoan * (Math.pow(1 + monthlyRate, safeMoratorium) - 1);
  const balanceAtRepayment = safeLoan + moratoriumInterest;
  const emi = monthlyRate === 0
    ? balanceAtRepayment / repaymentMonths
    : balanceAtRepayment * monthlyRate * Math.pow(1 + monthlyRate, repaymentMonths) /
      (Math.pow(1 + monthlyRate, repaymentMonths) - 1);
  const repaymentDate = useMemo(() => {
    const parsed = new Date(`${firstPaymentDate}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }, [firstPaymentDate]);

  const standardSchedule = useMemo(
    () => createSchedule(balanceAtRepayment, monthlyRate, emi, 0, 0, repaymentDate),
    [balanceAtRepayment, monthlyRate, emi, repaymentDate]
  );
  const prepaymentSchedule = useMemo(
    () => createSchedule(balanceAtRepayment, monthlyRate, emi, Math.max(0, extraPayment), Math.max(0, oneTimePayment), repaymentDate),
    [balanceAtRepayment, monthlyRate, emi, extraPayment, oneTimePayment, repaymentDate]
  );
  const standardInterest = moratoriumInterest + standardSchedule.reduce((total, row) => total + row.interest, 0);
  const prepaymentInterest = moratoriumInterest + prepaymentSchedule.reduce((total, row) => total + row.interest, 0);
  const interestSaved = Math.max(0, standardInterest - prepaymentInterest);
  const monthsSaved = Math.max(0, standardSchedule.length - prepaymentSchedule.length);
  const payoffYears = Math.floor(prepaymentSchedule.length / 12);
  const payoffMonths = prepaymentSchedule.length % 12;
  const monthlyTable = useMemo(() => prepaymentSchedule.map((row, index) => ({
    ...row,
    standardBalance: standardSchedule[index]?.closingBalance ?? 0,
  })), [prepaymentSchedule, standardSchedule]);
  const chartData = useMemo(() => {
    const totalMonths = Math.max(standardSchedule.length, prepaymentSchedule.length);
    return Array.from({ length: totalMonths + 1 }, (_, month) => {
      if (month === 0) {
        return { month, standard: balanceAtRepayment, prepayment: balanceAtRepayment, principal: 0, interest: 0 };
      }
      const standard = standardSchedule[month - 1];
      const accelerated = prepaymentSchedule[month - 1];
      return {
        month,
        standard: standard?.closingBalance ?? 0,
        prepayment: accelerated?.closingBalance ?? 0,
        principal: accelerated?.principal ?? 0,
        interest: accelerated?.interest ?? 0,
      };
    });
  }, [balanceAtRepayment, standardSchedule, prepaymentSchedule]);

  const setThemeMode = (nextTheme: "dark" | "light") => {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem("loanwise-theme", nextTheme);
    } catch {
      // Theme remains available for this session if storage is disabled.
    }
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const generatePDF = async () => {
    setError("");
    if (loanAmount <= 0 || interestRate < 0 || tenure < 1 || moratorium < 0 || extraPayment < 0 || oneTimePayment < 0) {
      setError("Please check the loan and prepayment values before downloading the report.");
      return;
    }

    let jsPDF: (typeof import("jspdf"))["jsPDF"];
    try {
      ({ jsPDF } = await import("jspdf"));
    } catch {
      setError("The report could not be loaded. Please try again.");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 15;

    doc.setFillColor(12, 18, 14);
    doc.rect(0, 0, pageWidth, 58, "F");
    doc.setTextColor(184, 255, 126);
    doc.setFontSize(10);
    doc.text("LOANWISE  /  STUDENT FINANCE", left, 15);
    doc.setTextColor(248, 250, 246);
    doc.setFontSize(25);
    doc.text("Repayment plan", left, 29);
    doc.setTextColor(190, 200, 191);
    doc.setFontSize(10);
    doc.text(`Prepared ${formatDate(new Date())}   •   First payment ${formatDate(repaymentDate)}`, left, 39);
    doc.setFillColor(24, 35, 26);
    doc.roundedRect(left, 48, pageWidth - left * 2, 27, 3, 3, "F");

    const summary: [string, string][] = [
      ["Loan amount", formatReportINR(safeLoan)],
      ["Monthly EMI", formatReportINR(emi)],
      ["Interest saved", formatReportINR(interestSaved)],
      ["Payoff", `${payoffYears}y ${payoffMonths}m`],
    ];
    const summaryWidth = (pageWidth - left * 2) / summary.length;
    summary.forEach(([label, value], index) => {
      const x = left + index * summaryWidth + 5;
      doc.setTextColor(154, 169, 156);
      doc.setFontSize(8);
      doc.text(label.toUpperCase(), x, 57);
      doc.setTextColor(184, 255, 126);
      doc.setFontSize(13);
      doc.text(value, x, 68);
    });

    doc.setTextColor(30, 40, 32);
    doc.setFontSize(9);
    doc.text(`Rate ${safeRate}% p.a. | Repayment tenure ${safeTenure} years | Moratorium ${safeMoratorium} months | Extra per month ${formatReportINR(extraPayment)} | One-time prepayment ${formatReportINR(oneTimePayment)}`, left, 84);
    doc.setFontSize(8);
    doc.setTextColor(105, 118, 108);
    doc.text(`Estimated total interest with this plan: ${formatINR(prepaymentInterest)}. Moratorium interest is assumed to capitalize monthly.`, left, 91);

    let y = 103;
    const columns = [left, 50, 80, 108, 137, 166, 202];
    const drawTableHeader = () => {
      doc.setFillColor(231, 238, 231);
      doc.rect(left, y - 5, pageWidth - left * 2, 8, "F");
      doc.setTextColor(43, 58, 45);
      doc.setFontSize(7.5);
      ["PAYMENT DATE", "EMI", "EXTRA", "INTEREST", "PRINCIPAL", "TOTAL PAID", "BALANCE"].forEach((label, index) => {
        doc.text(label, columns[index], y);
      });
      y += 8;
    };
    drawTableHeader();
    doc.setFontSize(7.5);
    monthlyTable.forEach((row) => {
      if (y > pageHeight - 15) {
        doc.addPage();
        y = 16;
        drawTableHeader();
      }
      const values = [
        formatDate(row.date),
        formatReportINR(row.emi),
        formatReportINR(row.extra + row.lumpSum),
        formatReportINR(row.interest),
        formatReportINR(row.principal),
        formatReportINR(row.emi + row.extra + row.lumpSum),
        formatReportINR(row.closingBalance),
      ];
      doc.setTextColor(45, 55, 47);
      values.forEach((value, index) => doc.text(value, columns[index], y));
      doc.setDrawColor(229, 234, 228);
      doc.line(left, y + 2, pageWidth - left, y + 2);
      y += 7;
    });

    if (y > pageHeight - 30) {
      doc.addPage();
      y = 18;
    }
    y += 5;
    doc.setTextColor(70, 82, 72);
    doc.setFontSize(8);
    doc.text(`Standard plan interest: ${formatReportINR(standardInterest)} | Prepayment plan interest: ${formatReportINR(prepaymentInterest)} | Interest saved: ${formatReportINR(interestSaved)} | Months saved: ${monthsSaved}`, left, y);
    y += 8;
    doc.setTextColor(112, 120, 113);
    doc.setFontSize(7);
    doc.text("Illustrative estimate only. Actual lender calculations, rate changes, fees, tax benefits, and prepayment rules may differ. Confirm terms with your lender.", left, y);
    doc.save("loanwise-repayment-plan.pdf");
  };

  const extraMax = Math.max(10000, Math.ceil(emi));

  return (
    <div className="app" data-theme={theme}>
      <header className="header">
        <a className="brand" href="#top" aria-label="LoanWise home">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span><strong>loanwise</strong><small>STUDENT FINANCE</small></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#calculator">Calculator</a><a href="#insights">Insights</a><a href="#learn">Learn</a><a href="#faq">FAQ</a>
        </nav>
        <div className="header-actions">
          {installPrompt && <button className="install-btn" onClick={() => void installApp()}><span aria-hidden="true">↓</span> Install</button>}
          <button className="theme-toggle" onClick={() => setThemeMode(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title="Toggle color theme"><span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span><span>{theme === "dark" ? "Light" : "Dark"}</span></button>
          <button className="pdf-btn" onClick={generatePDF}><span aria-hidden="true">↓</span> Export report</button>
        </div>
      </header>

      <main id="top">
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow"><i /> YOUR DEGREE. YOUR PLAN.</span>
            <h1>Make your loan<br /><span>work around you.</span></h1>
            <p>See your real EMI, test extra payments, and build a clear path from graduation to debt-free.</p>
            <a className="hero-link" href="#calculator">Build my repayment plan <span aria-hidden="true">↘</span></a>
          </div>
          <div className="hero-note" aria-label="Live estimate summary">
            <span className="hero-note-label">YOUR PLAN, IN REAL TIME</span><span className="hero-note-value">{formatINR(emi)}<small> / month</small></span><span className="hero-note-caption">Estimated EMI after your moratorium</span>
            <div className="hero-note-rule"><i style={{ width: `${Math.min(100, Math.max(8, (interestSaved / Math.max(standardInterest, 1)) * 100))}%` }} /></div>
            <span className="hero-note-footer"><span>Potential interest saved</span><strong>{formatINR(interestSaved)}</strong></span>
          </div>
          <span className="hero-index" aria-hidden="true">01 / PLAN AHEAD</span>
        </section>

        <section className="calculator-section container" id="calculator">
          <div className="section-title"><div><span className="eyebrow">THE REPAYMENT LAB</span><h2>Tune your plan</h2></div><p>Every adjustment updates your numbers instantly.</p></div>
          <div className="calculator-grid">
            <section className="panel input-panel" aria-labelledby="loan-inputs-title">
              <div className="panel-heading"><span className="step-number">01</span><div><h3 id="loan-inputs-title">Loan details</h3><p>Start with your lender's offer</p></div></div>
              <label className="field-label" htmlFor="loan-amount">Loan amount <span>INR</span></label>
              <div className="amount-input-wrap"><span>₹</span><input id="loan-amount" type="number" min="50000" max="50000000" step="50000" value={loanAmount} onChange={(event) => setLoanAmount(Number(event.target.value) || 0)} /></div>
              <input className="range-input" aria-label="Loan amount slider" type="range" min="50000" max="50000000" step="50000" value={Math.min(50000000, Math.max(50000, loanAmount))} onChange={(event) => setLoanAmount(Number(event.target.value))} />
              <div className="range-ends"><span>₹50K</span><span>₹5 Cr</span></div>
              <div className="field-row"><label className="field-label" htmlFor="interest-rate">Interest rate</label><strong className="field-value">{interestRate}% <span>p.a.</span></strong></div>
              <input id="interest-rate" className="range-input" aria-label="Interest rate slider" type="range" min="0" max="20" step="0.1" value={interestRate} onChange={(event) => setInterestRate(Number(event.target.value))} />
              <div className="range-ends"><span>0%</span><span>20%</span></div>
              <div className="field-row"><label className="field-label" htmlFor="tenure">Repayment tenure</label><strong className="field-value">{tenure} <span>years</span></strong></div>
              <input id="tenure" className="range-input" aria-label="Repayment tenure slider" type="range" min="1" max="20" step="1" value={tenure} onChange={(event) => setTenure(Number(event.target.value))} />
              <div className="range-ends"><span>1 year</span><span>20 years</span></div>
              <div className="field-pair">
                <div><label className="field-label" htmlFor="moratorium">Moratorium</label><div className="compact-input"><input id="moratorium" type="number" min="0" max="60" value={moratorium} onChange={(event) => setMoratorium(Math.min(60, Math.max(0, Number(event.target.value) || 0)))} /><span>months</span></div></div>
                <div><label className="field-label" htmlFor="first-payment">First EMI date</label><input className="date-input" id="first-payment" type="date" value={firstPaymentDate} onChange={(event) => setFirstPaymentDate(event.target.value)} /></div>
              </div>
              <p className="field-hint">Moratorium interest is assumed to be added to your balance each month.</p>
            </section>

            <section className="panel prepay-panel" aria-labelledby="prepay-title">
              <div className="panel-heading"><span className="step-number step-accent">02</span><div><h3 id="prepay-title">Try paying extra</h3><p>Small top-ups can change the finish line</p></div></div>
              <div className="emi-callout"><span>YOUR ESTIMATED MONTHLY EMI</span><strong>{formatINR(emi)}</strong><small>For {tenure} years after the {moratorium}-month moratorium</small></div>
              <div className="field-row extra-row"><label className="field-label" htmlFor="extra-payment">Extra every month</label><strong className="field-value">{formatINR(extraPayment)}</strong></div>
              <input id="extra-payment" className="range-input" aria-label="Extra monthly payment slider" type="range" min="0" max={extraMax} step="500" value={Math.min(extraMax, extraPayment)} onChange={(event) => setExtraPayment(Number(event.target.value))} />
              <div className="range-ends"><span>₹0</span><span>{formatINR(extraMax)}</span></div>
              <div className="preset-row" aria-label="Extra payment presets">{[0, 1000, 2500, 5000].map((amount) => <button className={extraPayment === amount ? "preset active" : "preset"} key={amount} onClick={() => setExtraPayment(amount)}>{amount === 0 ? "None" : `+${formatINR(amount)}`}</button>)}</div>
              <label className="field-label lump-label" htmlFor="lump-sum">One-time payment <span>AT FIRST EMI</span></label>
              <div className="amount-input-wrap"><span>₹</span><input id="lump-sum" type="number" min="0" max={balanceAtRepayment} step="10000" value={oneTimePayment} onChange={(event) => setOneTimePayment(Math.min(balanceAtRepayment, Math.max(0, Number(event.target.value) || 0)))} /></div>
              <div className="live-savings"><div className="savings-icon" aria-hidden="true">↗</div><p>With this plan, you could save <strong>{formatINR(interestSaved)}</strong> in interest and finish <strong>{monthsSaved} months earlier</strong>.</p></div>
            </section>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="results-grid" aria-live="polite">
            <article className="result-card"><span>MONTHLY EMI</span><strong>{formatINR(emi)}</strong><small>Standard monthly installment</small></article>
            <article className="result-card"><span>TOTAL INTEREST</span><strong>{formatINR(standardInterest)}</strong><small>Without extra payments</small></article>
            <article className="result-card result-positive"><span>INTEREST SAVED</span><strong>{formatINR(interestSaved)}</strong><small>By your prepayment plan</small></article>
            <article className="result-card result-positive"><span>TIME SAVED</span><strong>{monthsSaved} <small>months</small></strong><small>Earlier than standard payoff</small></article>
          </div>
        </section>

        <section className="insights-section container" id="insights">
          <div className="section-title"><div><span className="eyebrow">SEE THE DIFFERENCE</span><h2>Two ways to pay it off</h2></div><p>Compare your balance over the life of the loan.</p></div>
          <div className="panel chart-panel">
            <Suspense fallback={<div className="chart-loading" aria-label="Loading charts" />}>
              <RepaymentCharts data={chartData} formatCurrency={formatINR} formatCompact={formatCompact} />
            </Suspense>
            <div className="comparison-strip"><div><span>STANDARD PAYOFF</span><strong>{Math.floor(standardSchedule.length / 12)}y {standardSchedule.length % 12}m</strong></div><span className="comparison-arrow" aria-hidden="true">→</span><div><span>WITH PREPAYMENT</span><strong>{payoffYears}y {payoffMonths}m</strong></div><div className="comparison-saving"><span>YOU KEEP</span><strong>{formatINR(interestSaved)}</strong></div></div>
          </div>
        </section>

        <section className="schedule-section container">
          <div className="section-title"><div><span className="eyebrow">MONTH BY MONTH</span><h2>Your repayment roadmap</h2></div><button className="text-action" onClick={generatePDF}><span aria-hidden="true">↓</span> Download full schedule</button></div>
          <div className="panel table-panel"><div className="table-intro"><span>{monthlyTable.length} monthly payments</span><span>First payment: {formatDate(repaymentDate)}</span></div><div className="table-scroll"><table><thead><tr><th>Payment date</th><th>Opening balance</th><th>EMI</th><th>Extra</th><th>Interest</th><th>Principal paid</th><th>Closing balance</th></tr></thead><tbody>{monthlyTable.map((row) => <tr key={row.month}><td>{formatDate(row.date)}<small>Month {row.month}</small></td><td>{formatINR(row.openingBalance)}</td><td>{formatINR(row.emi)}</td><td>{formatINR(row.extra + row.lumpSum)}</td><td>{formatINR(row.interest)}</td><td>{formatINR(row.principal)}</td><td className="balance-cell">{formatINR(row.closingBalance)}</td></tr>)}</tbody></table></div><p className="table-footnote">The schedule is an estimate. Your lender's posting dates and rounding rules may differ.</p></div>
        </section>

        <section className="learn-section container" id="learn">
          <div className="section-title"><div><span className="eyebrow">A LITTLE FINANCIAL CLARITY</span><h2>Know what you're choosing</h2></div><p>Three ideas that make the numbers easier to use.</p></div>
          <div className="learn-grid">
            <article className="learn-card"><span>01 / EMI</span><h3>Your EMI has two jobs</h3><p>Each installment pays interest for that month, then reduces principal. Early in repayment, the interest share is larger. As the balance falls, more of each EMI reaches principal.</p></article>
            <article className="learn-card"><span>02 / PREPAYMENT</span><h3>Earlier can mean less interest</h3><p>Extra principal reduces the balance used to calculate future interest. Check your lender's part-payment rules, minimum amounts and any charges before paying extra.</p></article>
            <article className="learn-card"><span>03 / MORATORIUM</span><h3>A pause may still have a cost</h3><p>Interest can continue during study or grace periods. This estimate assumes it is added to the loan balance monthly; ask your lender how your account handles it.</p></article>
          </div>
        </section>

        <section className="how-section container">
          <div className="how-heading"><span className="eyebrow">HOW IT WORKS</span><h2>From offer letter to a plan.</h2></div>
          <div className="how-steps"><article><span>01</span><h3>Enter your terms</h3><p>Loan amount, rate, tenure and moratorium.</p></article><article><span>02</span><h3>Try a top-up</h3><p>Adjust monthly or one-time prepayments.</p></article><article><span>03</span><h3>Take your roadmap</h3><p>Compare outcomes and export your schedule.</p></article></div>
        </section>

        <section className="faq-section container" id="faq">
          <div className="section-title"><div><span className="eyebrow">GOOD QUESTIONS</span><h2>Before you decide</h2></div><p>Estimates help you plan. Your lender has the final word.</p></div>
          <div className="faq-list"><details><summary>Does the calculator include the moratorium period?</summary><p>Yes. It assumes interest accrues monthly and is capitalized during the moratorium, then calculates EMI over the selected repayment tenure.</p></details><details><summary>Will my actual EMI match this estimate?</summary><p>Not always. Lenders may use different day-count conventions, rate reset schedules, disbursement timing, fees, subsidies or rounding rules.</p></details><details><summary>Can I make prepayments whenever I want?</summary><p>That depends on your lender and loan agreement. Confirm part-payment limits, notice requirements, minimum payment amounts and applicable charges first.</p></details><details><summary>Does this include tax benefits or processing fees?</summary><p>No. This is a principal-and-interest estimate. It does not include fees, insurance, tax treatment, subsidies or other account-specific adjustments.</p></details></div>
+        </section>

        <section className="disclaimer container"><span aria-hidden="true">i</span><p><strong>Planning estimate, not financial advice.</strong> This tool is for education and comparison only. Verify all terms, repayment dates, interest treatment and prepayment conditions with your lender before making a financial decision.</p></section>
      </main>

      <footer className="footer"><a className="brand footer-brand" href="#top"><span className="brand-mark" aria-hidden="true">L</span><span><strong>loanwise</strong><small>STUDENT FINANCE</small></span></a><span>Built to make the numbers feel more human.</span><a href="#top">Back to top ↑</a></footer>
    </div>
  );
}

export default LoanWiseApp;
