import { Prisma } from '@prisma/client';

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type IssueOneResult  = { invoiceNumber: string; success: boolean; checkoutId?: string; error?: string };
export type ReturnOneResult = IssueOneResult;

/**
 * Issue a single invoice inside an existing Prisma transaction.
 * Uses SELECT … FOR UPDATE to prevent concurrent double-checkout.
 */
export async function issueOne(
  tx:            Tx,
  invoiceNumber: string,
  executiveId:   string,
  routeId:       string,
  outAt:         Date,
  userId:        string,
): Promise<IssueOneResult> {
  try {
    const existing = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM checkouts
      WHERE invoice_number = ${invoiceNumber}
        AND in_datetime IS NULL
        AND voided = false
      FOR UPDATE
    `;

    if (existing.length > 0) {
      return { invoiceNumber, success: false, error: `Invoice ${invoiceNumber} is already checked out` };
    }

    const checkout = await tx.checkout.create({
      data: { invoiceNumber, executiveId, routeId, outDatetime: outAt, outByUserId: userId },
    });

    return { invoiceNumber, success: true, checkoutId: checkout.id };
  } catch (err) {
    return {
      invoiceNumber,
      success: false,
      error: err instanceof Error ? err.message : 'Failed to issue invoice',
    };
  }
}

/**
 * Return a single invoice inside an existing Prisma transaction.
 */
export async function returnOne(
  tx:            Tx,
  invoiceNumber: string,
  inAt:          Date,
  userId:        string,
): Promise<ReturnOneResult> {
  try {
    const active = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM checkouts
      WHERE invoice_number = ${invoiceNumber}
        AND in_datetime IS NULL
        AND voided = false
      FOR UPDATE
    `;

    if (active.length === 0) {
      return { invoiceNumber, success: false, error: `Invoice ${invoiceNumber} has no active checkout` };
    }

    const checkout = await tx.checkout.update({
      where: { id: active[0].id },
      data:  { inDatetime: inAt, inByUserId: userId },
    });

    return { invoiceNumber, success: true, checkoutId: checkout.id };
  } catch (err) {
    return {
      invoiceNumber,
      success: false,
      error: err instanceof Error ? err.message : 'Failed to return invoice',
    };
  }
}
