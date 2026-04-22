import { MikroORM } from '@mikro-orm/postgresql';
import config from '../mikro-orm.config.js';

export const orm = await MikroORM.init(config);