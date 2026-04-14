import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { QrModule } from '../qr/qr.module';

@Module({
  imports: [QrModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
