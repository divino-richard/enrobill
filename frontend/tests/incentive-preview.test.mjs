import assert from "node:assert/strict";
import { test } from "node:test";
import { previewNet } from "../src/features/bills/incentive-preview.ts";

const voucher = (type, value) => ({ id: 1, name: "Test voucher", type, value });

test("full vouchers cover the gross amount regardless of their stored value", () => {
  assert.equal(previewNet(18000, voucher("full", 0)), 0);
});

test("fixed vouchers cannot make the preview negative", () => {
  assert.equal(previewNet(18000, voucher("fixed", 20000)), 0);
});

test("percentage vouchers use the fee total and round to centavos", () => {
  assert.equal(previewNet(18000.01, voucher("percentage", 25)), 13500.01);
});

test("without a usable voucher no voucher credit appears", () => {
  assert.equal(previewNet(18000, null), 18000);
});
