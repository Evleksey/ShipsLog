import config from '../config.js';
import { startApp } from './app.js';
import { createDataSource } from './data/index.js';

startApp(config, createDataSource);
