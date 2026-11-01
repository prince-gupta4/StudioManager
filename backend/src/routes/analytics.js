import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { Expense } from "../models/Expense.js";
import { Invoice } from "../models/Invoice.js";
import { Payment } from "../models/Payment.js";
import { ProductionTask } from "../models/ProductionTask.js";
import { Reel } from "../models/Reel.js";
import { HttpError } from "../utils/http-error.js";
import { createPdfBuffer, formatPdfMoney } from "../utils/pdf.js";

export const analyticsRouter = Router();
analyticsRouter.use(authenticate, requirePermission("dashboard:read"));

function csvCell(value) {
    const text = String(value ?? "");
    const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
}

analyticsRouter.get("/", async (req, res, next) => {
    try {
        const now = new Date();
        const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const dates = z.object({
            from: z.coerce.date().default(defaultFrom),
            to: z.coerce.date().default(now),
            client: z.string().refine((value) => mongoose.isValidObjectId(value), "Invalid client ID.").optional(),
        }).parse(req.query);
        if (typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to))
            dates.to.setUTCHours(23, 59, 59, 999);
        if (dates.to < dates.from || dates.to - dates.from > 5 * 366 * 24 * 60 * 60 * 1000)
            throw new HttpError(400, "Choose a valid date range of up to five years.");
        const range = { $gte: dates.from, $lte: dates.to };
        const clientId = dates.client;
        const reelFilter = { createdAt: range, ...(clientId ? { client: new mongoose.Types.ObjectId(clientId) } : {}) };
        const taskFilter = { createdAt: range };
        const [productionByStatus, taskWorkload, reelAverages] = await Promise.all([
            Reel.aggregate([{ $match: reelFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
            ProductionTask.aggregate([
                { $match: taskFilter },
                { $group: { _id: "$assignedTo", total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $lt: ["$deadline", new Date()] }, { $not: [{ $in: ["$status", ["completed", "cancelled"]] }] }] }, 1, 0] } } } },
                { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "member" } },
                { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },
                { $project: { name: { $ifNull: ["$member.name", "Unassigned"] }, total: 1, completed: 1, overdue: 1 } },
            ]),
            Reel.aggregate([{ $match: { ...reelFilter, status: { $in: ["completed", "delivered", "published"] } } }, { $group: { _id: null, count: { $sum: 1 }, averageRevisionCount: { $avg: "$revisionCount" } } }]),
        ]);
        const result = {
            from: dates.from,
            to: dates.to,
            productionByStatus,
            taskWorkload,
            production: {
                completedCount: reelAverages[0]?.count || 0,
                averageRevisions: Math.round((reelAverages[0]?.averageRevisionCount || 0) * 100) / 100,
            },
        };
        if (req.user.permissions.includes("finance:read")) {
            const filter = { issueDate: range, status: { $in: ["issued", "sent", "partially_paid", "paid", "overdue"] }, ...(clientId ? { client: new mongoose.Types.ObjectId(clientId) } : {}) };
            const [invoicesByMonth, paymentsByMonth, expensesByMonth, receivables] = await Promise.all([
                Invoice.aggregate([{ $match: filter }, { $group: { _id: { year: { $year: "$issueDate" }, month: { $month: "$issueDate" } }, amountPaise: { $sum: "$totalPaise" } } }, { $sort: { "_id.year": 1, "_id.month": 1 } }]),
                Payment.aggregate([{ $match: { date: range } }, { $lookup: { from: "invoices", localField: "invoice", foreignField: "_id", as: "invoice" } }, { $unwind: "$invoice" }, ...(clientId ? [{ $match: { "invoice.client": new mongoose.Types.ObjectId(clientId) } }] : []), { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" } }, amountPaise: { $sum: "$amountPaise" } } }, { $sort: { "_id.year": 1, "_id.month": 1 } }]),
                Expense.aggregate([{ $match: { date: range, archivedAt: null, ...(clientId ? { client: new mongoose.Types.ObjectId(clientId) } : {}) } }, { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" } }, amountPaise: { $sum: "$amountPaise" } } }, { $sort: { "_id.year": 1, "_id.month": 1 } }]),
                Invoice.aggregate([{ $match: { status: { $in: ["issued", "sent", "partially_paid", "overdue"] }, ...(clientId ? { client: new mongoose.Types.ObjectId(clientId) } : {}) } }, { $group: { _id: null, amountPaise: { $sum: "$amountDuePaise" }, overdueCount: { $sum: { $cond: [{ $lt: ["$dueDate", new Date()] }, 1, 0] } } } }]),
            ]);
            result.financial = {
                invoicedByMonth: invoicesByMonth,
                collectedByMonth: paymentsByMonth,
                expensesByMonth,
                receivablesPaise: receivables[0]?.amountPaise || 0,
                overdueInvoices: receivables[0]?.overdueCount || 0,
            };
        }
        res.json(result);
    } catch (error) { next(error); }
});

analyticsRouter.get("/export.csv", async (req, res, next) => {
    try {
        const type = z.enum(["invoices", "payments", "expenses", "production"]).parse(req.query.type);
        if (["invoices", "payments", "expenses"].includes(type) && !req.user.permissions.includes("finance:read"))
            throw new HttpError(403, "Finance permission is required for financial exports.");
        const from = req.query.from ? new Date(String(req.query.from)) : new Date(0);
        const to = req.query.to ? new Date(String(req.query.to)) : new Date();
        if (typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to))
            to.setUTCHours(23, 59, 59, 999);
        if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || to < from)
            throw new HttpError(400, "Invalid export date range.");
        if (to - from > 5 * 366 * 24 * 60 * 60 * 1000)
            throw new HttpError(400, "Export date range cannot exceed five years.");
        const range = { $gte: from, $lte: to };
        let rows;
        let header;
        if (type === "invoices") {
            const filter = { issueDate: range };
            if (await Invoice.countDocuments(filter) > 10000)
                throw new HttpError(413, "CSV export is limited to 10,000 records. Narrow the date range.");
            rows = await Invoice.find(filter).populate("client", "name").sort({ issueDate: -1 }).lean();
            header = ["invoice", "client", "issue_date", "due_date", "status", "total_paise", "paid_paise", "outstanding_paise"];
            rows = rows.map((row) => [row.number, row.client?.name, row.issueDate.toISOString(), row.dueDate.toISOString(), row.status, row.totalPaise, row.amountPaidPaise, row.amountDuePaise]);
        } else if (type === "payments") {
            const filter = { date: range };
            if (await Payment.countDocuments(filter) > 10000)
                throw new HttpError(413, "CSV export is limited to 10,000 records. Narrow the date range.");
            rows = await Payment.find(filter).populate("invoice", "number client").populate({ path: "invoice", populate: { path: "client", select: "name" } }).sort({ date: -1 }).lean();
            header = ["invoice", "client", "date", "method", "reference", "amount_paise"];
            rows = rows.map((row) => [row.invoice?.number, row.invoice?.client?.name, row.date.toISOString(), row.method, row.reference, row.amountPaise]);
        } else if (type === "expenses") {
            const filter = { date: range, archivedAt: null };
            if (await Expense.countDocuments(filter) > 10000)
                throw new HttpError(413, "CSV export is limited to 10,000 records. Narrow the date range.");
            rows = await Expense.find(filter).populate("client", "name").populate("project", "name").sort({ date: -1 }).lean();
            header = ["title", "category", "date", "client", "project", "payment_method", "amount_paise"];
            rows = rows.map((row) => [row.title, row.category, row.date.toISOString(), row.client?.name, row.project?.name, row.paymentMethod, row.amountPaise]);
        } else {
            if (!req.user.permissions.includes("production:read"))
                throw new HttpError(403, "Production permission is required for this export.");
            const filter = { createdAt: range };
            if (await Reel.countDocuments(filter) > 10000)
                throw new HttpError(413, "CSV export is limited to 10,000 records. Narrow the date range.");
            rows = await Reel.find(filter).populate("client", "name").populate("project", "name").sort({ createdAt: -1 }).lean();
            header = ["reel_id", "title", "client", "project", "status", "priority", "created_at", "deadline"];
            rows = rows.map((row) => [row.reelId, row.title, row.client?.name, row.project?.name, row.status, row.priority, row.createdAt.toISOString(), row.finalDeadline?.toISOString()]);
        }
        const content = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="reelmanager-${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(`\uFEFF${content}`);
    } catch (error) { next(error); }
});

analyticsRouter.get("/export.pdf", async (req, res, next) => {
    try {
        const type = z.enum(["invoices", "payments", "expenses", "production"]).parse(req.query.type);
        if (["invoices", "payments", "expenses"].includes(type) && !req.user.permissions.includes("finance:read"))
            throw new HttpError(403, "Finance permission is required for financial exports.");
        if (type === "production" && !req.user.permissions.includes("production:read"))
            throw new HttpError(403, "Production permission is required for this export.");
        const now = new Date();
        const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const dates = z.object({
            from: z.coerce.date().default(defaultFrom),
            to: z.coerce.date().default(now),
        }).parse(req.query);
        if (typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to))
            dates.to.setUTCHours(23, 59, 59, 999);
        if (dates.to < dates.from || dates.to - dates.from > 5 * 366 * 24 * 60 * 60 * 1000)
            throw new HttpError(400, "Choose a valid export date range of up to five years.");
        const range = { $gte: dates.from, $lte: dates.to };
        let rows;
        let headers;
        let dateField;
        let count;
        if (type === "invoices") {
            const filter = { issueDate: range };
            count = await Invoice.countDocuments(filter);
            if (count > 2500)
                throw new HttpError(413, "PDF export is limited to 2,500 records. Narrow the date range.");
            rows = await Invoice.find(filter).populate("client", "name").sort({ issueDate: -1 }).lean();
            headers = ["Invoice", "Client", "Issue date", "Due date", "Status", "Total", "Paid", "Outstanding"];
            rows = rows.map((row) => [row.number, row.client?.name, row.issueDate.toISOString().slice(0, 10), row.dueDate.toISOString().slice(0, 10), row.status, formatPdfMoney(row.totalPaise), formatPdfMoney(row.amountPaidPaise), formatPdfMoney(row.amountDuePaise)]);
            dateField = "Issue date";
        } else if (type === "payments") {
            const filter = { date: range };
            count = await Payment.countDocuments(filter);
            if (count > 2500)
                throw new HttpError(413, "PDF export is limited to 2,500 records. Narrow the date range.");
            rows = await Payment.find(filter).populate({ path: "invoice", select: "number client", populate: { path: "client", select: "name" } }).sort({ date: -1 }).lean();
            headers = ["Invoice", "Client", "Date", "Method", "Reference", "Amount"];
            rows = rows.map((row) => [row.invoice?.number, row.invoice?.client?.name, row.date.toISOString().slice(0, 10), row.method, row.reference, formatPdfMoney(row.amountPaise)]);
            dateField = "Payment date";
        } else if (type === "expenses") {
            const filter = { date: range, archivedAt: null };
            count = await Expense.countDocuments(filter);
            if (count > 2500)
                throw new HttpError(413, "PDF export is limited to 2,500 records. Narrow the date range.");
            rows = await Expense.find(filter).populate("client", "name").populate("project", "name").sort({ date: -1 }).lean();
            headers = ["Expense", "Category", "Date", "Client", "Project", "Payment method", "Amount"];
            rows = rows.map((row) => [row.title, row.category, row.date.toISOString().slice(0, 10), row.client?.name, row.project?.name, row.paymentMethod, formatPdfMoney(row.amountPaise)]);
            dateField = "Expense date";
        } else {
            const filter = { createdAt: range };
            count = await Reel.countDocuments(filter);
            if (count > 2500)
                throw new HttpError(413, "PDF export is limited to 2,500 records. Narrow the date range.");
            rows = await Reel.find(filter).populate("client", "name").populate("project", "name").sort({ createdAt: -1 }).lean();
            headers = ["Reel ID", "Title", "Client", "Project", "Status", "Priority", "Created", "Deadline"];
            rows = rows.map((row) => [row.reelId, row.title, row.client?.name, row.project?.name, row.status, row.priority, row.createdAt.toISOString().slice(0, 10), row.finalDeadline?.toISOString().slice(0, 10)]);
            dateField = "Created date";
        }
        const buffer = await createPdfBuffer({
            title: `${type[0].toUpperCase()}${type.slice(1)} report`,
            subtitle: `${dateField}: ${dates.from.toISOString().slice(0, 10)} to ${dates.to.toISOString().slice(0, 10)} | ${rows.length} records`,
            headers,
            rows,
        });
        res.type("application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="reelmanager-${type}-${dates.from.toISOString().slice(0, 10)}-to-${dates.to.toISOString().slice(0, 10)}.pdf"`);
        res.send(buffer);
    } catch (error) { next(error); }
});
