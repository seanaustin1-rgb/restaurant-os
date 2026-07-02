import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMetricsForDay: vi.fn(),
  isToastConfigured: vi.fn(),
  getToastConfig: vi.fn(),
  prisma: {
    dailySales: { upsert: vi.fn() },
    posConnection: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    restaurant: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("./config", () => ({
  isToastConfigured: mocks.isToastConfigured,
  getToastConfig: mocks.getToastConfig,
}));
vi.mock("./analytics", () => ({
  getMetricsForDay: mocks.getMetricsForDay,
  runMetricsReport: vi.fn(),
  runMenuReport: vi.fn(),
  toBusinessDate: (date: Date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  },
}));
vi.mock("./orders", () => ({ getSalesTaxCollectedForDay: vi.fn() }));

import { syncToastDailyMetrics } from "./sync";

describe("syncToastDailyMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isToastConfigured.mockReturnValue(true);
    mocks.getToastConfig.mockReturnValue({
      hostname: "toast.example",
      restaurantGuid: "toast-guid-1",
    });
  });

  it("marks the Toast POS connection synced after writing daily metrics", async () => {
    mocks.getMetricsForDay.mockResolvedValue([
      {
        businessDate: "20260701",
        grossSalesAmount: 1200,
        netSalesAmount: 1000,
        guestCount: 44,
        ordersCount: 31,
        hourlyJobTotalPay: 280,
        hourlyJobTotalHours: 18.5,
      },
    ]);

    const result = await syncToastDailyMetrics("restaurant-1", 1, 0);

    expect(result.daysWritten).toBe(1);
    expect(mocks.prisma.dailySales.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.posConnection.updateMany).toHaveBeenCalledWith({
      where: {
        restaurantId: "restaurant-1",
        provider: "TOAST",
        externalId: "toast-guid-1",
        isActive: true,
      },
      data: { lastSyncedAt: expect.any(Date) },
    });
  });

  it("does not mark the connection synced when Toast returns no day rows", async () => {
    mocks.getMetricsForDay.mockResolvedValue([]);

    const result = await syncToastDailyMetrics("restaurant-1", 1, 0);

    expect(result.daysWritten).toBe(0);
    expect(mocks.prisma.dailySales.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.posConnection.updateMany).not.toHaveBeenCalled();
  });
});
