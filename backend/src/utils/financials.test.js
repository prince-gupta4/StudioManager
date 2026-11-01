import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateInvoiceItem, calculateInvoiceTotals } from "./financials.js";

test("calculates tax in integer paise after discount", () => {
    assert.deepEqual(calculateInvoiceItem({ quantity: 2, ratePaise: 10000, discountPaise: 1000, taxRateBasisPoints: 1800 }), {
        subtotalPaise: 20000,
        discountPaise: 1000,
        taxPaise: 3420,
        totalPaise: 22420,
    });
});

test("rejects a discount larger than the item subtotal", () => {
    assert.throws(() => calculateInvoiceItem({ quantity: 1, ratePaise: 100, discountPaise: 101 }), RangeError);
});

test("sums line totals without floating point arithmetic", () => {
    const item = calculateInvoiceItem({ quantity: 3, ratePaise: 1 });
    assert.equal(calculateInvoiceTotals([item, item]).totalPaise, 6);
});
