import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "tt-brothers",
    timestamp: new Date().toISOString(),
  });
}
