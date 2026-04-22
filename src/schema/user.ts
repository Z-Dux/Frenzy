import { defineEntity, type InferEntity, p } from '@mikro-orm/core';
import { BaseSchema } from './base';

export const UserSchema = defineEntity({
  name: 'User',
  properties: {
    //id: p.integer().primary(),
    fullName: p.string(),
    email: p.string(),
    password: p.string(),
    bio: p.text().default(''),
  },
  extends: BaseSchema
});

export type IUser = InferEntity<typeof UserSchema>;