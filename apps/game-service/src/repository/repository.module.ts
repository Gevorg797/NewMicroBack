import { Module } from '@nestjs/common';
import { DatabaseModule } from '@lib/database';
import { SessionManagerService } from './session-manager.service';

@Module({
  imports: [DatabaseModule],
  providers: [SessionManagerService],
  exports: [SessionManagerService],
})
export class RepositoryModule {}
