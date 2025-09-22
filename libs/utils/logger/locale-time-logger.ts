import { ConsoleLogger } from '@nestjs/common';

export class LocalTimeLogger extends ConsoleLogger {
  getTimestamp(): string {
    return new Date().toLocaleString('hy-AM');
  }
}
