import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { role } = await request.json();
  if (!["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const res = NextResponse.json({ success: true, role });
  res.cookies.set("role", role, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return res;
}
