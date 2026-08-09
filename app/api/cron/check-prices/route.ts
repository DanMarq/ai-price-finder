import { NextResponse } from "next/server"
import { runPriceCheckJob } from "@/lib/jobs/priceCheckJob"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null

  if (!expected || authHeader !== expected) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const result = await runPriceCheckJob({ timeBudgetMs: 50_000 })
  return NextResponse.json(result)
}