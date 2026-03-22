import { Prisma } from '@prisma/client';

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type IssueOneResult  = { invoiceNumber: string; success: boolean; checkoutId?: string; error?: string };
export type ReturnOneResult = IssueOneResult;
export type PaymentResult   = IssueOneResult;

/**
 * Add a single invoice to the master (pending) pool — no executive assigned yet.
 */
export async function addMasterOne(
  tx:            Tx,
  invoiceNumber: string,
  routeId:       string,
  addedAt:       Date,
  userId:        string,
): Promise<IssueOneResult> {
  try {
    // Block if already paid
    const paid = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM checkouts
      WHERE invoice_number = ${invoiceNumber}
        AND payment_received = true
        AND voided = false
      LIMIT 1
    `;
    if (paid.length > 0) {
      return { invoiceNumber, success: false, error: `Invoice ${invoiceNumber} has been paid and cannot be re-added` };
    }

    // Block if already has an active/pending entry
    const existing = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM checkouts
      WHERE invoice_number = ${invoiceNumber}
        AND in_datetime IS NULL
        AND voided = false
      FOR UPDATE
    `;
    if (existing.length > 0) {
      return { invoiceNumber, success: false, error: `Invoice ${invoiceNumber} is already in the system (pending or checked out)` };
    }

    const checkout = await tx.checkout.create({
      data: { invoiceNumber, routeId, outDatetime: addedAt, outByUserId: userId },
    });

    return { invoiceNumber, success: true, checkoutId: checkout.id };
  } catch (err) {
    return {
      invoiceNumber,
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add master invoice',
    };
  }
}

/**
 * Issue a single invoice inside an existing Prisma transaction.
 * If a pending checkout (no executive) exists, assigns the executive to it.
 * If routeId is provided and no pending checkout exists, creates a new one.
 * Uses SELECT … FOR UPDATE to prevent concurrent double-checkout.
 */
export async function issueOne(
  tx:            Tx,
  invoiceNumber: string,
  executiveId:   string,
  routeId:       string | undefined,
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

    // Find and lock a pending checkout (executive_id IS NULL)
    const pending = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM checkouts
      WHERE invoice_number = ${invoiceNumber}
        AND executive_id IS NULL
        AND in_datetime IS NULL
        AND voided = false
      FOR UPDATE
    `;

    if (pending.length > 0) {
      // Assign executive to the pending checkout
      const checkout = await tx.checkout.update({
        where: { id: pending[0].id },
        data:  { executiveId, outDatetime: outAt, outByUserId: userId },
      });
      return { invoiceNumber, success: true, checkoutId: checkout.id };
    }

    // No pending — check for existing active (already issued) checkout
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

    // No pending and no active — create fresh only if routeId is provided
    if (!routeId) {
      return { invoiceNumber, success: false, error: `Invoice ${invoiceNumber} not found in pending pool. Add it via Master Invoices first.` };
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
