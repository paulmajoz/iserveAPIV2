import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { SchoolsModule } from './schools/schools.module';
import { EventTypesModule } from './event-types/event-types.module';
import { EventCategoriesModule } from './event-categories/event-categories.module';
import { EventsModule } from './events/events.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LegacyModule } from './legacy/legacy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.dev',
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('database'),
      }),
    }),
    SchoolsModule,
    EventTypesModule,
    EventCategoriesModule,
    EventsModule,
    AttendanceModule,
    LegacyModule,
  ],
})
export class AppModule {}
