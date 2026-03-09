"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  Percent,
  Target,
  HelpCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Results {
  feeMultiplier: number;
  seedInvestment: number;
  seedOwnership: number;
  finalOwnership: number;
  grossProceeds: number;
  grossProfit: number;
  grossMOIC: number;
  carryAmount: number;
  netProceeds: number;
  netMOIC: number;
  irr?: number;
}

type TooltipKey =
  | "grossProceeds"
  | "grossMOIC"
  | "grossProfit"
  | "carry"
  | "netProceeds"
  | "netMOIC"
  | "managementFees"
  | "postMoneyValuation"
  | "dilution"
  | "direct"
  | "spv"
  | "fund"
  | "carryInput"
  | "expectedMultiple"
  | "yearsToExit"
  | "irr";

export default function VCDilutionCalculator() {
  const [investmentType, setInvestmentType] = useState<
    "direct" | "spv" | "fund"
  >("spv");
  const [subscriptionAmount, setSubscriptionAmount] = useState("200,000");
  const [managementFees, setManagementFees] = useState("10");
  const [seedValuation, setSeedValuation] = useState("20,000,000");
  const [dilutionPerRound, setDilutionPerRound] = useState("15");
  const [numberOfRounds, setNumberOfRounds] = useState(3);
  const [exitValuation, setExitValuation] = useState("1,000,000,000");
  const [carryPercent, setCarryPercent] = useState("20");
  const [expectedMultiple, setExpectedMultiple] = useState("3");
  const [yearsToExit, setYearsToExit] = useState("7");

  const [hoveredTooltip, setHoveredTooltip] = useState<TooltipKey | null>(
    null
  );

  const formatInputNumber = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, "");
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const parseInputNumber = (value: string) => {
    return value.replace(/,/g, "");
  };

  const [results, setResults] = useState<Results | null>(null);

  const tooltips: Record<string, string> = {
    grossProceeds:
      "Total value of your shares at exit before any fees or carry",
    grossMOIC:
      "Multiple on Invested Capital (gross) - how many times your seed investment has grown",
    grossProfit:
      "Your total profit before carry is deducted (Gross Proceeds - Seed Investment)",
    carry:
      "The percentage of profits that goes to the VC/GP as performance fee (typically 20%)",
    netProceeds:
      "What you actually receive after carry is deducted - your final payout",
    netMOIC:
      "Multiple on your original subscription - how many times your initial capital has grown after all fees",
    managementFees:
      "Total management fee charged by the fund/SPV manager over the life of the investment (not annual). Typically 5-20% of committed capital.",
    postMoneyValuation:
      "The company's valuation immediately after the investment round (pre-money + investment)",
    dilution:
      "The percentage reduction in ownership stake when new investors join in future rounds",
    direct:
      "Invest directly into a company with no management fees or carry - you keep 100% of your returns",
    spv: "Special Purpose Vehicle - a legal entity created to pool investor capital for a single investment",
    fund: "A pooled investment vehicle that invests across multiple companies",
    expectedMultiple:
      "The gross multiple you expect the fund to return on deployed capital (e.g., 3x means tripling invested capital)",
    yearsToExit:
      "Expected number of years until the fund distributes returns",
    irr: "Internal Rate of Return - the annualized return rate accounting for time",
  };

  useEffect(() => {
    calculateResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    subscriptionAmount,
    managementFees,
    seedValuation,
    dilutionPerRound,
    numberOfRounds,
    exitValuation,
    carryPercent,
    investmentType,
    expectedMultiple,
    yearsToExit,
  ]);

  const calculateResults = () => {
    const sub = parseFloat(parseInputNumber(subscriptionAmount)) || 0;
    if (sub === 0) {
      setResults(null);
      return;
    }

    if (investmentType === "fund") {
      const mgmtFee = parseFloat(managementFees) || 0;
      const multiple = parseFloat(expectedMultiple) || 0;
      const years = parseFloat(yearsToExit) || 0;
      const carry = parseFloat(carryPercent) || 0;

      if (multiple === 0 || years === 0) {
        setResults(null);
        return;
      }

      const feeMultiplier = 1 - mgmtFee / 100;
      const netInvested = sub * feeMultiplier;
      const grossProceeds = netInvested * multiple;
      const grossProfit = grossProceeds - netInvested;
      const grossMOIC = grossProceeds / netInvested;
      const carryAmount = grossProfit > 0 ? grossProfit * (carry / 100) : 0;
      const netProceeds = grossProceeds - carryAmount;
      const netMOIC = netProceeds / sub;
      const irr = years > 0 ? Math.pow(netMOIC, 1 / years) - 1 : 0;

      setResults({
        feeMultiplier,
        seedInvestment: netInvested,
        seedOwnership: 0,
        finalOwnership: 0,
        grossProceeds,
        grossProfit,
        grossMOIC,
        carryAmount,
        netProceeds,
        netMOIC,
        irr,
      });
    } else {
      const mgmtFee =
        investmentType === "spv" ? parseFloat(managementFees) || 0 : 0;
      const valuation = parseFloat(parseInputNumber(seedValuation)) || 0;
      const dilution = parseFloat(dilutionPerRound) || 0;
      const rounds = numberOfRounds || 0;
      const exit = parseFloat(parseInputNumber(exitValuation)) || 0;
      const carry =
        investmentType === "spv" ? parseFloat(carryPercent) || 0 : 0;

      if (valuation === 0 || exit === 0) {
        setResults(null);
        return;
      }

      const feeMultiplier = 1 - mgmtFee / 100;
      const seedInvestment = sub * feeMultiplier;
      const seedOwnership = (seedInvestment / valuation) * 100;
      const retentionRate = 1 - dilution / 100;
      const finalOwnership = seedOwnership * Math.pow(retentionRate, rounds);
      const grossProceeds = exit * (finalOwnership / 100);
      const grossProfit = grossProceeds - seedInvestment;
      const grossMOIC = grossProceeds / seedInvestment;
      const carryAmount =
        grossProfit > 0 ? grossProfit * (carry / 100) : 0;
      const netProceeds = grossProceeds - carryAmount;
      const netMOIC = netProceeds / sub;

      setResults({
        feeMultiplier,
        seedInvestment,
        seedOwnership,
        finalOwnership,
        grossProceeds,
        grossProfit,
        grossMOIC,
        carryAmount,
        netProceeds,
        netMOIC,
      });
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(2)}B`;
    }
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatMOIC = (value: number) => {
    return `${value.toFixed(2)}x`;
  };

  const getChartData = () => {
    const sub = parseFloat(parseInputNumber(subscriptionAmount)) || 0;
    const mgmtFee = parseFloat(managementFees) || 0;
    const valuation = parseFloat(parseInputNumber(seedValuation)) || 0;
    const dilution = parseFloat(dilutionPerRound) || 0;
    const rounds = numberOfRounds || 0;

    if (sub === 0 || valuation === 0) return [];

    const feeMultiplier = 1 - mgmtFee / 100;
    const seedInvestment = sub * feeMultiplier;
    const seedOwnership = (seedInvestment / valuation) * 100;
    const retentionRate = 1 - dilution / 100;

    const data = [{ round: "Entry", ownership: seedOwnership }];
    let currentOwnership = seedOwnership;

    for (let i = 1; i <= rounds; i++) {
      currentOwnership = currentOwnership * retentionRate;
      data.push({ round: `Round ${i}`, ownership: currentOwnership });
    }

    return data;
  };

  const hasFees = investmentType === "spv" || investmentType === "fund";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-10">
          <div className="text-center">
            <div className="mb-3">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                VC Investment Calculator
              </h1>
            </div>
            <p className="text-slate-400 text-sm md:text-base">
              Model your startup investment returns through dilution, fees &
              carry
            </p>
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-slate-500">
              <span>by</span>
              <a
                href="https://twitter.com/defikito"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-blue-400 transition-colors font-medium text-slate-400"
              >
                @defikito
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/in/isaacbtesh/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors text-slate-400"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>

            {/* Investment Type Toggle */}
            <div className="flex justify-center mt-6">
            <div className="inline-flex bg-slate-700/50 rounded-xl p-1 border border-slate-600/50">
              <button
                onClick={() => setInvestmentType("direct")}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-1 ${
                  investmentType === "direct"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Direct Investment
                <div className="relative">
                  <HelpCircle
                    className="w-3.5 h-3.5 opacity-70 cursor-help"
                    onMouseEnter={() => setHoveredTooltip("direct")}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  />
                  {hoveredTooltip === "direct" && (
                    <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10 border border-slate-700">
                      {tooltips.direct}
                    </div>
                  )}
                </div>
              </button>
              <button
                onClick={() => setInvestmentType("spv")}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-1 ${
                  investmentType === "spv"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                SPV
                <div className="relative">
                  <HelpCircle
                    className="w-3.5 h-3.5 opacity-70 cursor-help"
                    onMouseEnter={() => setHoveredTooltip("spv")}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  />
                  {hoveredTooltip === "spv" && (
                    <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10 border border-slate-700">
                      {tooltips.spv}
                    </div>
                  )}
                </div>
              </button>
              <button
                onClick={() => setInvestmentType("fund")}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-1 ${
                  investmentType === "fund"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Fund
                <div className="relative">
                  <HelpCircle
                    className="w-3.5 h-3.5 opacity-70 cursor-help"
                    onMouseEnter={() => setHoveredTooltip("fund")}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  />
                  {hoveredTooltip === "fund" && (
                    <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10 border border-slate-700">
                      {tooltips.fund}
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Investment Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {investmentType === "direct"
                      ? "Investment Amount"
                      : "Subscription Amount"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-500">
                      $
                    </span>
                    <input
                      type="text"
                      value={subscriptionAmount}
                      onChange={(e) =>
                        setSubscriptionAmount(
                          formatInputNumber(e.target.value)
                        )
                      }
                      className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="200,000"
                    />
                  </div>
                </div>

                {hasFees && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      Management Fees (Total)
                      <div className="relative">
                        <HelpCircle
                          className="w-3.5 h-3.5 text-slate-400 cursor-help"
                          onMouseEnter={() =>
                            setHoveredTooltip("managementFees")
                          }
                          onMouseLeave={() => setHoveredTooltip(null)}
                        />
                        {hoveredTooltip === "managementFees" && (
                          <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                            {tooltips.managementFees}
                          </div>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={managementFees}
                        onChange={(e) =>
                          setManagementFees(
                            e.target.value.replace(/[^0-9.]/g, "")
                          )
                        }
                        className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                        placeholder="10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-lg pointer-events-none">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Typical: 5-20%
                    </p>
                  </div>
                )}

                {investmentType !== "fund" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      Entry Post-Money Valuation
                      <div className="relative">
                        <HelpCircle
                          className="w-3.5 h-3.5 text-slate-400 cursor-help"
                          onMouseEnter={() =>
                            setHoveredTooltip("postMoneyValuation")
                          }
                          onMouseLeave={() => setHoveredTooltip(null)}
                        />
                        {hoveredTooltip === "postMoneyValuation" && (
                          <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                            {tooltips.postMoneyValuation}
                          </div>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-500">
                        $
                      </span>
                      <input
                        type="text"
                        value={seedValuation}
                        onChange={(e) =>
                          setSeedValuation(formatInputNumber(e.target.value))
                        }
                        className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="20,000,000"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {investmentType !== "fund" && (
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  Dilution Scenario
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      Dilution per Round
                      <div className="relative">
                        <HelpCircle
                          className="w-3.5 h-3.5 text-slate-400 cursor-help"
                          onMouseEnter={() => setHoveredTooltip("dilution")}
                          onMouseLeave={() => setHoveredTooltip(null)}
                        />
                        {hoveredTooltip === "dilution" && (
                          <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                            {tooltips.dilution}
                          </div>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={dilutionPerRound}
                        onChange={(e) =>
                          setDilutionPerRound(
                            e.target.value.replace(/[^0-9.]/g, "")
                          )
                        }
                        className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                        placeholder="15"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-lg pointer-events-none">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Typical: 10-20%
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Number of Rounds
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setNumberOfRounds(Math.max(1, numberOfRounds - 1))
                        }
                        className="w-12 h-12 rounded-lg border border-slate-300 hover:bg-slate-100 text-xl font-semibold"
                      >
                        -
                      </button>
                      <div className="flex-1 text-center text-3xl font-bold text-slate-800">
                        {numberOfRounds}
                      </div>
                      <button
                        onClick={() =>
                          setNumberOfRounds(Math.min(10, numberOfRounds + 1))
                        }
                        className="w-12 h-12 rounded-lg border border-slate-300 hover:bg-slate-100 text-xl font-semibold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {investmentType === "fund" && (
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Fund Expectations
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      Expected Gross Multiple
                      <div className="relative">
                        <HelpCircle
                          className="w-3.5 h-3.5 text-slate-400 cursor-help"
                          onMouseEnter={() =>
                            setHoveredTooltip("expectedMultiple")
                          }
                          onMouseLeave={() => setHoveredTooltip(null)}
                        />
                        {hoveredTooltip === "expectedMultiple" && (
                          <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                            {tooltips.expectedMultiple}
                          </div>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={expectedMultiple}
                        onChange={(e) =>
                          setExpectedMultiple(
                            e.target.value.replace(/[^0-9.]/g, "")
                          )
                        }
                        className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                        placeholder="3"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-lg pointer-events-none">
                        x
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Typical: 2-4x for top-quartile funds
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      Years to Exit
                      <div className="relative">
                        <HelpCircle
                          className="w-3.5 h-3.5 text-slate-400 cursor-help"
                          onMouseEnter={() =>
                            setHoveredTooltip("yearsToExit")
                          }
                          onMouseLeave={() => setHoveredTooltip(null)}
                        />
                        {hoveredTooltip === "yearsToExit" && (
                          <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                            {tooltips.yearsToExit}
                          </div>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={yearsToExit}
                        onChange={(e) =>
                          setYearsToExit(
                            e.target.value.replace(/[^0-9.]/g, "")
                          )
                        }
                        className="w-full pl-4 pr-16 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                        placeholder="7"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-lg pointer-events-none">
                        years
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Typical: 7-10 years
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                {investmentType === "fund" ? "Carry" : "Exit & Carry"}
              </h2>

              <div className="space-y-4">
                {investmentType !== "fund" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Exit Valuation
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-500">
                        $
                      </span>
                      <input
                        type="text"
                        value={exitValuation}
                        onChange={(e) =>
                          setExitValuation(formatInputNumber(e.target.value))
                        }
                        className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="1,000,000,000"
                      />
                    </div>
                  </div>
                )}

                {hasFees && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                      Carry to VC
                      <div className="relative">
                        <HelpCircle
                          className="w-3.5 h-3.5 text-slate-400 cursor-help"
                          onMouseEnter={() => setHoveredTooltip("carryInput")}
                          onMouseLeave={() => setHoveredTooltip(null)}
                        />
                        {hoveredTooltip === "carryInput" && (
                          <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                            {tooltips.carry}
                          </div>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={carryPercent}
                        onChange={(e) =>
                          setCarryPercent(
                            e.target.value.replace(/[^0-9.]/g, "")
                          )
                        }
                        className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                        placeholder="20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold text-lg pointer-events-none">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Standard: 20%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-4">
            {results ? (
              <>
                {/* Key Metrics */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg p-6 text-white">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Your Returns
                  </h2>
                  {investmentType === "fund" ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-blue-200 text-sm mb-1">
                          Net Proceeds
                        </div>
                        <div className="text-3xl font-bold">
                          {formatCurrency(results.netProceeds)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-blue-200 text-sm mb-1">
                            Net MOIC
                          </div>
                          <div className="text-3xl font-bold">
                            {formatMOIC(results.netMOIC)}
                          </div>
                        </div>
                        {results.irr !== undefined && (
                          <div>
                            <div className="text-blue-200 text-sm mb-1">IRR</div>
                            <div className="text-3xl font-bold">
                              {formatPercent(results.irr * 100)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-blue-200 text-sm mb-1">
                          {investmentType === "direct" ? "Total Proceeds" : "Net Proceeds"}
                        </div>
                        <div className="text-3xl font-bold">
                          {formatCurrency(results.netProceeds)}
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-200 text-sm mb-1">
                          {investmentType === "direct" ? "Total MOIC" : "Net MOIC"}
                        </div>
                        <div className="text-3xl font-bold">
                          {formatMOIC(results.netMOIC)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detailed Breakdown - only for direct/spv */}
                {investmentType !== "fund" && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                      Investment Breakdown
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-600">
                          {investmentType === "direct"
                            ? "Investment Amount"
                            : "Seed Investment (after fees)"}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(results.seedInvestment)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-600">Seed Ownership</span>
                        <span className="font-semibold text-slate-800">
                          {formatPercent(results.seedOwnership)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-600">
                          Final Ownership (after dilution)
                        </span>
                        <div className="text-right">
                          <div className="font-semibold text-slate-800">
                            {formatPercent(results.finalOwnership)}
                          </div>
                          <div className="w-32 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (results.finalOwnership /
                                    results.seedOwnership) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fund capital breakdown */}
                {investmentType === "fund" && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                      Capital Breakdown
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-600">
                          Committed Capital
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(
                            parseFloat(
                              parseInputNumber(subscriptionAmount)
                            ) || 0
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-600">
                          Deployed Capital (after fees)
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(results.seedInvestment)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-600">
                          Expected Gross Multiple
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatMOIC(results.grossMOIC)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Returns Breakdown */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    Returns Analysis
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">{investmentType === "direct" ? "Total Proceeds" : "Gross Proceeds"}</span>
                        <div className="relative">
                          <HelpCircle
                            className="w-4 h-4 text-slate-400 cursor-help"
                            onMouseEnter={() =>
                              setHoveredTooltip("grossProceeds")
                            }
                            onMouseLeave={() => setHoveredTooltip(null)}
                          />
                          {hoveredTooltip === "grossProceeds" && (
                            <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                              {tooltips.grossProceeds}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(results.grossProceeds)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">{investmentType === "direct" ? "Total MOIC" : "Gross MOIC"}</span>
                        <div className="relative">
                          <HelpCircle
                            className="w-4 h-4 text-slate-400 cursor-help"
                            onMouseEnter={() =>
                              setHoveredTooltip("grossMOIC")
                            }
                            onMouseLeave={() => setHoveredTooltip(null)}
                          />
                          {hoveredTooltip === "grossMOIC" && (
                            <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                              {tooltips.grossMOIC}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-slate-800">
                        {formatMOIC(results.grossMOIC)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">{investmentType === "direct" ? "Total Profit" : "Gross Profit"}</span>
                        <div className="relative">
                          <HelpCircle
                            className="w-4 h-4 text-slate-400 cursor-help"
                            onMouseEnter={() =>
                              setHoveredTooltip("grossProfit")
                            }
                            onMouseLeave={() => setHoveredTooltip(null)}
                          />
                          {hoveredTooltip === "grossProfit" && (
                            <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                              {tooltips.grossProfit}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(results.grossProfit)}
                      </span>
                    </div>
                    {hasFees && results.carryAmount > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">Carry to VC</span>
                          <div className="relative">
                            <HelpCircle
                              className="w-4 h-4 text-slate-400 cursor-help"
                              onMouseEnter={() => setHoveredTooltip("carry")}
                              onMouseLeave={() => setHoveredTooltip(null)}
                            />
                            {hoveredTooltip === "carry" && (
                              <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                                {tooltips.carry}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(results.carryAmount)}
                        </span>
                      </div>
                    )}
                    {investmentType !== "direct" && (
                      <>
                        <div className="flex justify-between items-center py-3 bg-slate-50 rounded-lg px-3 mt-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              Net Proceeds
                            </span>
                            <div className="relative">
                              <HelpCircle
                                className="w-4 h-4 text-slate-500 cursor-help"
                                onMouseEnter={() =>
                                  setHoveredTooltip("netProceeds")
                                }
                                onMouseLeave={() => setHoveredTooltip(null)}
                              />
                              {hoveredTooltip === "netProceeds" && (
                                <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                                  {tooltips.netProceeds}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-green-600 text-lg">
                            {formatCurrency(results.netProceeds)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 bg-slate-50 rounded-lg px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              Net MOIC
                            </span>
                            <div className="relative">
                              <HelpCircle
                                className="w-4 h-4 text-slate-500 cursor-help"
                                onMouseEnter={() => setHoveredTooltip("netMOIC")}
                                onMouseLeave={() => setHoveredTooltip(null)}
                              />
                              {hoveredTooltip === "netMOIC" && (
                                <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                                  {tooltips.netMOIC}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-blue-600 text-lg">
                            {formatMOIC(results.netMOIC)}
                          </span>
                        </div>
                      </>
                    )}
                    {investmentType === "fund" &&
                      results.irr !== undefined && (
                        <div className="flex justify-between items-center py-3 bg-slate-50 rounded-lg px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">
                              IRR
                            </span>
                            <div className="relative">
                              <HelpCircle
                                className="w-4 h-4 text-slate-500 cursor-help"
                                onMouseEnter={() =>
                                  setHoveredTooltip("irr")
                                }
                                onMouseLeave={() => setHoveredTooltip(null)}
                              />
                              {hoveredTooltip === "irr" && (
                                <div className="absolute left-6 top-0 w-64 bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl z-10">
                                  {tooltips.irr}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-purple-600 text-lg">
                            {formatPercent(results.irr * 100)}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Ownership Dilution Chart - only for direct/spv */}
                {investmentType !== "fund" && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                      Ownership Dilution Over Rounds
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={getChartData()}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="round"
                          stroke="#64748b"
                          style={{ fontSize: "12px" }}
                        />
                        <YAxis
                          stroke="#64748b"
                          style={{ fontSize: "12px" }}
                          tickFormatter={(value: number) =>
                            `${value.toFixed(2)}%`
                          }
                        />
                        <Tooltip
                          formatter={(value: number) =>
                            `${value.toFixed(3)}%`
                          }
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="ownership"
                          stroke="#2563eb"
                          strokeWidth={3}
                          dot={{ fill: "#2563eb", r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg">
                  Enter your investment details to see results
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
