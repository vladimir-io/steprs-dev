import { expect, test } from "@playwright/test";

import mountingPlateFixture from "../data/api/v1/fixtures/mounting-plate.json";

const EXPECTED_HOLES = mountingPlateFixture.parse.quoting.holes.length;
const EXPECTED_ENVELOPE =
  mountingPlateFixture.parse.quoting.part_envelope_mm.dimensions;

test("mounting-plate sample matches golden holes and stock envelope", async ({
  page,
}) => {
  await page.goto("/");

  const sample = page.getByTestId("sample-card-mounting-plate");
  await expect(sample).toBeEnabled({ timeout: 30_000 });
  await sample.click();

  const summary = page.getByTestId("hole-count-summary");
  await expect(summary).toBeVisible({ timeout: 60_000 });
  await expect(summary).toContainText(`${EXPECTED_HOLES} holes`);

  await page.getByRole("tab", { name: "Stock" }).click();
  const envelope = page.getByTestId("stock-envelope-mm");
  await expect(envelope).toBeVisible();
  await expect(envelope).toContainText(String(Math.round(EXPECTED_ENVELOPE.x)));
  await expect(envelope).toContainText(String(Math.round(EXPECTED_ENVELOPE.y)));
  await expect(envelope).toContainText(String(Math.round(EXPECTED_ENVELOPE.z)));
});
