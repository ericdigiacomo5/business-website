import { createHash } from "crypto";
import { requireAdmin } from "@/lib/require-admin";

// Cloudinary's signature recipe: take every parameter that will be part of
// the upload request (except file, api_key, and the secret itself), sort
// them alphabetically by key, join as "key1=value1&key2=value2", append the
// API secret with no separator, then SHA-1 the whole string. Cloudinary
// redoes this same computation on their end when the upload arrives and
// rejects it if the signatures don't match — this is what proves the
// request really came from us, without ever sending the secret itself over
// the network.
function signParams(params: Record<string, string | number>, apiSecret: string): string {
    const sorted = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");

    return createHash("sha1").update(sorted + apiSecret).digest("hex");
}

export async function POST() {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        return Response.json(
            { error: "Image upload is not configured" },
            { status: 500 }
        );
    }

    // Seconds, not milliseconds — Cloudinary expects a Unix timestamp in
    // seconds and rejects a signature computed against the wrong unit.
    const timestamp = Math.floor(Date.now() / 1000);

    // folder is optional but keeps uploads organized in the Cloudinary
    // dashboard instead of dumping everything in one flat namespace — every
    // param included here must also be sent by the browser later with the
    // exact same value, or the signature check fails.
    const paramsToSign = { timestamp, folder: "nail-salon" };

    const signature = signParams(paramsToSign, apiSecret);

    return Response.json({
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder: paramsToSign.folder,
    });
}
