import { logger } from "../config/logger.js";
import { HttpError } from "../utils/http-error.js";
export const errorHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
    }
    if (error?.name === "ValidationError") {
        res.status(400).json({ error: "The submitted data is invalid." });
        return;
    }
    if (error?.name === "ZodError") {
        res.status(400).json({
            error: "The submitted data is invalid.",
            details: error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
        return;
    }
    if (error?.name === "MulterError") {
        const tooLarge = error.code === "LIMIT_FILE_SIZE";
        res.status(tooLarge ? 413 : 400).json({
            error: tooLarge ? "The selected file exceeds the configured upload size limit." : "The file upload request is invalid.",
        });
        return;
    }
    if (error?.code === 11000) {
        res.status(409).json({ error: "A record with that unique value already exists." });
        return;
    }
    logger.error({ err: error }, "Unhandled request error");
    res.status(500).json({ error: "An unexpected server error occurred." });
};
