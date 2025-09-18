import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientController } from './clients.controller';
import { ClientService } from './clients.service';

@Module({
  imports: [MikroOrmModule.forFeature([]), ConfigModule.forRoot()],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
