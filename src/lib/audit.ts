import { prisma } from "./prisma";

interface LogParams {
  userId?: number;
  userEmail?: string;
  action: string;
  target: string;
  targetId?: string;
  detail?: string;
}

export async function writeAuditLog(params: LogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        userEmail: params.userEmail ?? "",
        action: params.action,
        target: params.target,
        targetId: params.targetId ?? "",
        detail: params.detail ?? "",
      },
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
