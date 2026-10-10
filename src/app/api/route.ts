import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";

export async function GET() {
  try {
    return NextResponse.json({ message: "Hello, world!" });
  } catch (error) {
    return handleApiError(error, "GET /api");
  }
}
