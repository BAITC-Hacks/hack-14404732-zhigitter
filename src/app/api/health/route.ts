export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      app: "komplekt-ai",
      phase: 3,
      integrations: {
        catalog: "implemented",
        ai: process.env.OPENAI_API_KEY ? "configured" : "missing_key",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
