import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { Client } from "../models/Client.js";
import { Contract } from "../models/Contract.js";
import { Quotation } from "../models/Quotation.js";
import { Service } from "../models/Service.js";
import { HttpError } from "../utils/http-error.js";
import { calculateInvoiceItem, calculateInvoiceTotals, newDocumentNumber } from "../utils/financials.js";
import { createPdfBuffer, formatPdfMoney } from "../utils/pdf.js";

export const quotationsRouter = Router();
quotationsRouter.use(authenticate);
const quotationInput = z.object({
    client: z.string().refine(mongoose.isValidObjectId),
    title: z.string().trim().min(1).max(180),
    issueDate: z.coerce.date(),
    validUntil: z.coerce.date(),
    terms: z.string().max(5000).optional(),
    items: z.array(z.object({
        service: z.string().refine(mongoose.isValidObjectId).optional(),
        description: z.string().trim().min(1).max(500),
        quantity: z.number().positive(),
        unit: z.string().trim().min(1).max(40),
        ratePaise: z.number().int().min(0).max(100_000_000_000),
        discountPaise: z.number().int().min(0).default(0),
        taxRateBasisPoints: z.number().int().min(0).max(10000).default(0),
    })).min(1).max(100),
});

quotationsRouter.get("/", requirePermission("finance:read"), async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const filter = {};
        if (typeof req.query.status === "string")
            filter.status = req.query.status;
        const [items, total] = await Promise.all([
            Quotation.find(filter).populate("client", "name").populate("convertedContract", "number").sort({ issueDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Quotation.countDocuments(filter),
        ]);
        res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
});

quotationsRouter.get("/:id/pdf", requirePermission("finance:read"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid quotation ID.");
        const quotation = await Quotation.findById(req.params.id).populate(
            "client",
            "name email phone billingAddress gstin pan",
        ).lean();
        if (!quotation)
            throw new HttpError(404, "Quotation not found.");
        const lines = quotation.items.map((item, index) =>
            `${index + 1}. ${item.description} — ${item.quantity} ${item.unit} x ${formatPdfMoney(item.ratePaise)}; tax ${formatPdfMoney(item.taxPaise)}; total ${formatPdfMoney(item.totalPaise)}`,
        );
        const buffer = await createPdfBuffer({
            title: `Quotation ${quotation.number}`,
            subtitle: `${quotation.title} | Status: ${quotation.status}`,
            sections: [
                { title: "Prepared for", lines: [quotation.client?.name, quotation.client?.email, quotation.client?.phone, quotation.client?.billingAddress, quotation.client?.gstin ? `GSTIN: ${quotation.client.gstin}` : null].filter(Boolean) },
                { title: "Validity", lines: [`Issue date: ${quotation.issueDate.toISOString().slice(0, 10)}`, `Valid until: ${quotation.validUntil.toISOString().slice(0, 10)}`] },
                { title: "Items", lines },
                { title: "Totals", lines: [`Subtotal: ${formatPdfMoney(quotation.subtotalPaise)}`, `Discount: ${formatPdfMoney(quotation.discountPaise)}`, `Tax: ${formatPdfMoney(quotation.taxPaise)}`, `Total: ${formatPdfMoney(quotation.totalPaise)}`] },
                ...(quotation.terms ? [{ title: "Terms", lines: [quotation.terms] }] : []),
            ],
        });
        res.type("application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${quotation.number}.pdf"`);
        res.send(buffer);
    } catch (error) { next(error); }
});

quotationsRouter.post("/", requirePermission("finance:write"), async (req, res, next) => {
    try {
        const input = quotationInput.parse(req.body);
        if (input.validUntil < input.issueDate)
            throw new HttpError(400, "Quotation validity cannot end before its issue date.");
        if (!await Client.exists({ _id: input.client, archivedAt: null }))
            throw new HttpError(404, "Client not found.");
        for (const line of input.items) {
            if (line.service && !await Service.exists({ _id: line.service }))
                throw new HttpError(404, "A selected service was not found.");
        }
        const items = input.items.map((line) => ({ ...line, ...calculateInvoiceItem(line) }));
        const totals = calculateInvoiceTotals(items);
        const item = await Quotation.create({ ...input, number: newDocumentNumber("QUO"), items, ...totals, createdBy: req.user.id });
        res.status(201).json({ item });
    } catch (error) { next(error); }
});

quotationsRouter.patch("/:id/status", requirePermission("finance:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid quotation ID.");
        const { status } = z.object({ status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]) }).parse(req.body);
        const item = await Quotation.findOneAndUpdate(
            { _id: req.params.id, status: { $ne: "converted" } },
            { $set: { status } },
            { new: true, runValidators: true },
        );
        if (!item)
            throw new HttpError(404, "Quotation not found or already converted.");
        res.json({ item });
    } catch (error) { next(error); }
});

quotationsRouter.post("/:id/convert", requirePermission("finance:write"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id))
            throw new HttpError(400, "Invalid quotation ID.");
        const { startDate, endDate, billingFrequency, paymentDueDays } = z.object({
            startDate: z.coerce.date(),
            endDate: z.coerce.date().optional(),
            billingFrequency: z.enum(["monthly", "quarterly", "annually", "custom", "one_time"]).default("monthly"),
            paymentDueDays: z.number().int().min(0).max(365).default(15),
        }).parse(req.body);
        if (endDate && endDate < startDate)
            throw new HttpError(400, "Contract end date cannot be before its start date.");
        const quotation = await Quotation.findOne({ _id: req.params.id, status: "accepted" });
        if (!quotation)
            throw new HttpError(409, "Only accepted, unconverted quotations can become contracts.");
        const contract = await Contract.create({
            number: newDocumentNumber("CON"),
            client: quotation.client,
            title: quotation.title,
            startDate,
            endDate,
            billingFrequency,
            paymentDueDays,
            status: "draft",
            terms: quotation.terms,
            items: quotation.items.map((line) => ({
                service: line.service,
                description: line.description,
                quantity: line.quantity,
                unit: line.unit,
                ratePaise: line.ratePaise,
                includedQuantity: line.quantity,
                additionalUnitRatePaise: line.ratePaise,
                billingFrequency,
                taxRateBasisPoints: line.taxRateBasisPoints,
                recurring: billingFrequency !== "one_time",
            })),
            createdBy: req.user.id,
        });
        const updated = await Quotation.findOneAndUpdate(
            { _id: quotation._id, status: "accepted" },
            { $set: { status: "converted", convertedContract: contract._id } },
            { new: true },
        );
        if (!updated) {
            await Contract.deleteOne({ _id: contract._id });
            throw new HttpError(409, "Quotation was converted by another request. Refresh and retry.");
        }
        res.status(201).json({ quotation: updated, contract });
    } catch (error) { next(error); }
});
