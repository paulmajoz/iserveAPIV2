import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateAttendanceDto {
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() timeIn?: string;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() timeOut?: string;
  @ApiProperty({ required: false }) @IsNumber()     @IsOptional() hours?: number | null;
  @ApiProperty({ required: false }) @IsNumber()     @IsOptional() pointsAwarded?: number;
  @ApiProperty({ required: false }) @IsNumber()     @IsOptional() unitAmount?: number;
  @ApiProperty({ required: false }) @IsString()     @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsString()     @IsOptional() reflection?: string;
  @ApiProperty({ required: false }) @IsString()     @IsOptional() locationIn?: string;
  @ApiProperty({ required: false }) @IsString()     @IsOptional() locationOut?: string;
  @ApiProperty({ required: false }) @IsNumber()     @IsOptional() distanceMeters?: number | null;
  @ApiProperty({ required: false }) @IsBoolean()    @IsOptional() withinPerimeter?: boolean | null;
  @ApiProperty({ required: false }) @IsString()     @IsOptional() teacherEmail?: string;
}
