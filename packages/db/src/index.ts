/**
 * @shipshape/db — schema, the connection, and every tenant-scoped query.
 *
 * The rule this package exists to enforce: no ambient tenant. Every exported
 * query takes a `tenantId` as its first argument, so forgetting to scope one is
 * a type error at the call site rather than a support incident later.
 */

export * from "./schema.ts";
export * from "./client.ts";
export * from "./queries.ts";
