import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { BillingCycle } from "../models/BillingCycle.js";
import { Client } from "../models/Client.js";
import { Expense } from "../models/Expense.js";
import { Invoice } from "../models/Invoice.js";
import { Payment } from "../models/Payment.js";
import { Project } from "../models/Project.js";
import { Service } from "../models/Service.js";
import { HttpError } from "../utils/http-error.js";
import { createPdfBuffer, formatPdfMoney } from "../utils/pdf.js";
import { calculateInvoiceItem, calculateInvoiceTotals, newDocumentNumber } from "../utils/financials.js";

export const financeRouter = Router();
financeRouter.use(authenticate);
const invoiceItemInput = z.object({
    service: z.string().refine(mongoose.isValidObjectId).optional(),
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive().max(1_000_000),
    unit: z.string().trim().min(1).max(40),
    ratePaise: z.number().int().min(0).max(100_000_000_000),
    discountPaise: z.number().int().min(0).default(0),
    taxRateBasisPoints: z.number().int().min(0).max(10000).default(0),
    hsnSac: z.string().max(20).optional(),
});
const invoiceInput = z.object({
    client: z.string().refine(mongoose.isValidObjectId),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    billingStartDate: z.coerce.date().optional(),
    billingEndDate: z.coerce.date().optional(),
    items: z.array(invoiceItemInput).min(1).max(100),
    placeOfSupply: z.string().max(120).optional(),
    notes: z.string().max(5000).optional(),
});

function pageParams(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { page, limit };
}

function mapInvoiceItems(items) {
    const calculated = items.map((item) => {
        const amounts = calculateInvoiceItem(item);
        return { ...item, ...amounts, taxPaise: amounts.taxPaise };
    });
    const totals = calculateInvoiceTotals(calculated);
    return { items: calculated, totals };
}

financeRouter.get("/expenses/options", requirePermission("expenses:read"), async (_req, res, next) => {
    try {
        const [clients, projects] = await Promise.all([
            Client.find({ archivedAt: null }).select("name").sort({ name: 1 }).lean(),
            Project.find({ archivedAt: null }).select("name client").populate("client", "name").sort({ name: 1 }).lean(),
        ]);
        res.json({ clients, projects });
    } catch (error) { next(error); }
});

financeRouter.get("/invoices", requirePermission("finance:read"), async (req, res, next) => {
    try {
        const { page, limit } = pageParams(req.query);
        const filter = {};
        if (typeof req.query.status === "string")
            filter.status = req.query.status;
        if (typeof req.query.client === "string" && mongoose.isValidObjectId(req.query.client))
            filter.client = req.query.client;
        const [items, total] = await Promise.all([
            Invoice.find(filter).populate("client", "name email").sort({ issueDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Invoice.countDocuments(filter),
        ]);
        const dated = items.map((invoice) => invoice.status === "issued" && invoice.dueDate < new Date() && invoice.amountDuePaise > 0
            ? { ...invoice, status: "overdue" }
            : invoice);
        res.json({ items: dated, page, limit, total, pages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
});

financeRouter.get("/invoices/:id/pdf", requirePermission("finance:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid invoice ID.");
        const invoice = await Invoice.findById(req.params.id).populate(
            "client",
            "name email phone billingAddress gstin pan",
        ).lean();
        if (!invoice)
            throw new HttpError(404, "Invoice not found.");
        const lines = invoice.items.map((item, index) =>
            `${index + 1}. ${item.description} — ${item.quantity} ${item.unit} x ${formatPdfMoney(item.ratePaise)}; tax ${formatPdfMoney(item.taxPaise)}; total ${formatPdfMoney(item.totalPaise)}`,
        );
        const buffer = await createPdfBuffer({
            title: `Invoice ${invoice.number}`,
            subtitle: `Status: ${invoice.status} | Currency: ${invoice.currency || "INR"}`,
            sections: [
                { title: "Bill to", lines: [invoice.client?.name, invoice.client?.email, invoice.client?.phone, invoice.client?.billingAddress, invoice.client?.gstin ? `GSTIN: ${invoice.client.gstin}` : null].filter(Boolean) },
                { title: "Invoice dates", lines: [`Issue date: ${invoice.issueDate.toISOString().slice(0, 10)}`, `Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`] },
                { title: "Items", lines },
                { title: "Totals", lines: [`Subtotal: ${formatPdfMoney(invoice.subtotalPaise)}`, `Discount: ${formatPdfMoney(invoice.discountPaise)}`, `Tax: ${formatPdfMoney(invoice.taxPaise)}`, `Total: ${formatPdfMoney(invoice.totalPaise)}`, `Paid: ${formatPdfMoney(invoice.amountPaidPaise)}`, `Amount due: ${formatPdfMoney(invoice.amountDuePaise)}`] },
                ...(invoice.notes ? [{ title: "Notes", lines: [invoice.notes] }] : []),
            ],
        });
        res.type("application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${invoice.number}.pdf"`);
        res.send(buffer);
    } catch (error) { next(error); }
});

financeRouter.post("/invoices", requirePermission("finance:write"), async (req, res, next) => {
    try {
        const input = invoiceInput.parse(req.body);
        if (input.dueDate < input.issueDate)
            throw new HttpError(400, "Invoice due date cannot be before its issue date.");
        if (!await Client.exists({ _id: input.client, archivedAt: null }))
            throw new HttpError(404, "Client not found.");
        for (const item of input.items) {
            if (item.service && !await Service.exists({ _id: item.service }))
                throw new HttpError(404, "One of the selected services was not found.");
        }
        const { items, totals } = mapInvoiceItems(input.items);
        const invoice = await Invoice.create({
            ...input,
            number: newDocumentNumber("INV"),
            items,
            ...totals,
            amountDuePaise: totals.totalPaise,
            createdBy: req.user.id,
        });
        res.status(201).json({ item: invoice });
    } catch (error) { next(error); }
});

financeRouter.post("/invoices/from-cycle", requirePermission("finance:write"), async (req, res, next) => {
    try {
        const { cycleId, issueDate, dueDate } = z.object({
            cycleId: z.string().refine(mongoose.isValidObjectId),
            issueDate: z.coerce.date(),
            dueDate: z.coerce.date(),
        }).parse(req.body);
        if (dueDate < issueDate)
            throw new HttpError(400, "Invoice due date cannot be before its issue date.");
        const cycle = await BillingCycle.findOne({ _id: cycleId, status: "open" }).populate("contract", "number paymentDueDays").populate("items.service", "name");
        if (!cycle)
            throw new HttpError(404, "Open billing cycle not found.");
        const lines = cycle.items.flatMap((item) => [
            ...(item.billableQuantity > 0 ? [{
                service: item.service._id,
                description: item.description || item.service.name,
                quantity: item.billableQuantity,
                unit: item.unit,
                ratePaise: item.ratePaise,
                discountPaise: 0,
                taxRateBasisPoints: item.taxRateBasisPoints,
            }] : []),
            ...(item.additionalQuantity > 0 ? [{
                service: item.service._id,
                description: `${item.description || item.service.name} (additional work)`,
                quantity: item.additionalQuantity,
                unit: item.unit,
                ratePaise: item.additionalUnitRatePaise,
                discountPaise: 0,
                taxRateBasisPoints: item.taxRateBasisPoints,
            }] : []),
        ]);
        if (!lines.length)
            throw new HttpError(400, "No billable quantities have been recorded for this cycle.");
        const { items, totals } = mapInvoiceItems(lines);
        const invoice = await Invoice.create({
            number: newDocumentNumber("INV"),
            client: cycle.client,
            contract: cycle.contract._id,
            billingCycle: cycle._id,
            issueDate,
            dueDate,
            billingStartDate: cycle.startDate,
            billingEndDate: cycle.endDate,
            items,
            ...totals,
            amountDuePaise: totals.totalPaise,
            createdBy: req.user.id,
        });
        cycle.invoice = invoice._id;
        cycle.status = "invoiced";
        await cycle.save();
        res.status(201).json({ item: invoice });
    } catch (error) { next(error); }
});

financeRouter.patch("/invoices/:id/issue", requirePermission("finance:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid invoice ID.");
        const invoice = await Invoice.findOneAndUpdate(
            { _id: req.params.id, status: "draft" },
            { $set: { status: "issued", issuedAt: new Date() } },
            { new: true },
        );
        if (!invoice)
            throw new HttpError(409, "Only draft invoices can be issued.");
        res.json({ item: invoice });
    } catch (error) { next(error); }
});

financeRouter.post("/invoices/:id/payments", requirePermission("finance:write"), async (req, res, next) => {
    let payment;
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid invoice ID.");
        const input = z.object({
            amountPaise: z.number().int().positive().max(100_000_000_000),
            date: z.coerce.date(),
            method: z.enum(["cash", "upi", "bank_transfer", "cheque", "online", "other"]),
            reference: z.string().max(180).optional(),
            notes: z.string().max(2000).optional(),
        }).parse(req.body);
        const invoice = await Invoice.findOne({ _id: req.params.id, status: { $in: ["issued", "sent", "partially_paid", "overdue"] } });
        if (!invoice)
            throw new HttpError(409, "Payments can only be recorded against issued invoices.");
        payment = await Payment.create({ ...input, invoice: invoice._id, recordedBy: req.user.id });
        const updated = await Invoice.findOneAndUpdate(
            { _id: invoice._id, amountDuePaise: { $gte: input.amountPaise }, status: { $in: ["issued", "sent", "partially_paid", "overdue"] } },
            [{
                $set: {
                    amountDuePaise: { $subtract: ["$amountDuePaise", input.amountPaise] },
                    amountPaidPaise: { $add: ["$amountPaidPaise", input.amountPaise] },
                },
            }, {
                $set: {
                    status: { $cond: [{ $eq: ["$amountDuePaise", 0] }, "paid", "partially_paid"] },
                },
            }],
            { new: true },
        );
        if (!updated) {
            await Payment.deleteOne({ _id: payment._id });
            payment = undefined;
            throw new HttpError(409, "Payment exceeds the invoice's outstanding balance. Refresh and try again.");
        }
        res.status(201).json({ item: payment, invoice: updated });
    } catch (error) {
        if (payment?._id)
            await Payment.deleteOne({ _id: payment._id });
        next(error);
    }
});

financeRouter.get("/invoices/:id/payments", requirePermission("finance:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid invoice ID.");
        if (!await Invoice.exists({ _id: req.params.id }))
            throw new HttpError(404, "Invoice not found.");
        const items = await Payment.find({ invoice: req.params.id }).populate("recordedBy", "name").sort({ date: -1 }).lean();
        res.json({ items });
    } catch (error) { next(error); }
});

const expenseInput = z.object({
    title: z.string().trim().min(1).max(180),
    amountPaise: z.number().int().positive().max(100_000_000_000),
    category: z.string().trim().min(1).max(100),
    date: z.coerce.date(),
    paymentMethod: z.enum(["cash", "upi", "bank_transfer", "card", "other"]).default("other"),
    client: z.string().refine(mongoose.isValidObjectId).optional(),
    project: z.string().refine(mongoose.isValidObjectId).optional(),
    notes: z.string().max(3000).optional(),
});

financeRouter.get("/expenses", requirePermission("expenses:read"), async (req, res, next) => {
    try {
        const { page, limit } = pageParams(req.query);
        const filter = { archivedAt: null };
        if (typeof req.query.client === "string" && mongoose.isValidObjectId(req.query.client))
            filter.client = req.query.client;
        const [items, total] = await Promise.all([
            Expense.find(filter).populate("client", "name").populate("project", "name").sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Expense.countDocuments(filter),
        ]);
        res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
});

financeRouter.post("/expenses", requirePermission("expenses:write"), async (req, res, next) => {
    try {
        const input = expenseInput.parse(req.body);
        if (input.client && !await Client.exists({ _id: input.client }))
            throw new HttpError(404, "Client not found.");
        const expense = await Expense.create({ ...input, recordedBy: req.user.id });
        res.status(201).json({ item: expense });
    } catch (error) { next(error); }
});

financeRouter.get("/summary", requirePermission("finance:read"), async (req, res, next) => {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [invoiced, collected, outstanding, overdue, expenses] = await Promise.all([
            Invoice.aggregate([{ $match: { issueDate: { $gte: monthStart }, status: { $ne: "cancelled" } } }, { $group: { _id: null, value: { $sum: "$totalPaise" } } }]),
            Payment.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: null, value: { $sum: "$amountPaise" } } }]),
            Invoice.aggregate([{ $match: { status: { $in: ["issued", "sent", "partially_paid", "overdue"] } } }, { $group: { _id: null, value: { $sum: "$amountDuePaise" } } }]),
            Invoice.aggregate([{ $match: { dueDate: { $lt: now }, amountDuePaise: { $gt: 0 }, status: { $ne: "cancelled" } } }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$amountDuePaise" } } }]),
            Expense.aggregate([{ $match: { date: { $gte: monthStart }, archivedAt: null } }, { $group: { _id: null, value: { $sum: "$amountPaise" } } }]),
        ]);
        res.json({
            month: { start: monthStart, end: now },
            invoicedPaise: invoiced[0]?.value || 0,
            collectedPaise: collected[0]?.value || 0,
            outstandingPaise: outstanding[0]?.value || 0,
            overdueCount: overdue[0]?.count || 0,
            overduePaise: overdue[0]?.value || 0,
            expensesPaise: expenses[0]?.value || 0,
        });
    } catch (error) { next(error); }
});
