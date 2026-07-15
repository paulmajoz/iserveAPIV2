import { Module } from '@nestjs/common';
import { NinoxService } from './ninox.service';

@Module({
  providers: [NinoxService],
  exports: [NinoxService],
})
export class NinoxModule {}
