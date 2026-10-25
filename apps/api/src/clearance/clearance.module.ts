
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClearanceController } from './clearance.controller';
import { ClearanceService } from './clearance.service';

@Module({
  imports: [AuthModule],
  controllers: [ClearanceController],
  providers: [ClearanceService],
})
export class ClearanceModule {}
