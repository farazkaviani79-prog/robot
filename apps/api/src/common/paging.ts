import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class PageQuery {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(['asc', 'desc']) dir: 'asc' | 'desc' = 'desc';
}
export const skipTake = (p: PageQuery) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize });
export const pageResult = <T>(items: T[], total: number, p: PageQuery) => ({ items, total, page: p.page, pageSize: p.pageSize, pageCount: Math.max(1, Math.ceil(total / p.pageSize)) });
