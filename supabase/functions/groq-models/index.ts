Deno.serve(async () => {
  const r = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}` },
  });
  const j = await r.json();
  return new Response(JSON.stringify({ status: r.status, ids: (j.data ?? []).map((m: any) => m.id) }), {
    headers: { "Content-Type": "application/json" },
  });
});
