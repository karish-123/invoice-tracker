import { FieldReportApprovalStatus, FieldReportRemark, FieldReportStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { addMasterOne } from './checkoutService';

const ORDER_STATUSES: FieldReportStatus[] = [
  FieldReportStatus.ORDER_DONE,
  FieldReportStatus.PAYMENT_DONE,
  FieldReportStatus.ORDER_PAYMENT_DONE,
];

const fieldReportInclude = {
  route:         { select: { id: true, routeNumber: true } },
  shop:          { select: { id: true, name: true } },
  executive:     { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
  reviewedByUser:{ select: { id: true, name: true } },
} as const;

export async function createFieldReport(data: {
  routeId:      string;
  shopId?:      string;
  newShopName?: string;
  isNewShop?:   boolean;
  status:       FieldReportStatus;
  apprValue?:   number;
  remark:       FieldReportRemark;
  customRemark?: string;
  orderTakenBy: string;
  visitDate:    string;
  executiveId:  string;
  createdByUserId: string;
}) {
  return prisma.fieldReport.create({
    data: {
      routeId:         data.routeId,
      shopId:          data.shopId ?? null,
      newShopName:     data.newShopName ?? null,
      isNewShop:       data.isNewShop ?? false,
      status:          data.status,
      apprValue:       data.apprValue ?? null,
      remark:          data.remark,
      customRemark:    data.customRemark ?? null,
      orderTakenBy:    data.orderTakenBy,
      visitDate:       new Date(data.visitDate),
      executiveId:     data.executiveId,
      createdByUserId: data.createdByUserId,
    },
    include: fieldReportInclude,
  });
}

export async function listFieldReports(filters: {
  executiveId?:    string;
  routeId?:        string;
  approvalStatus?: FieldReportApprovalStatus;
}) {
  return prisma.fieldReport.findMany({
    where: {
      ...(filters.executiveId    ? { executiveId:    filters.executiveId }    : {}),
      ...(filters.routeId        ? { routeId:        filters.routeId }        : {}),
      ...(filters.approvalStatus ? { approvalStatus: filters.approvalStatus } : {}),
    },
    include:  fieldReportInclude,
    orderBy:  { createdAt: 'desc' },
  });
}

export async function getFieldReport(id: string) {
  return prisma.fieldReport.findUnique({
    where:   { id },
    include: fieldReportInclude,
  });
}

export async function approveFieldReport(
  id:              string,
  reviewerId:      string,
  invoices:        { invoiceNumber: string; invoiceAmount?: number }[],
  reviewRemark:    string | undefined,
) {
  const report = await prisma.fieldReport.findUnique({ where: { id } });
  if (!report) throw new Error('Field report not found');
  if (report.approvalStatus !== FieldReportApprovalStatus.PENDING) {
    throw new Error(`Cannot approve a report with status ${report.approvalStatus}`);
  }

  const now = new Date();
  const checkoutResults: { invoiceNumber: string; success: boolean; checkoutId?: string; error?: string }[] = [];

  await prisma.$transaction(async (tx) => {
    // If new shop (isNewShop flag or legacy NEW_SHOP status) and no shopId yet, create the shop and link it
    if ((report.isNewShop || report.status === FieldReportStatus.NEW_SHOP) && !report.shopId && report.newShopName) {
      const shop = await tx.shop.upsert({
        where: { routeId_name: { routeId: report.routeId, name: report.newShopName } },
        update: { isActive: true },
        create: { routeId: report.routeId, name: report.newShopName },
      });
      await tx.fieldReport.update({ where: { id }, data: { shopId: shop.id, newShopName: null } });
    }

    // If order/payment status, create pending master invoice(s)
    if (ORDER_STATUSES.includes(report.status)) {
      for (const inv of invoices) {
        const result = await addMasterOne(
          tx, inv.invoiceNumber, report.routeId, now, reviewerId, id,
          undefined, undefined, inv.invoiceAmount,
        );
        checkoutResults.push(result);
      }
    }

    // Mark approved
    await tx.fieldReport.update({
      where: { id },
      data: {
        approvalStatus:   FieldReportApprovalStatus.APPROVED,
        reviewedByUserId: reviewerId,
        reviewedAt:       now,
        reviewRemark:     reviewRemark ?? null,
      },
    });
  });

  const updated = await prisma.fieldReport.findUnique({ where: { id }, include: fieldReportInclude });
  return { fieldReport: updated, results: checkoutResults };
}

export async function updateFieldReport(
  id:   string,
  data: {
    routeId?:      string;
    shopId?:       string | null;
    newShopName?:  string | null;
    isNewShop?:    boolean;
    status?:       FieldReportStatus;
    apprValue?:    number | null;
    remark?:       FieldReportRemark;
    customRemark?: string | null;
    orderTakenBy?: string;
    visitDate?:    string;
  },
) {
  const report = await prisma.fieldReport.findUnique({ where: { id } });
  if (!report) throw new Error('Field report not found');
  if (report.approvalStatus !== FieldReportApprovalStatus.PENDING) {
    throw new Error('Can only edit a PENDING field report');
  }

  // If shopId is supplied, clear newShopName (mutually exclusive)
  const newShopName = data.shopId != null ? null : data.newShopName;

  return prisma.fieldReport.update({
    where: { id },
    data: {
      ...(data.routeId      !== undefined && { routeId:      data.routeId }),
      ...(data.shopId       !== undefined && { shopId:       data.shopId }),
      ...(newShopName       !== undefined && { newShopName }),
      ...(data.isNewShop    !== undefined && { isNewShop:    data.isNewShop }),
      ...(data.status       !== undefined && { status:       data.status }),
      ...(data.apprValue    !== undefined && { apprValue:    data.apprValue }),
      ...(data.remark       !== undefined && { remark:       data.remark }),
      ...(data.customRemark !== undefined && { customRemark: data.customRemark }),
      ...(data.orderTakenBy !== undefined && { orderTakenBy: data.orderTakenBy }),
      ...(data.visitDate    !== undefined && { visitDate:    new Date(data.visitDate) }),
    },
    include: fieldReportInclude,
  });
}

export async function rejectFieldReport(
  id:           string,
  reviewerId:   string,
  reviewRemark: string,
) {
  const report = await prisma.fieldReport.findUnique({ where: { id } });
  if (!report) throw new Error('Field report not found');
  if (report.approvalStatus !== FieldReportApprovalStatus.PENDING) {
    throw new Error(`Cannot reject a report with status ${report.approvalStatus}`);
  }

  return prisma.fieldReport.update({
    where: { id },
    data: {
      approvalStatus:   FieldReportApprovalStatus.REJECTED,
      reviewedByUserId: reviewerId,
      reviewedAt:       new Date(),
      reviewRemark,
    },
    include: fieldReportInclude,
  });
}
