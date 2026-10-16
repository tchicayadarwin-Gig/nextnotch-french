const crypto = require("crypto");

// Événements autorisés : tout le reste est refusé (évite qu'un tiers
// envoie n'importe quoi à ton pixel via cette fonction publique).
const ALLOWED_EVENTS = new Set(["PageView", "ViewContent", "InitiateCheckout"]);
const ALLOWED_CUSTOM = ["content_name", "content_ids", "content_type", "value", "currency"];

const sha256 = (v) =>
  crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Bad JSON" };
  }

  const { eventName, eventId, sourceUrl, fbp, fbc, externalId, customData } = body;

  // Sans event_id ou avec un nom inconnu, la déduplication est impossible : on refuse.
  if (!ALLOWED_EVENTS.has(eventName) || !eventId) {
    return { statusCode: 400, body: "Invalid event" };
  }

  const headers = event.headers || {};
  const ip =
    headers["x-nf-client-connection-ip"] ||
    (headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    undefined;

  const userData = {
    client_ip_address: ip,
    client_user_agent: headers["user-agent"],
  };
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (externalId) userData.external_id = [sha256(externalId)];

  const custom = {};
  if (customData && typeof customData === "object") {
    ALLOWED_CUSTOM.forEach((k) => {
      if (customData[k] !== undefined) custom[k] = customData[k];
    });
  }

  const serverEvent = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website",
    event_source_url: sourceUrl,
    user_data: userData,
  };
  if (Object.keys(custom).length) serverEvent.custom_data = custom;

  const payload = { data: [serverEvent], access_token: process.env.META_CAPI_TOKEN };

  const url =
    "https://graph.facebook.com/" +
    (process.env.META_GRAPH_VERSION || "v21.0") +
    "/" +
    process.env.META_PIXEL_ID +
    "/events";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("CAPI error:", res.status, await res.text());
    return { statusCode: res.ok ? 200 : 502, body: res.ok ? "ok" : "capi_error" };
  } catch (e) {
    console.error("CAPI fetch failed:", e);
    return { statusCode: 502, body: "capi_unreachable" };
  }
};