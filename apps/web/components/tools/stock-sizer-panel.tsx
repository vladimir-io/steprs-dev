"use client";

import {
  formatInches,
  sizeStock,
  MACHINING_ALLOWANCE_IN,
} from "@/lib/stock-sizer";
import { quotingBoundingBoxMm } from "@/lib/analysis/envelope";
import { formatNumber } from "@/lib/utils";
import type { ParseResult } from "@steprs/ts-types";

interface StockSizerPanelProps {
  result: ParseResult | null;
  isParsing: boolean;
}

export function StockSizerPanel({ result, isParsing }: StockSizerPanelProps) {
  if (isParsing) {
    return (
      <p className="workbench-panel-empty">Computing bounding box…</p>
    );
  }

  if (!result?.quoting) {
    return (
      <p className="workbench-panel-empty">
        Drop a STEP file to size billet for material ordering.
      </p>
    );
  }

  const bbox = quotingBoundingBoxMm(result);
  const stock = sizeStock(bbox, result.quoting.units);
  const primary =
    stock.preferredUnit === "inch" ? stock.billetLabelIn : stock.billetLabelMm;
  const alternate =
    stock.preferredUnit === "inch" ? stock.billetLabelMm : stock.billetLabelIn;

  return (
    <div className="stock-panel">
      <div className="stock-panel__hero">
        <p className="stock-panel__eyebrow">
          Suggested billet · L × W × H · +{MACHINING_ALLOWANCE_IN}&quot; / side · material buy
        </p>
        <p className="stock-panel__size">{primary}</p>
        <p className="stock-panel__alt">{alternate}</p>
      </div>

      <p className="stock-panel__note">
        Billet estimates for material ordering. Axis-aligned envelope only (no kerf or saw cuts). Snaps to catalog sizes; check with your supplier.
      </p>

      <dl className="stock-panel__grid">
        <div className="stock-panel__row">
          <dt>Part envelope (L×W×H)</dt>
          <dd data-testid="stock-envelope-mm">
            {formatNumber(stock.rawMm.x, 1)} × {formatNumber(stock.rawMm.y, 1)} ×{" "}
            {formatNumber(stock.rawMm.z, 1)} mm
            <span className="stock-panel__sub">
              {formatInches(stock.rawIn.x)} × {formatInches(stock.rawIn.y)} ×{" "}
              {formatInches(stock.rawIn.z)} in
            </span>
          </dd>
        </div>
        <div className="stock-panel__row">
          <dt>With allowance</dt>
          <dd>
            {formatNumber(stock.withAllowanceMm.x, 1)} ×{" "}
            {formatNumber(stock.withAllowanceMm.y, 1)} ×{" "}
            {formatNumber(stock.withAllowanceMm.z, 1)} mm
            <span className="stock-panel__sub">
              {formatInches(stock.withAllowanceIn.x)} ×{" "}
              {formatInches(stock.withAllowanceIn.y)} ×{" "}
              {formatInches(stock.withAllowanceIn.z)} in
            </span>
          </dd>
        </div>
        <div className="stock-panel__row">
          <dt>Part volume</dt>
          <dd>{formatNumber(stock.partVolumeMm3, 0)} mm³</dd>
        </div>
        <div className="stock-panel__row">
          <dt>Billet volume</dt>
          <dd>
            {stock.preferredUnit === "inch"
              ? `${formatInches(stock.stockVolumeIn3, 2)} in³`
              : `${formatNumber(stock.stockVolumeMm3, 0)} mm³`}
          </dd>
        </div>
      </dl>
    </div>
  );
}
