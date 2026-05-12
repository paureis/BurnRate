"use client";

import { ClipboardPaste, Sparkles } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import {
  type BillingCycle,
  type Subscription,
  createId,
  defaultCategoryColors,
  todayDateInputValue,
} from "@/lib/burnrate";
import { popularServices } from "@/data/popular-services";
import { collapseDuplicates, parseChargesText, type CollapsedCharge } from "@/lib/charges";
import { matchCharges, type ChargeMatch } from "@/lib/charge-matcher";
import { supportedCurrencies } from "@/data/fx-rates";
import { formatMoney } from "@/lib/currency";

type RowAction = "new" | "ignore" | "existing" | "popular";

interface ImporterRow {
  charge: CollapsedCharge;
  match: ChargeMatch;
  action: RowAction;
  billingCycle: BillingCycle;
}

export function ChargesImporter({
  baseCurrency,
  onAdd,
  subscriptions,
}: {
  baseCurrency: string;
  onAdd: (sub: Subscription) => void;
  subscriptions: Subscription[];
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImporterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseStat, setParseStat] = useState<{ parsed: number; ignored: number } | null>(null);

  function handleParse() {
    setError(null);
    const lineCount = text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    const parsed = parseChargesText(text, { currency: baseCurrency });
    if (parsed.length === 0) {
      setRows([]);
      setParseStat({ parsed: 0, ignored: lineCount });
      setError("We couldn't find any charges. Each line needs an amount with a currency symbol or 3-letter code.");
      return;
    }
    const collapsed = collapseDuplicates(parsed);
    const matched = matchCharges(collapsed, subscriptions, popularServices);
    const initialRows: ImporterRow[] = collapsed.map((charge, idx) => ({
      charge,
      match: matched[idx],
      action: matched[idx].matchType,
      billingCycle: "monthly",
    }));
    setRows(initialRows);
    setParseStat({ parsed: collapsed.length, ignored: Math.max(0, lineCount - parsed.length) });
  }

  function updateRow(index: number, patch: Partial<ImporterRow>) {
    setRows((current) => {
      if (!current) return current;
      return current.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
    });
  }

  function handleConfirm() {
    if (!rows) return;
    let added = 0;
    for (const row of rows) {
      if (row.action !== "new") continue;
      const name = row.charge.vendorGuess.trim();
      if (!name) continue;
      const subscription: Subscription = {
        id: createId("sub"),
        name,
        costCents: row.charge.amountCents,
        billingCycle: row.billingCycle,
        category: "other",
        nextBillingDate: row.charge.dateGuess ?? todayDateInputValue(),
        notes: `Imported from pasted charges${row.charge.occurrences > 1 ? ` (${row.charge.occurrences} occurrences)` : ""}`,
        color: defaultCategoryColors.other ?? "#9aa4b2",
        icon: "wallet",
        createdAt: new Date().toISOString(),
        currency: row.charge.currency,
      };
      onAdd(subscription);
      added += 1;
    }
    setRows(null);
    setText("");
    setParseStat(added > 0 ? { parsed: added, ignored: 0 } : null);
  }

  return (
    <section className="panel p-5" aria-label="Paste charges importer">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardPaste aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
        <h2 className="text-xl font-extrabold">Bulk add from pasted charges</h2>
      </div>
      <p className="rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-3 text-xs font-bold text-[color:var(--accent-2)]">
        Parsing happens entirely in your browser. Nothing leaves this device.
      </p>

      {!rows && (
        <>
          <label className="label mt-3">
            Paste lines from a bank statement, credit-card export, or list of receipts.
            <textarea
              className="input mt-1 min-h-32 font-mono text-sm"
              value={text}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value)}
              placeholder={`NETFLIX.COM $15.99\nSPOTIFY USA $11.99\n2026-05-01 Notion 10.00 USD`}
            />
          </label>
          {error && (
            <p className="mt-2 text-xs font-bold text-[color:var(--danger)]">{error}</p>
          )}
          {parseStat && parseStat.parsed === 0 && parseStat.ignored > 0 && (
            <p className="mt-1 text-xs text-[color:var(--subtle)]">Ignored {parseStat.ignored} unparseable lines.</p>
          )}
          <button
            className="button-primary mt-3"
            type="button"
            disabled={text.trim().length === 0}
            onClick={handleParse}
          >
            <Sparkles aria-hidden="true" size={17} />
            Parse charges
          </button>
        </>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-3 grid gap-3">
          <p className="text-xs text-[color:var(--muted)]">
            Found {rows.length} charge{rows.length === 1 ? "" : "s"}. Tweak each row, then confirm.
          </p>
          <ul className="grid gap-2">
            {rows.map((row, index) => (
              <li
                key={`${row.charge.vendorGuess}-${index}`}
                className="grid gap-2 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 md:grid-cols-[1.2fr_auto_auto_auto_auto]"
              >
                <div className="min-w-0">
                  <input
                    className="input"
                    value={row.charge.vendorGuess}
                    onChange={(event) =>
                      updateRow(index, {
                        charge: { ...row.charge, vendorGuess: event.target.value },
                      })
                    }
                    aria-label="Vendor"
                  />
                  <p className="mt-1 truncate text-xs text-[color:var(--subtle)]" title={row.charge.rawLine}>
                    {row.charge.rawLine}
                    {row.charge.occurrences > 1 && ` · ${row.charge.occurrences}×`}
                  </p>
                </div>
                <label className="label text-xs">
                  Amount
                  <input
                    className="input"
                    inputMode="decimal"
                    value={(row.charge.amountCents / (row.charge.currency === "JPY" || row.charge.currency === "KRW" ? 1 : 100)).toString()}
                    onChange={(event) => {
                      const parsed = Number.parseFloat(event.target.value);
                      if (Number.isFinite(parsed) && parsed > 0) {
                        const multiplier = row.charge.currency === "JPY" || row.charge.currency === "KRW" ? 1 : 100;
                        updateRow(index, {
                          charge: { ...row.charge, amountCents: Math.round(parsed * multiplier) },
                        });
                      }
                    }}
                  />
                </label>
                <label className="label text-xs">
                  Currency
                  <select
                    className="input"
                    value={row.charge.currency}
                    onChange={(event) =>
                      updateRow(index, {
                        charge: { ...row.charge, currency: event.target.value },
                      })
                    }
                  >
                    {supportedCurrencies.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label text-xs">
                  Cycle
                  <select
                    className="input"
                    value={row.billingCycle}
                    onChange={(event) => updateRow(index, { billingCycle: event.target.value as BillingCycle })}
                  >
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                    <option value="quarterly">quarterly</option>
                    <option value="yearly">yearly</option>
                  </select>
                </label>
                <label className="label text-xs">
                  Action
                  <select
                    className="input"
                    value={row.action}
                    onChange={(event) => updateRow(index, { action: event.target.value as RowAction })}
                  >
                    <option value="new">Add as new</option>
                    <option value="ignore">Ignore</option>
                    {row.match.matchType === "existing" && (
                      <option value="existing">Skip — matches existing</option>
                    )}
                    {row.match.matchType === "popular" && (
                      <option value="popular">Skip — matches popular</option>
                    )}
                  </select>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button className="button-primary" type="button" onClick={handleConfirm}>
              <Sparkles aria-hidden="true" size={17} />
              Add {rows.filter((row) => row.action === "new").length} new subscription
              {rows.filter((row) => row.action === "new").length === 1 ? "" : "s"}
            </button>
            <button className="button-ghost" type="button" onClick={() => setRows(null)}>
              Start over
            </button>
          </div>
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="mt-3 grid gap-2">
          <p className="text-sm text-[color:var(--muted)]">
            Nothing parsed. Each line needs an amount (with $ / € / etc. or a 3-letter currency code).
          </p>
          <button className="button-ghost" type="button" onClick={() => setRows(null)}>
            Try again
          </button>
        </div>
      )}

      <p className="sr-only">{baseCurrency}</p>
      <p className="sr-only">{formatMoney(0, baseCurrency)}</p>
    </section>
  );
}
