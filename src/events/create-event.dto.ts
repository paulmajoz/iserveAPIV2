import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CaptureOptionsDto {
  @IsBoolean() @IsOptional() hasGeolocate?: boolean;
  @IsBoolean() @IsOptional() hasDescription?: boolean;
  @IsBoolean() @IsOptional() hasReflection?: boolean;
}

export class CreateEventDto {
  @ApiProperty() @IsString() eventName: string;
  @ApiProperty() @IsString() school: string;
  @ApiProperty() @IsString() teacher: string;
  @ApiProperty() @IsString() teacherEmail: string;

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

  @ApiProperty({ default: false }) @IsBoolean() @IsOptional() pointsEnabled?: boolean;
  @ApiProperty({ default: 0 }) @IsNumber() @IsOptional() pointsValue?: number;

  @ApiProperty({ required: false }) @IsOptional() captureOptions?: CaptureOptionsDto;
}
