import { prisma } from '../prisma';

export async function listShops(routeId?: string, includeInactive = false) {
  return prisma.shop.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(routeId ? { routeId } : {}),
    },
    include: { route: { select: { id: true, routeNumber: true } } },
    orderBy: [{ route: { routeNumber: 'asc' } }, { name: 'asc' }],
  });
}

export async function createShop(routeId: string, name: string) {
  return prisma.shop.upsert({
    where: { routeId_name: { routeId, name } },
    update: { isActive: true },
    create: { routeId, name },
    include: { route: { select: { id: true, routeNumber: true } } },
  });
}

export async function updateShop(id: string, data: { name?: string; isActive?: boolean }) {
  return prisma.shop.update({
    where: { id },
    data,
    include: { route: { select: { id: true, routeNumber: true } } },
  });
}

export interface BulkShopRow {
  routeNumber: string;
  shopName:    string;
}

export interface BulkShopResult {
  total:             number;
  created:           number;
  skippedDuplicates: number;
  routesCreated:     number;
  errors:            { row: number; reason: string }[];
}

export async function bulkCreateShops(rows: BulkShopRow[]): Promise<BulkShopResult> {
  const errors: { row: number; reason: string }[] = [];
  const cleaned: { routeNumber: string; shopName: string; originalIndex: number }[] = [];

  rows.forEach((row, idx) => {
    const routeNumber = (row.routeNumber ?? '').trim();
    const shopName    = (row.shopName    ?? '').trim();
    if (!routeNumber || !shopName) {
      errors.push({ row: idx + 1, reason: 'Missing route_number or shop_name' });
      return;
    }
    cleaned.push({ routeNumber, shopName, originalIndex: idx + 1 });
  });

  if (cleaned.length === 0) {
    return { total: rows.length, created: 0, skippedDuplicates: 0, routesCreated: 0, errors };
  }

  const uniqueRouteNumbers = Array.from(new Set(cleaned.map(r => r.routeNumber)));

  const result = await prisma.$transaction(async (tx) => {
    // Look up existing routes
    const existingRoutes = await tx.route.findMany({
      where: { routeNumber: { in: uniqueRouteNumbers } },
      select: { id: true, routeNumber: true },
    });
    const routeMap = new Map(existingRoutes.map(r => [r.routeNumber, r.id]));

    // Auto-create missing routes
    const missingRouteNumbers = uniqueRouteNumbers.filter(rn => !routeMap.has(rn));
    let routesCreated = 0;
    if (missingRouteNumbers.length > 0) {
      const createResult = await tx.route.createMany({
        data: missingRouteNumbers.map(routeNumber => ({ routeNumber })),
        skipDuplicates: true,
      });
      routesCreated = createResult.count;
      const newRoutes = await tx.route.findMany({
        where: { routeNumber: { in: missingRouteNumbers } },
        select: { id: true, routeNumber: true },
      });
      newRoutes.forEach(r => routeMap.set(r.routeNumber, r.id));
    }

    // Build shop payload
    const shopData = cleaned.map(r => ({
      routeId: routeMap.get(r.routeNumber)!,
      name:    r.shopName,
    }));

    const shopResult = await tx.shop.createMany({
      data: shopData,
      skipDuplicates: true,
    });

    return {
      created:           shopResult.count,
      skippedDuplicates: cleaned.length - shopResult.count,
      routesCreated,
    };
  });

  return {
    total: rows.length,
    ...result,
    errors,
  };
}
