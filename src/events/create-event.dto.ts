import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CaptureOptionsDto {
  @IsBoolean() @IsOptional() hasGeolocate?: boolean;
  @IsBoolean() @IsOptional() hasDescription?: boolean;
  @IsBoolean() @IsOptional() hasReflection?: boolean;
}

export class GeoTargetDto {
  @IsNumber() lat: number;
  @IsNumber() lon: number;
  @IsNumber() radiusMeters: number;
  @IsString() @IsOptional() label?: string;
}

export class CreateEventDto {
  @ApiProperty() @IsString() eventName: string;
  @ApiProperty() @IsString() school: string;
  @ApiProperty() @IsString() teacher: string;
  @ApiProperty() @IsString() teacherEmail: string;

  /** School-defined department / category (plain strings sourced from school.departments / categories). */
  @ApiProperty({ required: false }) @IsString() @IsOptional() department?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() category?: string;

  /** Legacy ObjectId refs — kept for backward compatibility with migrated V1 events. */
  @ApiProperty({ required: false }) @IsString() @IsOptional() eventTypeId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() eventCategoryId?: string;

  @ApiProperty({ enum: ['in-out', 'once-off'], default: 'once-off' })
  @IsEnum(['in-out', 'once-off']) @IsOptional()
  qrMode?: 'in-out' | 'once-off';

  @ApiProperty({ enum: ['in-out', 'fixed', 'volume', 'disabled'], default: 'in-out' })
  @IsEnum(['in-out', 'fixed', 'volume', 'disabled']) @IsOptional()
  hourMode?: 'in-out' | 'fixed' | 'volume' | 'disabled';

  @ApiProperty({ required: false }) @IsNumber() @IsOptional() fixedHours?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() volumeUnitName?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() volumeConversion?: number;

  /** Points calculation mode. */
  @ApiProperty({ enum: ['disabled', 'in-out', 'fixed', 'volume'], default: 'disabled' })
  @IsEnum(['disabled', 'in-out', 'fixed', 'volume']) @IsOptional()
  pointsMode?: 'disabled' | 'in-out' | 'fixed' | 'volume';

  @ApiProperty({ default: false }) @IsBoolean() @IsOptional() pointsEnabled?: boolean;
  @ApiProperty({ default: 0 }) @IsNumber() @IsOptional() pointsValue?: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() pointsConversion?: number;

  @ApiProperty({ required: false }) @IsOptional() captureOptions?: CaptureOptionsDto;

  /** Geofence target — only meaningful when captureOptions.hasGeolocate is true. */
  @ApiProperty({ required: false }) @IsOptional() geoTarget?: GeoTargetDto | null;
}
