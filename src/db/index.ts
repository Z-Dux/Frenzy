import { MikroORM } from '@mikro-orm/postgresql';
import ormConfig from './config.js';

export const orm = await MikroORM.init(ormConfig);
