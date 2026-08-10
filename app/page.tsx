"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, HelpCircle, Plus, Printer, Share2, Trash2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type InvestmentType = "direct" | "spv" | "fund";
type ModelMode = "quick" | "rounds";

interface Round {
  id: number;
  label: string;
  raise: string;
  post: string;
  proRata: string;
}

interface ScheduleRow {
  label: string;
  raise: number;
  post: number;
  pre: number;
  fullProRataCheck: number;
  followOnSubscription: number;
  ownershipAfter: number;
  passiveAfter: number;
}

interface ChartPoint {
  round: string;
  yours: number;
  passive: number;
}

interface CompanyResults {
  kind: "company";
  entryDeployed: number;
  entryOwnership: number;
  finalOwnership: number;
  passiveFinal: number;
  deployed: number;
  subscribed: number;
  followOnDeployed: number;
  feesPaid: number;
  grossProceeds: number;
  grossProfit: number;
  grossMOIC: number;
  carryAmount: number;
  netProceeds: number;
  netMOIC: number;
  irr: number | null;
  schedule: ScheduleRow[];
  chart: ChartPoint[];
  invalidRound: string | null;
}

interface FundResults {
  kind: "fund";
  committed: number;
  deployed: number;
  feesPaid: number;
  grossProceeds: number;
  grossProfit: number;
  grossMOIC: number;
  carryAmount: number;
  netProceeds: number;
  netMOIC: number;
  irr: number;
}

type Results = CompanyResults | FundResults;

const TOOLTIPS: Record<string, string> = {
  direct:
    "One company, no manager. You hold the shares yourself, so nobody takes fees or carry. Identical math to the SPV mode with both set to zero.",
  spv: "One company, through a manager who takes fees and carry. The legal wrapper does not matter here (SPV, syndicate, fund-of-one all behave the same): what matters is single deal plus manager economics.",
  fund: "Many companies, blind pool. There is no single cap table to dilute, so returns come from an expected gross multiple on deployed capital instead of an entry and exit valuation.",
  quick:
    "One blended dilution number applied to every future round. Fast, rough, good enough for a first pass.",
  rounds:
    "Model each future round by hand: what it raises, its post-money, and how much pro rata you take.",
  managementFees:
    "Total fee over the life of the vehicle, not annual. Applied to your entry check and to each follow-on subscription. Typical SPV range: 5-20%.",
  managementFeesAnnual:
    "Annual fee on committed capital, the way fund terms are quoted. Multiplied by the holding period to get the lifetime drag: 2% over 7 years is 14% of what you committed.",
  postMoneyValuation:
    "Company valuation immediately after the round closes (pre-money plus the amount raised).",
  dilution:
    "Percentage of your stake given up each time a new round closes and you do not participate.",
  proRata:
    "Your right to invest enough in a round to keep your ownership flat. 100% keeps ownership exactly constant, 0% means full dilution.",
  roundRaise: "New primary capital the company raises in this round.",
  roundPost:
    "Post-money valuation of that round. Must be larger than the amount raised.",
  roundName:
    "Name this round whatever you want: Series A, Bridge, Extension. Click the field and type.",
  grossProceeds:
    "Exit valuation multiplied by your final ownership, before carry.",
  grossMOIC:
    "Gross proceeds divided by the capital actually deployed into the company (net of management fees).",
  grossProfit: "Gross proceeds minus all capital deployed into the company.",
  carry:
    "Share of the profit paid to the GP or manager as a performance fee. Standard is 20%.",
  netProceeds: "What you receive after carry is deducted.",
  netMOIC:
    "Net proceeds divided by everything you wrote checks for, including management fees.",
  expectedMultiple:
    "The gross multiple you expect the fund to return on deployed capital. 3x means tripling invested capital.",
  yearsToExit: "Expected number of years until the fund distributes returns.",
  exitYears:
    "Years from your entry to the exit. Drives IRR: the same 5x is a very different investment over 4 years than over 12.",
  companyIrr:
    "Annualised return: the multiple on your money spread over the holding period. All capital is treated as going in at entry, so if you follow on later this is the conservative number.",
  irr: "Internal Rate of Return. The annualized return rate, accounting for time.",
};

export default function VCDilutionCalculator() {
  const [investmentType, setInvestmentType] = useState<InvestmentType>("spv");
  const [modelMode, setModelMode] = useState<ModelMode>("quick");

  const [subscriptionAmount, setSubscriptionAmount] = useState("200,000");
  const [managementFees, setManagementFees] = useState("10");
  // funds quote an annual rate, single-deal vehicles quote one lifetime figure,
  // so they get separate fields rather than one that means different things
  const [fundFeeAnnual, setFundFeeAnnual] = useState("2");
  const [entryValuation, setEntryValuation] = useState("20,000,000");
  const [dilutionPerRound, setDilutionPerRound] = useState("15");
  const [numberOfRounds, setNumberOfRounds] = useState(3);
  const [exitValuation, setExitValuation] = useState("1,000,000,000");
  const [carryPercent, setCarryPercent] = useState("20");
  const [expectedMultiple, setExpectedMultiple] = useState("3");
  const [yearsToExit, setYearsToExit] = useState("7");

  const [rounds, setRounds] = useState<Round[]>([
    { id: 1, label: "Seed", raise: "4,000,000", post: "25,000,000", proRata: "100" },
    { id: 2, label: "Series A", raise: "12,000,000", post: "60,000,000", proRata: "100" },
    { id: 3, label: "Series B", raise: "30,000,000", post: "200,000,000", proRata: "0" },
    { id: 4, label: "Series C", raise: "60,000,000", post: "450,000,000", proRata: "0" },
  ]);

  // Tooltips render into a portal on document.body. Anchoring them inside the
  // layout put them at the mercy of every panel's stacking context, so they
  // ended up painting underneath neighbouring keys.
  const [tip, setTip] = useState<{
    id: string;
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  // The page loads with a worked example. Untouched values render at
  // placeholder weight, per field, so editing one input does not make the other
  // eleven defaults suddenly look like numbers you chose.
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const pristine = touched.size === 0;
  const markTouched = useCallback((name: string) => {
    if (!name) return;
    setTouched((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
  }, []);
  const onPanelInput = useCallback(
    (e: React.FormEvent) => markTouched((e.target as HTMLInputElement).name),
    [markTouched]
  );
  const sample = (name: string) => !touched.has(name);
  // mirrors `tip.id` so the trigger can toggle without closing over state
  const tipIdRef = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  // The docked readout is the same numbers as the main display, so showing both
  // at once reads as two different figures. It slides in only once the main
  // display has scrolled out of view.
  const mainDisplay = useRef<HTMLDivElement>(null);
  const [showDock, setShowDock] = useState(false);
  const dockShown = useRef(false);
  useEffect(() => {
    const check = () => {
      const el = mainDisplay.current;
      if (!el) return;
      const past = el.getBoundingClientRect().bottom < 8;
      if (past === dockShown.current) return;
      dockShown.current = past;
      setShowDock(past);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  const openTip = useCallback((id: string, anchor: HTMLElement) => {
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(256, window.innerWidth - margin * 2);
    // estimated height: enough to keep the box on screen without measuring
    const height = 132;

    let left = r.right + 10;
    if (left + width > window.innerWidth - margin) left = r.left - width - 10;
    if (left < margin) left = margin;

    let top = r.top - 6;
    if (top + height > window.innerHeight - margin)
      top = Math.max(margin, window.innerHeight - height - margin);

    tipIdRef.current = id;
    setTip({ id, top, left, width });
  }, []);

  const closeTip = useCallback(() => {
    tipIdRef.current = null;
    setTip(null);
  }, []);

  // any scroll, resize, tap elsewhere or Escape dismisses it
  useEffect(() => {
    if (!tip) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeTip();
    // taps on a trigger are handled by the trigger itself
    const onDown = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-tip-trigger]")) return;
      closeTip();
    };
    window.addEventListener("scroll", closeTip, true);
    window.addEventListener("resize", closeTip);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", closeTip, true);
      window.removeEventListener("resize", closeTip);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [tip, closeTip]);

  const hasFees = investmentType !== "direct";
  const isFund = investmentType === "fund";
  const usesRounds = !isFund && modelMode === "rounds";

  const formatInputNumber = (value: string) =>
    value.replace(/[^0-9]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const parse = (value: string | number) =>
    parseFloat(String(value).replace(/,/g, "")) || 0;

  const formatCurrency = (value: number) => {
    const v = value || 0;
    if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    return `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };
  const formatPercent = (v: number) => `${(v || 0).toFixed(3)}%`;
  const formatMOIC = (v: number) => `${(v || 0).toFixed(2)}x`;

  const results: Results | null = useMemo(() => {
    const sub = parse(subscriptionAmount);
    const feeInput = hasFees
      ? parse(isFund ? fundFeeAnnual : managementFees)
      : 0;
    const carryPct = hasFees ? parse(carryPercent) : 0;

    if (sub <= 0) return null;

    if (isFund) {
      const multiple = parse(expectedMultiple);
      const years = parse(yearsToExit);
      if (multiple <= 0 || years <= 0) return null;

      // fund fees are quoted per year, so the lifetime drag is fee x term
      const feePct = feeInput * years;
      if (feePct >= 100) return null;
      const feeMultiplier = 1 - feePct / 100;

      const deployed = sub * feeMultiplier;
      const grossProceeds = deployed * multiple;
      const grossProfit = grossProceeds - deployed;
      const grossMOIC = deployed > 0 ? grossProceeds / deployed : 0;
      const carryAmount = grossProfit > 0 ? grossProfit * (carryPct / 100) : 0;
      const netProceeds = grossProceeds - carryAmount;
      const netMOIC = netProceeds / sub;
      const irr = netMOIC > 0 ? Math.pow(netMOIC, 1 / years) - 1 : -1;

      return {
        kind: "fund",
        committed: sub,
        deployed,
        feesPaid: sub - deployed,
        grossProceeds,
        grossProfit,
        grossMOIC,
        carryAmount,
        netProceeds,
        netMOIC,
        irr,
      };
    }

    // single-company vehicles quote one lifetime fee, not an annual one
    const feePct = feeInput;
    if (feePct >= 100) return null;
    const feeMultiplier = 1 - feePct / 100;

    const entryPost = parse(entryValuation);
    const exit = parse(exitValuation);
    if (entryPost <= 0 || exit <= 0) return null;

    const entryDeployed = sub * feeMultiplier;
    const entryOwnership = entryDeployed / entryPost;

    let ownership = entryOwnership;
    let passiveOwnership = entryOwnership;
    let deployed = entryDeployed;
    let subscribed = sub;
    let followOnDeployed = 0;
    const exitT = parse(yearsToExit);
    const schedule: ScheduleRow[] = [];
    const chart: ChartPoint[] = [
      { round: "Entry", yours: entryOwnership * 100, passive: entryOwnership * 100 },
    ];
    let invalidRound: string | null = null;

    if (modelMode === "quick") {
      const retention = 1 - parse(dilutionPerRound) / 100;
      for (let i = 1; i <= numberOfRounds; i++) {
        ownership = ownership * retention;
        passiveOwnership = ownership;
        chart.push({
          round: `Round ${i}`,
          yours: ownership * 100,
          passive: ownership * 100,
        });
      }
    } else {
      rounds.forEach((r, idx) => {
        const raise = parse(r.raise);
        const post = parse(r.post);
        const pre = post - raise;
        if (post <= 0 || raise < 0 || pre < 0) {
          if (invalidRound === null) invalidRound = r.label || `Round ${idx + 1}`;
          return;
        }

        const dilutedOwnership = ownership * (pre / post);
        const fullProRataCheck = ownership * raise;
        const participation =
          Math.max(0, Math.min(200, parse(r.proRata))) / 100;
        const followOnIntoCompany = fullProRataCheck * participation;
        const followOnSubscription =
          feeMultiplier > 0 ? followOnIntoCompany / feeMultiplier : 0;

        ownership = dilutedOwnership + followOnIntoCompany / post;
        passiveOwnership = passiveOwnership * (pre / post);

        deployed += followOnIntoCompany;
        followOnDeployed += followOnIntoCompany;
        subscribed += followOnSubscription;

        schedule.push({
          label: r.label || `Round ${idx + 1}`,
          raise,
          post,
          pre,
          fullProRataCheck,
          followOnSubscription,
          ownershipAfter: ownership * 100,
          passiveAfter: passiveOwnership * 100,
        });
        chart.push({
          round: r.label || `Round ${idx + 1}`,
          yours: ownership * 100,
          passive: passiveOwnership * 100,
        });
      });
    }

    const grossProceeds = exit * ownership;
    const grossProfit = grossProceeds - deployed;
    const grossMOIC = deployed > 0 ? grossProceeds / deployed : 0;
    const carryAmount = grossProfit > 0 ? grossProfit * (carryPct / 100) : 0;
    const netProceeds = grossProceeds - carryAmount;
    const netMOIC = subscribed > 0 ? netProceeds / subscribed : 0;

    // Every cheque is treated as landing at entry, so a late follow-on is
    // credited with more time at risk than it really had: the conservative read.
    const irr =
      exitT > 0 && netMOIC >= 0 ? Math.pow(netMOIC, 1 / exitT) - 1 : null;

    return {
      kind: "company",
      irr,
      entryDeployed,
      entryOwnership: entryOwnership * 100,
      finalOwnership: ownership * 100,
      passiveFinal: passiveOwnership * 100,
      deployed,
      subscribed,
      followOnDeployed,
      feesPaid: subscribed - deployed,
      grossProceeds,
      grossProfit,
      grossMOIC,
      carryAmount,
      netProceeds,
      netMOIC,
      schedule,
      chart,
      invalidRound,
    };
  }, [
    subscriptionAmount,
    managementFees,
    fundFeeAnnual,
    entryValuation,
    dilutionPerRound,
    numberOfRounds,
    exitValuation,
    carryPercent,
    expectedMultiple,
    yearsToExit,
    investmentType,
    modelMode,
    rounds,
    hasFees,
    isFund,
  ]);

  const company = results && results.kind === "company" ? results : null;
  const fund = results && results.kind === "fund" ? results : null;

  /* ---------- shareable links ---------- */

  // Applied after mount rather than in the initial state so the server-rendered
  // markup and the first client render still agree.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.toString()) return;

    const v = p.get("v");
    if (v === "direct" || v === "spv" || v === "fund") setInvestmentType(v);
    const m = p.get("m");
    if (m === "quick" || m === "rounds") setModelMode(m);

    const money = (key: string, set: (s: string) => void) => {
      const raw = p.get(key);
      if (raw) set(formatInputNumber(raw));
    };
    const plain = (key: string, set: (s: string) => void) => {
      const raw = p.get(key);
      if (raw !== null) set(raw.replace(/[^0-9.]/g, ""));
    };

    money("sub", setSubscriptionAmount);
    money("entry", setEntryValuation);
    money("exit", setExitValuation);
    plain("fee", setManagementFees);
    plain("ffee", setFundFeeAnnual);
    plain("carry", setCarryPercent);
    plain("dil", setDilutionPerRound);
    plain("mult", setExpectedMultiple);
    plain("yrs", setYearsToExit);

    const n = p.get("n");
    if (n) setNumberOfRounds(Math.max(0, Math.min(10, parseInt(n, 10) || 0)));

    const r = p.get("r");
    if (r) {
      const parsed = r
        .split("|")
        .filter(Boolean)
        .map((chunk, i) => {
          const [label, raise, post, proRata] = chunk.split("~");
          return {
            id: i + 1,
            label: label || `Round ${i + 1}`,
            raise: formatInputNumber(raise ?? "0"),
            post: formatInputNumber(post ?? "0"),
            proRata: (proRata ?? "0").replace(/[^0-9.]/g, ""),
          };
        });
      if (parsed.length) setRounds(parsed);
    }
  }, []);

  const shareUrl = useCallback(() => {
    const p = new URLSearchParams();
    p.set("v", investmentType);
    p.set("sub", String(parse(subscriptionAmount)));
    if (hasFees) {
      p.set("fee", isFund ? fundFeeAnnual : managementFees);
      p.set("carry", carryPercent);
    }
    if (isFund) {
      p.set("mult", expectedMultiple);
      p.set("yrs", yearsToExit);
    } else {
      p.set("m", modelMode);
      p.set("entry", String(parse(entryValuation)));
      p.set("exit", String(parse(exitValuation)));
      p.set("yrs", yearsToExit);
      if (modelMode === "quick") {
        p.set("dil", dilutionPerRound);
        p.set("n", String(numberOfRounds));
      } else {
        p.set(
          "r",
          rounds
            .map((r) =>
              [
                r.label.replace(/[|~]/g, " "),
                parse(r.raise),
                parse(r.post),
                parse(r.proRata),
              ].join("~")
            )
            .join("|")
        );
      }
    }
    return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
  }, [
    investmentType,
    modelMode,
    subscriptionAmount,
    managementFees,
    fundFeeAnnual,
    carryPercent,
    expectedMultiple,
    yearsToExit,
    entryValuation,
    exitValuation,
    dilutionPerRound,
    numberOfRounds,
    rounds,
    hasFees,
    isFund,
  ]);

  const handleShare = async () => {
    const url = shareUrl();
    window.history.replaceState(null, "", url);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Dilution 3000", url });
        return;
      } catch {
        // user dismissed the sheet, fall through to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // clipboard blocked: the URL bar already carries the scenario
    }
  };

  const updateRound = (id: number, field: keyof Round, value: string) =>
    setRounds((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );

  const addRound = () =>
    setRounds((prev) => {
      const next = prev.length ? Math.max(...prev.map((r) => r.id)) + 1 : 1;
      const last = prev[prev.length - 1];
      const lastPost = last ? parse(last.post) : parse(entryValuation);
      return [
        ...prev,
        {
          id: next,
          label: `Round ${prev.length + 1}`,
          raise: formatInputNumber(String(Math.round(lastPost * 0.2))),
          post: formatInputNumber(String(Math.round(lastPost * 2.5))),
          proRata: "0",
        },
      ];
    });

  const removeRound = (id: number) =>
    setRounds((prev) => prev.filter((r) => r.id !== id));

  const clearAll = () => {
    setSubscriptionAmount("");
    setManagementFees("");
    setFundFeeAnnual("");
    setEntryValuation("");
    setDilutionPerRound("");
    setNumberOfRounds(0);
    setExitValuation("");
    setCarryPercent("");
    setExpectedMultiple("");
    setYearsToExit("");
    setRounds([{ id: 1, label: "", raise: "", post: "", proRata: "0" }]);
    setTouched(new Set(["cleared"]));
  };

  /* ---------- small building blocks ---------- */

  // Memoised so the component type is stable. Redefining it each render gave the
  // trigger a new identity, React remounted the node under the cursor, and the
  // resulting mouseleave closed the tooltip the instant it opened.
  // A span, not a button: several of these sit inside key <button>s, and nesting
  // buttons is invalid HTML.
  const Q = useMemo(() => {
    const Trigger = ({ id }: { id: string }) => (
      <span
        role="button"
        tabIndex={0}
        data-tip-trigger=""
        aria-label="What is this?"
        className="inline-flex cursor-help align-middle text-ink-soft transition-colors hover:text-signal-orange print:hidden"
        onMouseEnter={(e) => openTip(id, e.currentTarget)}
        onMouseLeave={closeTip}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // a mouse already gets it from hover; tap-to-toggle is for touch
          if (e.pointerType === "mouse") return;
          if (tipIdRef.current === id) closeTip();
          else openTip(id, e.currentTarget);
        }}
        // several triggers sit inside key <button>s: never let the tap through
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openTip(id, e.currentTarget);
          }
        }}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </span>
    );
    Trigger.displayName = "Q";
    return Trigger;
  }, [openTip, closeTip]);

  // Rendered as plain function calls, not JSX components: a component defined
  // inside render gets a new identity every keystroke, which remounts the
  // input and drops the caret.
  const moneyField = ({
    name,
    value,
    onChange,
    placeholder,
    small,
  }: {
    name: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    small?: boolean;
  }) => (
    <div className="relative">
      <span
        className={`absolute left-2.5 top-1/2 -translate-y-1/2 font-display text-lcd-ink/60 ${
          small ? "text-xs" : "text-base"
        }`}
      >
        $
      </span>
      <input
        type="text"
        name={name}
        inputMode="numeric"
        // An untouched default is shown as the placeholder, not the value, so
        // the first keystroke replaces it instead of appending to it. State
        // still holds the number, which is what keeps the readout live on load.
        value={sample(name) ? "" : value}
        onChange={(e) => onChange(formatInputNumber(e.target.value))}
        placeholder={sample(name) ? value || placeholder : placeholder}
        className={`field font-display text-right ${
          small ? "pl-6 pr-2.5 py-1.5 text-sm" : "pl-7 pr-3 py-2.5 text-lg"
        }`}
      />
    </div>
  );

  const unitField = ({
    name,
    value,
    onChange,
    unit,
    placeholder,
  }: {
    name: string;
    value: string;
    onChange: (v: string) => void;
    unit: string;
    placeholder?: string;
  }) => (
    <div className="relative">
      <input
        type="text"
        name={name}
        inputMode="decimal"
        value={sample(name) ? "" : value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={sample(name) ? value || placeholder : placeholder}
        className="field font-display pl-3 pr-12 py-2.5 text-lg text-right"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-display text-sm text-lcd-ink/70">
        {unit}
      </span>
    </div>
  );

  const SectionPlate = ({
    n,
    title,
    right,
  }: {
    n: string;
    title: string;
    right?: React.ReactNode;
  }) => (
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-ink font-display text-[11px] text-case-hi">
        {n}
      </span>
      <span className="plate-label">{title}</span>
      <span className="vent flex-1" />
      {right}
    </div>
  );

  const TapeRow = ({
    label,
    value,
    tip,
    strong,
    tone,
  }: {
    label: string;
    value: string;
    tip?: string;
    strong?: boolean;
    tone?: "red" | "green" | "blue";
  }) => (
    <div className="tape-row">
      <span
        className={`flex min-w-0 flex-1 items-center gap-1.5 text-[10px] uppercase leading-tight tracking-[0.08em] sm:flex-initial sm:text-[11px] sm:tracking-[0.1em] ${
          strong ? "font-bold text-ink" : "text-ink-soft"
        }`}
      >
        {label}
        {tip && <Q id={tip} />}
      </span>
      <span className="tape-dots hidden sm:block" />
      <span
        className={`shrink-0 font-display tabular-nums ${
          strong ? "text-sm font-bold sm:text-base" : "text-xs sm:text-sm"
        } ${
          tone === "red"
            ? "text-signal-red"
            : tone === "green"
            ? "text-signal-green"
            : tone === "blue"
            ? "text-signal-blue"
            : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );

  /* ---------- headline readout ---------- */

  const headline = results
    ? formatCurrency(results.netProceeds)
    : "-- -- -- --";
  const headlineLabel =
    investmentType === "direct" ? "Total proceeds" : "Net proceeds";

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 md:px-6 md:pb-32 md:pt-10">
      <div className="mx-auto max-w-6xl">
        <div className="calc-shell relative p-[13px] md:p-5">
          {/* screws sit in the frame band, clear of the faceplate */}
          <span className="screw absolute left-[7px] top-[7px] md:left-[9px] md:top-[9px]" />
          <span className="screw absolute right-[7px] top-[7px] md:right-[9px] md:top-[9px]" />
          <span className="screw absolute bottom-[7px] left-[7px] md:bottom-[9px] md:left-[9px]" />
          <span className="screw absolute bottom-[7px] right-[7px] md:bottom-[9px] md:right-[9px]" />

          <div className="calc-face p-3 md:p-6">

          {/* ============ HEAD ============ */}
          <header className="relative z-20 mb-4 px-2 pt-1 md:px-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="brand-type text-[26px] leading-none text-ink md:text-[38px]">
                  DILUTION&nbsp;3000
                </h1>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                  Venture return &amp; cap table computer
                </p>

                {/* maker plate */}
                <div className="mt-2.5 flex items-center gap-2.5 text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                  <span>by</span>
                  <a
                    href="https://twitter.com/defikito"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-bold text-ink transition-colors hover:text-signal-orange"
                  >
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    @defikito
                  </a>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-right text-[9px] uppercase leading-tight tracking-[0.18em] text-ink-soft">
                    <div>Model EDC-78</div>
                    <div>Solar / Ambient</div>
                  </div>
                  <div className="solar h-7 w-24 md:w-32" />
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={handleShare}
                    className="key key-cream px-3 py-2 text-[10px] font-bold"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Link copied
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3.5 w-3.5" /> Share
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="key px-3 py-2 text-[10px] font-bold"
                  >
                    <Printer className="h-3.5 w-3.5" /> PDF
                  </button>
                  <button
                    onClick={clearAll}
                    title="Empty every field"
                    className="key key-red px-3 py-2 text-[10px] font-bold"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

          </header>

          {/* Main display, fixed in place at the top of the case. The running
              totals live in the docked bar at the bottom of the screen. */}
          <div ref={mainDisplay} className="lcd-bezel relative z-30 mb-4">
              <div className="lcd px-4 py-3 md:px-5 md:py-4">
                {/* status flags */}
                <div className="relative z-10 mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="lcd-flag" data-on={investmentType === "direct"}>
                    Direct
                  </span>
                  <span className="lcd-flag" data-on={investmentType === "spv"}>
                    SPV
                  </span>
                  <span className="lcd-flag" data-on={isFund}>
                    Fund
                  </span>
                  <span className="mx-1 h-3 w-px bg-lcd-ink/25" />
                  <span className="lcd-flag" data-on={!isFund && modelMode === "quick"}>
                    Quick
                  </span>
                  <span className="lcd-flag" data-on={usesRounds}>
                    Round-by-round
                  </span>
                  <span className="mx-1 h-3 w-px bg-lcd-ink/25" />
                  <span className="lcd-flag" data-on={hasFees}>
                    Fee
                  </span>
                  <span className="lcd-flag" data-on={hasFees && parse(carryPercent) > 0}>
                    Carry
                  </span>
                  <span className="flex items-center gap-3 sm:ml-auto">
                    <span className="lcd-flag" data-on={pristine}>
                      Sample
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="led" data-on={!!results} />
                      <span className="lcd-flag" data-on={!!results}>
                        {results ? "Calc" : "Error"}
                      </span>
                    </span>
                  </span>
                </div>

                <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-lcd-ink/60">
                      {headlineLabel}
                    </div>
                    <div className="lcd-digits font-display text-4xl leading-none md:text-6xl">
                      {headline}
                    </div>
                  </div>

                  <div className="grid w-full grid-cols-3 gap-2 md:flex md:w-auto md:gap-8">
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-[0.2em] text-lcd-ink/60">
                        {investmentType === "direct" ? "MOIC" : "Net MOIC"}
                      </div>
                      <div className="lcd-digits font-display text-lg leading-none sm:text-2xl md:text-3xl">
                        {results ? formatMOIC(results.netMOIC) : "--.--x"}
                      </div>
                    </div>
                    {isFund ? (
                      <div className="text-right">
                        <div className="text-[9px] uppercase tracking-[0.2em] text-lcd-ink/60">
                          IRR
                        </div>
                        <div className="lcd-digits font-display text-lg leading-none sm:text-2xl md:text-3xl">
                          {fund ? `${(fund.irr * 100).toFixed(1)}%` : "--.-%"}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-right">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-lcd-ink/60">
                            IRR
                          </div>
                          <div className="lcd-digits font-display text-lg leading-none sm:text-2xl md:text-3xl">
                            {company?.irr != null
                              ? `${(company.irr * 100).toFixed(1)}%`
                              : "--.-%"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-lcd-ink/60">
                            Final own.
                          </div>
                          <div className="lcd-digits font-display text-lg leading-none sm:text-2xl md:text-3xl">
                            {company ? formatPercent(company.finalOwnership) : "--.---%"}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

          {/* mode keys */}
          <div className="relative z-20 mb-5 flex flex-col gap-3 px-2 print:hidden sm:flex-row sm:items-center sm:justify-between md:px-4">
              <div className="flex items-center gap-2">
                <span className="hidden text-[9px] uppercase tracking-[0.2em] text-ink-soft sm:block">
                  Vehicle
                </span>
                {(
                  [
                    ["direct", "Direct"],
                    ["spv", "SPV"],
                    ["fund", "Fund"],
                  ] as [InvestmentType, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setInvestmentType(value)}
                    data-pressed={investmentType === value}
                    className={`key px-4 py-2.5 text-[11px] font-bold ${
                      investmentType === value ? "key-orange" : ""
                    }`}
                  >
                    {label}
                      <Q id={value} />
                  </button>
                ))}
              </div>

              {!isFund && (
                <div className="flex items-center gap-2">
                  <span className="hidden text-[9px] uppercase tracking-[0.2em] text-ink-soft sm:block">
                    Method
                  </span>
                  {(
                    [
                      ["quick", "Quick est."],
                      ["rounds", "Round by round"],
                    ] as [ModelMode, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setModelMode(value)}
                      data-pressed={modelMode === value}
                      className={`key px-4 py-2.5 text-[11px] font-bold ${
                        modelMode === value ? "key-cream" : ""
                      }`}
                    >
                      {label}
                        <Q id={value} />
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* what the selected vehicle actually means for the math, since the
              legal wrapper is not the thing that differs */}
          <div className="relative z-10 mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 px-2 text-[10px] uppercase tracking-[0.12em] text-ink-soft print:hidden md:px-4">
            <span className="font-bold text-ink">
              {isFund ? "Many companies" : "One company"}
            </span>
            <span className="text-ink/40">/</span>
            <span>
              {investmentType === "direct"
                ? "no manager, no fees, no carry"
                : isFund
                ? "blind pool priced off an expected multiple"
                : "manager takes fees and carry"}
            </span>
          </div>

          {/* ============ BODY ============ */}
          <div className="print-stack relative z-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* ---------- INPUTS ---------- */}
            <section
              className="calc-panel space-y-6 p-3 md:p-5"
              // one listener covers every text field and slider in the panel
              onInput={onPanelInput}
            >
              <div>
                <SectionPlate n="1" title="Your entry" />
                <div className="calc-well space-y-4 p-3 md:p-4">
                  <div>
                    <label className="field-label mb-1.5 block">
                      {investmentType === "direct"
                        ? "Investment amount"
                        : "Subscription amount"}
                    </label>
                    {moneyField({
                      name: "sub",
                      value: subscriptionAmount,
                      onChange: setSubscriptionAmount,
                      placeholder: "200,000",
                    })}
                  </div>

                  {hasFees && (
                    <div>
                      <label className="field-label mb-1.5 flex items-center gap-1.5">
                        {isFund
                          ? "Management fee (annual)"
                          : "Management fee (total)"}{" "}
                        <Q id={isFund ? "managementFeesAnnual" : "managementFees"} />
                      </label>
                      {unitField({
                        name: isFund ? "ffee" : "fee",
                        value: isFund ? fundFeeAnnual : managementFees,
                        onChange: isFund ? setFundFeeAnnual : setManagementFees,
                        unit: isFund ? "%/yr" : "%",
                        placeholder: isFund ? "2" : "10",
                      })}
                      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        {isFund ? (
                          <>
                            Charged yearly. Over {parse(yearsToExit) || 0} yr that
                            is{" "}
                            <span className="font-display text-ink">
                              {(
                                parse(fundFeeAnnual) * parse(yearsToExit)
                              ).toFixed(1)}
                              %
                            </span>{" "}
                            of committed. Typical 2%/yr
                          </>
                        ) : (
                          <>Total, not annual. Typical 5-20%</>
                        )}
                      </p>
                    </div>
                  )}

                  {!isFund && (
                    <div>
                      <label className="field-label mb-1.5 flex items-center gap-1.5">
                        Entry post-money <Q id="postMoneyValuation" />
                      </label>
                      {moneyField({
                        name: "entry",
                        value: entryValuation,
                        onChange: setEntryValuation,
                        placeholder: "20,000,000",
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* fund expectations */}
              {isFund && (
                <div>
                  <SectionPlate n="2" title="Fund expectations" />
                  <div className="calc-well space-y-4 p-3 md:p-4">
                    <div>
                      <label className="field-label mb-1.5 flex items-center gap-1.5">
                        Expected gross multiple <Q id="expectedMultiple" />
                      </label>
                      {unitField({
                        name: "mult",
                        value: expectedMultiple,
                        onChange: setExpectedMultiple,
                        unit: "x",
                        placeholder: "3",
                      })}
                      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        Typical 2-4x for top quartile
                      </p>
                    </div>
                    <div>
                      <label className="field-label mb-1.5 flex items-center gap-1.5">
                        Years to exit <Q id="yearsToExit" />
                      </label>
                      {unitField({
                        name: "yrs",
                        value: yearsToExit,
                        onChange: setYearsToExit,
                        unit: "yr",
                        placeholder: "7",
                      })}
                      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        Typical 7-10 years
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* quick dilution */}
              {!isFund && modelMode === "quick" && (
                <div>
                  <SectionPlate n="2" title="Dilution scenario" />
                  <div className="calc-well space-y-4 p-3 md:p-4">
                    <div>
                      <label className="field-label mb-1.5 flex items-center gap-1.5">
                        Dilution per round <Q id="dilution" />
                      </label>
                      {unitField({
                        name: "dil",
                        value: dilutionPerRound,
                        onChange: setDilutionPerRound,
                        unit: "%",
                        placeholder: "15",
                      })}
                      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        Typical 10-20%
                      </p>
                    </div>
                    <div>
                      <label className="field-label mb-1.5 block">
                        Number of rounds
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            markTouched("nrounds");
                            setNumberOfRounds(Math.max(0, numberOfRounds - 1));
                          }}
                          aria-label="One fewer round"
                          className="key h-11 w-12 text-xl"
                        >
                          &minus;
                        </button>
                        <div className="lcd flex-1 py-2 text-center">
                          <span className={`lcd-digits relative z-10 font-display text-2xl ${
                              sample("nrounds") ? "opacity-40" : ""
                            }`}>
                            {String(numberOfRounds).padStart(2, "0")}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            markTouched("nrounds");
                            setNumberOfRounds(Math.min(10, numberOfRounds + 1));
                          }}
                          aria-label="One more round"
                          className="key key-orange h-11 w-12 text-xl"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* round by round */}
              {usesRounds && (
                <div>
                  <SectionPlate
                    n="2"
                    title="Future rounds"
                    right={
                      <button
                        onClick={() => { markTouched("rounds"); addRound(); }}
                        className="key key-cream px-3 py-1.5 text-[10px] font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    }
                  />

                  <div className="space-y-3">
                    {rounds.map((r, idx) => (
                      <div key={r.id} className="calc-well p-3.5">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="font-display text-[11px] text-ink-soft">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={sample(`r${r.id}label`) ? "" : r.label}
                              onChange={(e) =>
                                updateRound(r.id, "label", e.target.value)
                              }
                              aria-label={`Name of round ${idx + 1}`}
                              placeholder={
                                sample(`r${r.id}label`)
                                  ? r.label || `Round ${idx + 1}`
                                  : `Round ${idx + 1}`
                              }
                              name={`r${r.id}label`}
                              className="field font-display w-full px-2.5 py-1.5 text-sm uppercase tracking-[0.08em]"
                            />
                          </div>
                          <Q id="roundName" />
                          <button
                            onClick={() => { markTouched("rounds"); removeRound(r.id); }}
                            aria-label={`Remove ${r.label || `round ${idx + 1}`}`}
                            className="key key-red h-8 w-9"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="field-label mb-1 flex items-center gap-1">
                              Raised <Q id="roundRaise" />
                            </label>
                            {moneyField({
                              name: `r${r.id}raise`,
                              small: true,
                              value: r.raise,
                              onChange: (v) => updateRound(r.id, "raise", v),
                              placeholder: "4,000,000",
                            })}
                          </div>
                          <div>
                            <label className="field-label mb-1 flex items-center gap-1">
                              Post-money <Q id="roundPost" />
                            </label>
                            {moneyField({
                              name: `r${r.id}post`,
                              small: true,
                              value: r.post,
                              onChange: (v) => updateRound(r.id, "post", v),
                              placeholder: "25,000,000",
                            })}
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="field-label mb-1 flex items-center gap-1">
                            Pro rata participation <Q id="proRata" />
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              name={`r${r.id}prorata`}
                              min="0"
                              max="100"
                              step="5"
                              value={parse(r.proRata)}
                              onChange={(e) =>
                                updateRound(r.id, "proRata", e.target.value)
                              }
                              aria-label={`Pro rata participation for ${
                                r.label || `round ${idx + 1}`
                              }`}
                              className="slider flex-1"
                            />
                            <div className="relative w-20">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={
                                  sample(`r${r.id}prorata`) ? "" : r.proRata
                                }
                                placeholder={r.proRata}
                                onChange={(e) =>
                                  updateRound(
                                    r.id,
                                    "proRata",
                                    e.target.value.replace(/[^0-9.]/g, "")
                                  )
                                }
                                aria-label={`Pro rata percent for ${
                                  r.label || `round ${idx + 1}`
                                }`}
                                name={`r${r.id}prorata`}
                                className="field font-display py-1.5 pl-2 pr-6 text-right text-sm"
                              />
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-display text-xs text-lcd-ink/70">
                                %
                              </span>
                            </div>
                          </div>
                          {company?.schedule[idx] && (
                            <p className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                              Full pro rata check:{" "}
                              <span className="font-display text-ink">
                                {formatCurrency(
                                  company.schedule[idx].fullProRataCheck
                                )}
                              </span>
                              {hasFees && parse(r.proRata) > 0 && (
                                <>
                                  {" · you subscribe "}
                                  <span className="font-display text-ink">
                                    {formatCurrency(
                                      company.schedule[idx].followOnSubscription
                                    )}
                                  </span>
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {rounds.length === 0 && (
                      <div className="calc-well px-4 py-6 text-center text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                        No future rounds. Entry ownership carries straight to exit.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* exit & carry */}
              <div>
                <SectionPlate n="3" title={isFund ? "Carry" : "Exit & carry"} />
                <div className="calc-well space-y-4 p-3 md:p-4">
                  {!isFund && (
                    <>
                      <div>
                        <label className="field-label mb-1.5 block">
                          Exit valuation
                        </label>
                        {moneyField({
                          name: "exit",
                          value: exitValuation,
                          onChange: setExitValuation,
                          placeholder: "1,000,000,000",
                        })}
                      </div>
                      <div>
                        <label className="field-label mb-1.5 flex items-center gap-1.5">
                          Years to exit <Q id="exitYears" />
                        </label>
                        {unitField({
                          name: "yrs",
                          value: yearsToExit,
                          onChange: setYearsToExit,
                          unit: "yr",
                          placeholder: "7",
                        })}
                        <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          Drives IRR. Leave blank for MOIC only
                        </p>
                      </div>
                    </>
                  )}
                  {hasFees ? (
                    <div>
                      <label className="field-label mb-1.5 flex items-center gap-1.5">
                        Carry to GP <Q id="carry" />
                      </label>
                      {unitField({
                        name: "carry",
                        value: carryPercent,
                        onChange: setCarryPercent,
                        unit: "%",
                        placeholder: "20",
                      })}
                      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        Standard 20%
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      Direct mode: no fees, no carry. You keep everything.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* ---------- OUTPUTS ---------- */}
            <section className="space-y-5">
              {!results && (
                <div className="calc-panel px-6 py-16 text-center">
                  <div className="font-display text-3xl text-ink-soft">
                    -- -- -- --
                  </div>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
                    Enter your investment details to compute
                  </p>
                </div>
              )}

              {company?.invalidRound && (
                <div className="calc-panel flex items-start gap-3 border-l-4 border-l-signal-red p-4">
                  <span className="led mt-1" data-on />
                  <p className="text-[11px] uppercase leading-relaxed tracking-[0.08em] text-ink">
                    Check{" "}
                    <span className="font-bold">{company.invalidRound}</span>:
                    post-money must be at least the amount raised. That round was
                    skipped.
                  </p>
                </div>
              )}

              {results && (
                <>
                  {/* printed tape: position */}
                  <div className="calc-panel p-3 md:p-5">
                    <SectionPlate n="A" title="Position" />
                    <div className="tape px-3 py-4 md:px-4">
                      {company && (
                        <>
                          <TapeRow
                            label="Entry capital into company"
                            value={formatCurrency(company.entryDeployed)}
                          />
                          <TapeRow
                            label="Entry ownership"
                            value={formatPercent(company.entryOwnership)}
                          />
                          {usesRounds && (
                            <>
                              <TapeRow
                                label="Follow-on into company"
                                value={formatCurrency(company.followOnDeployed)}
                              />
                              <TapeRow
                                label="Ownership if never follow on"
                                value={formatPercent(company.passiveFinal)}
                              />
                            </>
                          )}
                          {hasFees && (
                            <TapeRow
                              label="Management fees paid"
                              value={`-${formatCurrency(company.feesPaid)}`}
                              tone="red"
                            />
                          )}
                          <TapeRow
                            label="Total capital in"
                            value={formatCurrency(company.subscribed)}
                          />
                          <TapeRow
                            label="Final ownership at exit"
                            value={formatPercent(company.finalOwnership)}
                            strong
                          />
                          <div className="mt-2 h-2 overflow-hidden rounded-sm bg-ink/15 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]">
                            <div
                              className="h-full bg-signal-orange transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  company.entryOwnership > 0
                                    ? (company.finalOwnership /
                                        company.entryOwnership) *
                                        100
                                    : 0
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="mt-1.5 text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                            Share of entry stake retained
                          </p>
                        </>
                      )}

                      {fund && (
                        <>
                          <TapeRow
                            label="Committed capital"
                            value={formatCurrency(fund.committed)}
                          />
                          <TapeRow
                            label="Management fees paid"
                            value={`-${formatCurrency(fund.feesPaid)}`}
                            tone="red"
                          />
                          <TapeRow
                            label="Deployed capital"
                            value={formatCurrency(fund.deployed)}
                            strong
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* printed tape: returns */}
                  <div className="calc-panel p-3 md:p-5">
                    <SectionPlate n="B" title="Returns analysis" />
                    <div className="tape px-3 py-4 md:px-4">
                      <TapeRow
                        label={
                          investmentType === "direct"
                            ? "Total proceeds"
                            : "Gross proceeds"
                        }
                        value={formatCurrency(results.grossProceeds)}
                        tip="grossProceeds"
                      />
                      <TapeRow
                        label={
                          investmentType === "direct" ? "Total MOIC" : "Gross MOIC"
                        }
                        value={formatMOIC(results.grossMOIC)}
                        tip="grossMOIC"
                      />
                      <TapeRow
                        label={
                          investmentType === "direct"
                            ? "Total profit"
                            : "Gross profit"
                        }
                        value={formatCurrency(results.grossProfit)}
                        tip="grossProfit"
                        tone={results.grossProfit >= 0 ? "green" : "red"}
                      />
                      {hasFees && (
                        <TapeRow
                          label="Carry to GP"
                          value={`-${formatCurrency(results.carryAmount)}`}
                          tip="carry"
                          tone="red"
                        />
                      )}
                      <div className="my-2 border-t border-dashed border-ink/30" />
                      <TapeRow
                        label={
                          investmentType === "direct"
                            ? "Total proceeds"
                            : "Net proceeds"
                        }
                        value={formatCurrency(results.netProceeds)}
                        tip="netProceeds"
                        strong
                        tone="green"
                      />
                      <TapeRow
                        label={investmentType === "direct" ? "MOIC" : "Net MOIC"}
                        value={formatMOIC(results.netMOIC)}
                        tip="netMOIC"
                        strong
                        tone="blue"
                      />
                      {fund && (
                        <TapeRow
                          label="IRR"
                          value={`${(fund.irr * 100).toFixed(2)}%`}
                          tip="irr"
                          strong
                        />
                      )}
                      {company?.irr != null && (
                        <TapeRow
                          label="IRR"
                          value={`${(company.irr * 100).toFixed(2)}%`}
                          tip="companyIrr"
                          strong
                        />
                      )}
                    </div>
                  </div>

                  {/* round schedule */}
                  {company && usesRounds && company.schedule.length > 0 && (
                    <div className="calc-panel p-3 md:p-5">
                      <SectionPlate n="C" title="Round by round" />
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] sm:text-[11px]">
                          <thead>
                            <tr className="border-b-2 border-ink/25 text-left uppercase tracking-[0.06em] text-ink-soft sm:tracking-[0.1em]">
                              <th className="py-2 pr-2 font-bold sm:pr-3">Round</th>
                              <th className="px-2 py-2 font-bold sm:px-3">Raise</th>
                              <th className="hidden px-3 py-2 font-bold sm:table-cell">
                                Post
                              </th>
                              <th className="px-2 py-2 font-bold sm:px-3">Pro rata</th>
                              <th className="py-2 pl-2 text-right font-bold sm:pl-3">
                                Your %
                              </th>
                            </tr>
                          </thead>
                          <tbody className="font-display">
                            {company.schedule.map((s, i) => (
                              <tr
                                key={i}
                                className="border-b border-dashed border-ink/20"
                              >
                                <td className="py-2 pr-2 uppercase text-ink sm:pr-3">
                                  {s.label}
                                </td>
                                <td className="px-2 py-2 text-ink-soft sm:px-3">
                                  {formatCurrency(s.raise)}
                                </td>
                                <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">
                                  {formatCurrency(s.post)}
                                </td>
                                <td className="px-2 py-2 text-ink-soft sm:px-3">
                                  {formatCurrency(s.fullProRataCheck)}
                                </td>
                                <td className="py-2 pl-2 text-right font-bold text-ink sm:pl-3">
                                  {formatPercent(s.ownershipAfter)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* chart */}
                  {company && (
                    <div className="calc-panel p-3 md:p-5">
                      <SectionPlate n="D" title="Ownership over rounds" />
                      <div className="lcd-bezel">
                        <div className="lcd p-3">
                          <div className="relative z-10">
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart data={company.chart}>
                                <CartesianGrid
                                  strokeDasharray="2 4"
                                  stroke="rgba(27,36,21,0.28)"
                                />
                                <XAxis
                                  dataKey="round"
                                  stroke="#1b2415"
                                  tick={{
                                    fontSize: 10,
                                    fill: "#1b2415",
                                    fontFamily: "var(--font-display)",
                                  }}
                                />
                                <YAxis
                                  stroke="#1b2415"
                                  tick={{
                                    fontSize: 10,
                                    fill: "#1b2415",
                                    fontFamily: "var(--font-display)",
                                  }}
                                  tickFormatter={(v: number) => `${v.toFixed(2)}%`}
                                />
                                <Tooltip
                                  formatter={(v: number, name: string) => [
                                    `${v.toFixed(3)}%`,
                                    name === "yours"
                                      ? "With participation"
                                      : "No participation",
                                  ]}
                                  contentStyle={{
                                    backgroundColor: "#26261f",
                                    border: "1px solid #4d4b3f",
                                    borderRadius: "6px",
                                    color: "#e9e4d3",
                                    fontFamily: "var(--font-display)",
                                    fontSize: "12px",
                                  }}
                                  labelStyle={{ color: "#e9e4d3" }}
                                  itemStyle={{ color: "#e9e4d3" }}
                                  cursor={{ stroke: "rgba(27,36,21,0.4)" }}
                                />
                                {usesRounds && (
                                  <Legend
                                    wrapperStyle={{
                                      fontSize: "10px",
                                      fontFamily: "var(--font-display)",
                                      color: "#1b2415",
                                      textTransform: "uppercase",
                                    }}
                                    formatter={(v: string) =>
                                      v === "yours"
                                        ? "With participation"
                                        : "No participation"
                                    }
                                  />
                                )}
                                <Line
                                  type="linear"
                                  dataKey="yours"
                                  stroke="#1b2415"
                                  strokeWidth={2.5}
                                  dot={{ fill: "#1b2415", r: 4 }}
                                  isAnimationActive={false}
                                />
                                {usesRounds && (
                                  <Line
                                    type="linear"
                                    dataKey="passive"
                                    stroke="#5d6a52"
                                    strokeWidth={2}
                                    strokeDasharray="5 4"
                                    dot={{ fill: "#5d6a52", r: 3 }}
                                    isAnimationActive={false}
                                  />
                                )}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* assumptions */}
                  <div className="calc-panel p-3 md:p-5">
                    <SectionPlate n="E" title="Assumptions" />
                    <p className="text-[11px] leading-relaxed text-ink-soft">
                      {isFund ? (
                        <>
                          Fees come off committed capital before deployment. The
                          expected gross multiple applies to deployed capital only.
                          Carry is charged on total profit with no hurdle and no
                          catch-up. IRR assumes a single distribution at the end of
                          the holding period, so it ignores capital call timing.
                        </>
                      ) : (
                        <>
                          Pro rata is priced at the round&apos;s post-money, so 100%
                          participation holds your ownership exactly flat.
                          {hasFees
                            ? " Management fees apply to your entry check and to each follow-on subscription. Carry is charged on total profit above all capital deployed, with no hurdle, no catch-up and no loss carryforward."
                            : " No fees and no carry are applied in direct mode."}{" "}
                          IRR annualises the net multiple over the years to
                          exit, treating every cheque as if it went in at entry.
                          Follow-ons written later were really at risk for less
                          time, so the true IRR on a scenario with heavy
                          follow-on is higher than what is shown here. The model
                          also ignores liquidation preferences, option pool
                          refreshes and secondary sales.
                        </>
                      )}
                    </p>
                  </div>
                </>
              )}
            </section>
          </div>

          </div>
        </div>
      </div>

      {/* tooltips live on document.body so no panel can paint over them */}
      {mounted &&
        tip &&
        createPortal(
          <div
            role="tooltip"
            className="tooltip-box pointer-events-none fixed z-[9999] p-3 text-[11px] font-normal normal-case leading-relaxed tracking-normal"
            style={{ top: tip.top, left: tip.left, width: tip.width }}
          >
            {TOOLTIPS[tip.id]}
          </div>,
          document.body
        )}

      {/* docked readout: always on screen, phone and desktop alike */}
      <div
        aria-hidden={!showDock}
        className={`fixed inset-x-0 bottom-0 z-40 px-2 pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-out print:hidden ${
          showDock ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <div className="lcd-bezel mx-auto max-w-6xl !rounded-b-none !p-1.5">
          <div className="lcd flex items-center justify-between gap-3 px-3 py-2 md:px-5 md:py-3">
            <div className="relative z-10 min-w-0">
              <div className="text-[8px] uppercase tracking-[0.18em] text-lcd-ink/60 md:text-[9px]">
                {headlineLabel}
              </div>
              <div className="lcd-digits truncate font-display text-xl leading-none md:text-3xl">
                {headline}
              </div>
            </div>
            <div className="relative z-10 flex shrink-0 items-center gap-4 text-right md:gap-10">
              <div>
                <div className="text-[8px] uppercase tracking-[0.18em] text-lcd-ink/60 md:text-[9px]">
                  {investmentType === "direct" ? "MOIC" : "Net MOIC"}
                </div>
                <div className="lcd-digits font-display text-xl leading-none md:text-3xl">
                  {results ? formatMOIC(results.netMOIC) : "--.--x"}
                </div>
              </div>
              <div>
                <div className="text-[8px] uppercase tracking-[0.18em] text-lcd-ink/60 md:text-[9px]">
                  IRR
                </div>
                <div className="lcd-digits font-display text-xl leading-none md:text-3xl">
                  {fund
                    ? `${(fund.irr * 100).toFixed(1)}%`
                    : company?.irr != null
                    ? `${(company.irr * 100).toFixed(1)}%`
                    : "--.-%"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
