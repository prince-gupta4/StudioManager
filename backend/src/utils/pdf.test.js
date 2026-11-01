import assert from "node:assert/strict";
import { test } from "node:test";
import { createPdfBuffer } from "./pdf.js";

test("creates a valid PDF buffer for a formatted report", async () => {
    const pdf = await createPdfBuffer({
        title: "Invoice INV-001",
        subtitle: "Status: issued",
        sections: [{ title: "Totals", lines: ["Total: INR 125.00"] }],
    });

    assert.ok(pdf.length > 500);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.includes(Buffer.from("%%EOF")));
});
