export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { path, method, body, prefer } = req.body;

  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    "Content-Type": "application/json",
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
  };
  if (prefer) headers["Prefer"] = prefer;

  const upstream = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await upstream.text();
  res.status(upstream.status).send(text || "{}");
}
