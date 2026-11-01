import { Router } from "express";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { Client } from "../models/Client.js";
import { Contract } from "../models/Contract.js";
import { Expense } from "../models/Expense.js";
import { Invoice } from "../models/Invoice.js";
import { Payment } from "../models/Payment.js";
import { ProductionTask } from "../models/ProductionTask.js";
import { Reel } from "../models/Reel.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate, requirePermission("dashboard:read"));

dashboardRouter.get("/summary", async (req, res, next) => {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [clients, activeClients, newClients, activeContracts, reels, completedReels, pendingReels, overdueReels, overdueTasks, pendingApprovals] = await Promise.all([
            Client.countDocuments({ archivedAt: null }),
            Client.countDocuments({ archivedAt: null, status: "active" }),
            Client.countDocuments({ archivedAt: null, createdAt: { $gte: monthStart } }),
            Contract.countDocuments({ status: "active" }),
            Reel.countDocuments({}),
            Reel.countDocuments({ status: { $in: ["completed", "delivered", "published"] } }),
            Reel.countDocuments({ status: { $nin: ["completed", "delivered", "published", "cancelled"] } }),
            Reel.countDocuments({ finalDeadline: { $lt: now }, status: { $nin: ["completed", "delivered", "published", "cancelled"] } }),
            ProductionTask.countDocuments({ deadline: { $lt: now }, status: { $nin: ["completed", "cancelled"] } }),
            Reel.countDocuments({ status: "client_review" }),
        ]);
        const summary = {
            clients,
            activeClients,
            newClients,
            activeContracts,
            reels,
            completedReels,
            pendingReels,
            overdueReels,
            overdueTasks,
            pendingApprovals,
        };
        if (req.user.permissions.includes("finance:read")) {
            const [contractedRevenue, invoicedRevenue, collectedRevenue, outstanding, overdueInvoices, monthlyExpenses] = await Promise.all([
                Contract.aggregate([{ $match: { status: "active" } }, { $unwind: "$items" }, { $group: { _id: null, value: { $sum: { $multiply: ["$items.quantity", "$items.ratePaise"] } } } }]),
                Invoice.aggregate([{ $match: { issueDate: { $gte: monthStart }, status: { $ne: "cancelled" } } }, { $group: { _id: null, value: { $sum: "$totalPaise" } } }]),
                Payment.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: null, value: { $sum: "$amountPaise" } } }]),
                Invoice.aggregate([{ $match: { amountDuePaise: { $gt: 0 }, status: { $in: ["issued", "sent", "partially_paid", "overdue"] } } }, { $group: { _id: null, value: { $sum: "$amountDuePaise" } } }]),
                Invoice.countDocuments({ dueDate: { $lt: now }, amountDuePaise: { $gt: 0 }, status: { $ne: "cancelled" } }),
                Expense.aggregate([{ $match: { date: { $gte: monthStart }, archivedAt: null } }, { $group: { _id: null, value: { $sum: "$amountPaise" } } }]),
            ]);
            Object.assign(summary, {
                contractedRevenuePaise: contractedRevenue[0]?.value || 0,
                invoicedRevenuePaise: invoicedRevenue[0]?.value || 0,
                collectedRevenuePaise: collectedRevenue[0]?.value || 0,
                outstandingPaise: outstanding[0]?.value || 0,
                overdueInvoices,
                monthlyExpensesPaise: monthlyExpenses[0]?.value || 0,
            });
        }
        res.json(summary);
    } catch (error) { next(error); }
});
