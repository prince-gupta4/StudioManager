import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authenticate, requirePermission } from "../middlewares/authenticate.js";
import { BillingCycle } from "../models/BillingCycle.js";
import { Contract } from "../models/Contract.js";
import { Invoice } from "../models/Invoice.js";
import { ProductionTask } from "../models/ProductionTask.js";
import { Reel } from "../models/Reel.js";
import { HttpError } from "../utils/http-error.js";

export const calendarRouter = Router();
calendarRouter.use(authenticate, requirePermission("dashboard:read"));

calendarRouter.get("/", async (req, res, next) => {
    try {
        const now = new Date();
        const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const dates = z.object({
            from: z.coerce.date().default(defaultStart),
            to: z.coerce.date().default(defaultEnd),
        }).parse(req.query);
        if (typeof req.query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to))
            dates.to.setUTCHours(23, 59, 59, 999);
        if (dates.to < dates.from)
            throw new HttpError(400, "Calendar end date must be after its start date.");
        if (dates.to - dates.from > 366 * 24 * 60 * 60 * 1000)
            throw new HttpError(400, "Calendar date range cannot exceed one year.");
        const range = { $gte: dates.from, $lte: dates.to };
        const requests = [
            Reel.find({ plannedShootDate: range, status: { $nin: ["cancelled", "completed"] } }).populate("client", "name").select("title client plannedShootDate").lean().then((items) => items.map((item) => ({ id: item._id, kind: "shooting", date: item.plannedShootDate, title: item.title, client: item.client?.name }))),
            Reel.find({ finalDeadline: range, status: { $nin: ["cancelled", "completed", "delivered", "published"] } }).populate("client", "name").select("title client finalDeadline").lean().then((items) => items.map((item) => ({ id: item._id, kind: "delivery", date: item.finalDeadline, title: item.title, client: item.client?.name }))),
            ProductionTask.find({ deadline: range, status: { $nin: ["cancelled", "completed"] } }).populate({ path: "reel", select: "title client", populate: { path: "client", select: "name" } }).select("title deadline reel kind status").lean().then((items) => items.map((item) => ({ id: item._id, kind: item.kind, date: item.deadline, title: item.title, client: item.reel?.client?.name, detail: item.reel?.title }))),
        ];
        if (req.user.permissions.includes("contracts:read")) {
            requests.push(
                Contract.find({ endDate: range, status: "active" }).populate("client", "name").select("number title client endDate").lean().then((items) => items.map((item) => ({ id: item._id, kind: "contract_renewal", date: item.endDate, title: `${item.number} · ${item.title}`, client: item.client?.name }))),
            );
            requests.push(
                BillingCycle.find({ endDate: range }).populate("client", "name").select("client startDate endDate status").lean().then((items) => items.map((item) => ({ id: item._id, kind: "billing_cycle", date: item.endDate, title: "Billing cycle ends", client: item.client?.name, detail: item.status }))),
            );
        }
        if (req.user.permissions.includes("finance:read")) {
            requests.push(
                Invoice.find({ dueDate: range, amountDuePaise: { $gt: 0 }, status: { $nin: ["draft", "cancelled", "paid"] } }).populate("client", "name").select("number client dueDate amountDuePaise").lean().then((items) => items.map((item) => ({ id: item._id, kind: "invoice_due", date: item.dueDate, title: `${item.number} due`, client: item.client?.name, amountPaise: item.amountDuePaise }))),
            );
        }
        const eventGroups = await Promise.all(requests);
        const events = eventGroups.flat().sort((a, b) => new Date(a.date) - new Date(b.date));
        res.json({ from: dates.from, to: dates.to, events });
    } catch (error) {
        if (error instanceof mongoose.Error.CastError)
            next(new HttpError(400, "Invalid calendar query."));
        else
            next(error);
    }
});
