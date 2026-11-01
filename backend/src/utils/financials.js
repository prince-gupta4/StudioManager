export function calculateInvoiceItem({ quantity, ratePaise, discountPaise = 0, taxRateBasisPoints = 0 }) {
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(ratePaise) || ratePaise < 0 ||
        !Number.isInteger(discountPaise) || discountPaise < 0 || !Number.isInteger(taxRateBasisPoints) ||
        taxRateBasisPoints < 0 || taxRateBasisPoints > 10000) {
        throw new RangeError("Invoice item values are outside the allowed range.");
    }
    const grossPaise = Math.round(quantity * ratePaise);
    if (discountPaise > grossPaise)
        throw new RangeError("Discount cannot exceed the line item amount.");
    const taxablePaise = grossPaise - discountPaise;
    const taxPaise = Math.round((taxablePaise * taxRateBasisPoints) / 10000);
    return {
        subtotalPaise: grossPaise,
        discountPaise,
        taxPaise,
        totalPaise: taxablePaise + taxPaise,
    };
}

export function calculateInvoiceTotals(items) {
    if (!Array.isArray(items) || items.length === 0)
        throw new RangeError("An invoice must contain at least one item.");
    return items.reduce((totals, item) => ({
        subtotalPaise: totals.subtotalPaise + item.subtotalPaise,
        discountPaise: totals.discountPaise + item.discountPaise,
        taxPaise: totals.taxPaise + item.taxPaise,
        totalPaise: totals.totalPaise + item.totalPaise,
    }), { subtotalPaise: 0, discountPaise: 0, taxPaise: 0, totalPaise: 0 });
}

export function newDocumentNumber(prefix) {
    const date = new Date();
    const ymd = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("");
    return `${prefix}-${ymd}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
