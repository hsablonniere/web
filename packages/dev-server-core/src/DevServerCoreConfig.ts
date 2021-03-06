import { Middleware } from 'koa';
import { Plugin } from './Plugin';

export interface DevServerCoreConfig {
  port: number;
  rootDir: string;
  hostname: string;
  basePath?: string;
  appIndex?: string;

  middleware: Middleware[];
  plugins: Plugin[];

  http2?: boolean;
  sslKey?: string;
  sslCert?: string;

  eventStream?: boolean;
}
