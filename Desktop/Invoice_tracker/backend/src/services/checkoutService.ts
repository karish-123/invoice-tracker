import { Prisma } from '@prisma/client';

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type IssueOneResult  = { invoiceNumber: string; success: boolean; checkoutId?: string; error?: string };
export type ReturnOneResult = IssueOneResult;
export type PaymentResult   = IssueOneResult;

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
    // Block re-issue if invoice has ever been paid
    const paid = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM checkouts
      WHERE invoice_number = ${invoiceNumber}
        AND payment_received = true
        AND voided = false
      LIMIT 1
    `;
    if (paid.length > 0) {
      return { invoiceNumber, success: false, error: `Invoice ${invoiceNumber} has been paid and cannot be re-issued` };
    }

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

/**
 * Mark payment received for a single invoice.
 * Auto-returns the invoice if still outstanding.
 * Once paid, the invoice cannot be re-issued.
 */
export async function markPaymentReceived(
  tx:            Tx,
  invoiceNumber: string,
  userId:        string,
): Promise<PaymentResult> {
  try {
    const rows = await tx.$queryRaw<{ id: string; in_datetime: Date | null }[]>`
      SELECT id, in_datetime FROM checkouts
      WHERE invoice_number = ${invoiceNumber}
        AND voided = false
        AND payment_received = false
      ORDER BY out_datetime DESC
      LIMIT 1
      FOR UPDATE
    `;

    if (rows.length === 0) {
      return { invoiceNumber, success: false, error: `Invoice ${invoiceNumber} not found, already paid, or voided` };
    }

    const row = rows[0];
    const now = new Date();

    await tx.checkout.update({
      where: { id: row.id },
      data: {
        paymentReceived:         true,
        paymentReceivedAt:       now,
        paymentReceivedByUserId: userId,
        // Auto-return if still outstanding
        ...(row.in_datetime === null ? { inDatetime: now, inByUserId: userId } : {}),
      },
    });

    return { invoiceNumber, success: true, checkoutId: row.id };
  } catch (err) {
    return {
      invoiceNumber,
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark payment received',
    };
  }
}
