import { ApprovalStatus } from "@prisma/client";

export type RefundApprovalAction = "approve" | "reject";

/** PENDING refunds may be posted or rejected. Posted/rejected rows are final. */
export function nextRefundStatus(
  current: ApprovalStatus | string,
  action: RefundApprovalAction
): ApprovalStatus | null {
  if (current !== ApprovalStatus.PENDING && current !== "PENDING") return null;
  if (action === "approve") return ApprovalStatus.POSTED;
  if (action === "reject") return ApprovalStatus.REJECTED;
  return null;
}
