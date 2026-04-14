import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitAttendanceDto {
  @ApiProperty() @IsString() eventId: string;
  @ApiProperty() @IsString() studentEmail: string;

  @ApiProperty({ enum: ['in', 'out'] })
  @IsEnum(['in', 'out'])
  direction: 'in' | 'out';

  @ApiProperty({ required: false }) @IsString() @IsOptional() studentFirstName?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentLastName?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentGrade?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() studentClass?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() schoolId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() locationIn?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() locationOut?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() reflection?: string;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() unitAmount?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() teacherEmail?: string;
}
