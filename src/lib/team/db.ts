import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TEAM_RELATIONS = new Map(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.name.startsWith("Team"))
    .map((model) => [
      model.name,
      new Set(model.fields.filter((field) => field.kind === "object").map((field) => field.name)),
    ]),
);

const READ_OPERATIONS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow",
  "findMany", "count", "aggregate", "groupBy",
]);
const WHERE_AND_DATA_OPERATIONS = new Set(["update", "updateMany"]);
const WHERE_ONLY_OPERATIONS = new Set(["delete", "deleteMany"]);

// Nested relation writes bypass query extensions. Use scalar foreign keys instead;
// the composite tenant foreign keys in the migration validate their targets.
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Team Hub ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function rejectTenantOverride(value: unknown, restaurantId: string): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => rejectTenantOverride(item, restaurantId));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key === "restaurantId" && nested !== restaurantId) {
      throw new Error("Team Hub restaurantId override rejected");
    }
    rejectTenantOverride(nested, restaurantId);
  }
}

function scopedWhere(value: unknown, restaurantId: string): Record<string, unknown> {
  if (value !== undefined) rejectTenantOverride(value, restaurantId);
  return { ...(value === undefined ? {} : record(value, "where")), restaurantId };
}

function scopedData(
  value: unknown,
  restaurantId: string,
  relationFields: Set<string>,
): Record<string, unknown> {
  const data = record(value, "data");
  if ("restaurantId" in data && data.restaurantId !== restaurantId) {
    throw new Error("Team Hub restaurantId override rejected");
  }
  for (const key of Object.keys(data)) {
    if (relationFields.has(key)) {
      throw new Error(`Team Hub nested relation write rejected: ${key}`);
    }
  }
  return { ...data, restaurantId };
}

/** Pure query guard shared by the Prisma extension and its isolation tests. */
export function scopeTeamQuery(
  model: string | undefined,
  operation: string,
  value: unknown,
  restaurantId: string,
): unknown {
  if (typeof restaurantId !== "string" || !restaurantId.trim()) {
    throw new Error("Team Hub requires an explicit restaurantId");
  }
  if (!model?.startsWith("Team")) return value;
  const relationFields = TEAM_RELATIONS.get(model);
  if (!relationFields) throw new Error(`Unregistered Team Hub model: ${model}`);

  const args = record(value, "query arguments");
  if (READ_OPERATIONS.has(operation) || WHERE_ONLY_OPERATIONS.has(operation)) {
    return { ...args, where: scopedWhere(args.where, restaurantId) };
  }
  if (WHERE_AND_DATA_OPERATIONS.has(operation)) {
    return {
      ...args,
      where: scopedWhere(args.where, restaurantId),
      data: scopedData(args.data, restaurantId, relationFields),
    };
  }
  if (operation === "upsert") {
    return {
      ...args,
      where: scopedWhere(args.where, restaurantId),
      create: scopedData(args.create, restaurantId, relationFields),
      update: scopedData(args.update, restaurantId, relationFields),
    };
  }
  if (operation === "create") {
    return { ...args, data: scopedData(args.data, restaurantId, relationFields) };
  }
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const data = args.data;
    return {
      ...args,
      data: Array.isArray(data)
        ? data.map((row) => scopedData(row, restaurantId, relationFields))
        : scopedData(data, restaurantId, relationFields),
    };
  }

  // A new Prisma operation must be reviewed before it can touch Team records.
  throw new Error(`Unsupported Team Hub operation: ${operation}`);
}

/** All Team Hub model operations must start from this tenant-bound client. */
export function teamDb(restaurantId: string) {
  if (typeof restaurantId !== "string" || !restaurantId.trim()) {
    throw new Error("Team Hub requires an explicit restaurantId");
  }
  return prisma.$extends({
    name: "teamTenantScope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeTeamQuery(model, operation, args, restaurantId) as typeof args);
        },
      },
    },
  });
}
