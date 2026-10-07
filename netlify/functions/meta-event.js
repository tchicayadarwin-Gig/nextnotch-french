const crypto = require("crypto");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const { eventName, eventId, sourceUrl, fbp, fbc } =
    JSON.parse(event.body || "{}");
  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: sourceUrl,
        user_data: {
          client_ip_address: event.headers["x-nf-client-connection-ip"],
          client_user_agent: event.headers["user-agent"],
          fbp: fbp,
          fbc: fbc,
        },
      },
    ],
  };
  const url =
    "https://graph.facebook.com/" +
    process.env.META_GRAPH_VERSION +
    "/" +
    process.env.META_PIXEL_ID +
    "/events?access_token=" +
    process.env.META_CAPI_TOKEN;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { statusCode: res.status, body: await res.text() };
};