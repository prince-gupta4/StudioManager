import PDFDocument from "pdfkit";

function printable(value) {
    return String(value ?? "—")
        .normalize("NFKD")
        .replace(/[^\x20-\x7E]/g, "?")
        .replace(/\s+/g, " ")
        .trim();
}

export function formatPdfMoney(paise) {
    return `INR ${(Number(paise || 0) / 100).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function createPdfBuffer({ title, subtitle, sections = [], headers, rows }) {
    return new Promise((resolve, reject) => {
        const document = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
        const chunks = [];
        document.on("data", (chunk) => chunks.push(chunk));
        document.on("error", reject);
        document.on("end", () => resolve(Buffer.concat(chunks)));

        const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
        const bottom = document.page.height - document.page.margins.bottom;
        const ensureSpace = (height) => {
            if (document.y + height > bottom)
                document.addPage();
        };

        document.fillColor("#5a3ec7").font("Helvetica-Bold").fontSize(10).text("REELMANAGER");
        document.moveDown(0.7);
        document.fillColor("#20202b").fontSize(20).text(printable(title));
        if (subtitle) {
            document.moveDown(0.3);
            document.fillColor("#777783").font("Helvetica").fontSize(9).text(printable(subtitle));
        }
        document.moveDown(1);

        for (const section of sections) {
            ensureSpace(45);
            document.fillColor("#5a3ec7").font("Helvetica-Bold").fontSize(11).text(printable(section.title));
            document.moveDown(0.35);
            for (const line of section.lines) {
                const text = printable(line);
                ensureSpace(document.heightOfString(text, { width: pageWidth }) + 8);
                document.fillColor("#383844").font("Helvetica").fontSize(9).text(text, { width: pageWidth, lineGap: 2 });
            }
            document.moveDown(0.7);
        }

        if (headers && rows) {
            for (let index = 0; index < rows.length; index += 1) {
                const row = rows[index];
                const lines = headers.map((header, column) => `${printable(header)}: ${printable(row[column])}`);
                const content = lines.join("  |  ");
                const height = document.heightOfString(content, { width: pageWidth, fontSize: 8, lineGap: 2 }) + 12;
                ensureSpace(height);
                document.fillColor("#383844").font("Helvetica").fontSize(8).text(content, {
                    width: pageWidth,
                    lineGap: 2,
                });
                document.moveDown(0.45);
                document.strokeColor("#e6e6ec").moveTo(document.page.margins.left, document.y).lineTo(document.page.width - document.page.margins.right, document.y).stroke();
                document.moveDown(0.4);
            }
        }

        if (sections.length === 0 && (!rows || rows.length === 0))
            document.fillColor("#777783").font("Helvetica").fontSize(10).text("No records were found for this report.");
        document.end();
    });
}
