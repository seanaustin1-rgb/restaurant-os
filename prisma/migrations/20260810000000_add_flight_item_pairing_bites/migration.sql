-- Per-pour internal small-bite accompaniment (staff prep sheet only, non-guest).
ALTER TABLE "SpiritFlightItem" ADD COLUMN "pairingBites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
