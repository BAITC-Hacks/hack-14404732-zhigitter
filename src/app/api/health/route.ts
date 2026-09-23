export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { status: "ok", app: "komplekt-ai", phase: 1, integrations: "not_connected" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
