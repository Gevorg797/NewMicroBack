import { Module } from '@nestjs/common';
import { DatabaseModule } from 'libs/database/src/database.module';

@Module({
  providers: [],
  controllers: [],
  exports: [],
  imports: [DatabaseModule],
})
export class AdminModule {}
