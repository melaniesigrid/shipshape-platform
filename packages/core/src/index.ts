/**
 * @shipshape/core — the domain, with no I/O in it.
 *
 * Everything the product knows how to reason about lives here: what a rubric
 * is, how a project scores against one, how cards order themselves, and how the
 * board and the rubric keep each other honest. The database package and the web
 * app both depend on this; it depends on nothing.
 */

export * from "./types.ts";
export * from "./position.ts";
export * from "./rubric.ts";
export * from "./board.ts";
export * from "./templates.ts";
