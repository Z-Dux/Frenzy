import { defineEntity, p } from "@mikro-orm/core";
import { randomUUID } from "node:crypto";

export const BaseSchema = defineEntity({
  name: "BaseEntity",
  abstract: true,
  properties: {
    _id: p
      .uuid()
      .primary()
      .onCreate(() => randomUUID()),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
    index: p.integer().autoincrement(),
  },
});
