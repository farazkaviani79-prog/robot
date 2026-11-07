import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Auth } from './auth.decorators';
import { Public } from './auth.guard';
import { AuthContext } from './auth.types';
import { AuthService } from './auth.service';

class RegisterDto {
  @IsEmail({}, { message: 'ایمیل نامعتبر است' }) email!: string;
  @IsString() @MinLength(10, { message: 'رمز عبور باید حداقل ۱۰ کاراکتر باشد' }) @MaxLength(128) password!: string;
  @IsString() @IsNotEmpty({ message: 'نام را وارد کنید' }) @MaxLength(100) displayName!: string;
  @IsString() @IsNotEmpty({ message: 'نام کسب‌وکار را وارد کنید' }) @MaxLength(100) businessName!: string;
}
class LoginDto { @IsEmail({}, { message: 'ایمیل نامعتبر است' }) email!: string; @IsString() @MaxLength(128) password!: string; }
class RefreshDto { @IsString() @MaxLength(200) refreshToken!: string; }
class SwitchDto { @IsString() @MaxLength(64) tenantId!: string; }
const meta = (req: any) => ({ ip: req.ip as string, userAgent: req.headers['user-agent'] as string });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Post('register') register(@Body() b: RegisterDto, @Req() r: any) { return this.auth.register(b, meta(r)); }
  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post('login') login(@Body() b: LoginDto, @Req() r: any) { return this.auth.login(b.email, b.password, meta(r)); }
  @Public() @Throttle({ default: { limit: 20, ttl: 60_000 } }) @HttpCode(200) @Post('refresh') refresh(@Body() b: RefreshDto, @Req() r: any) { return this.auth.refresh(b.refreshToken, meta(r)); }
  @Public() @HttpCode(204) @Post('logout') async logout(@Body() b: RefreshDto) { await this.auth.logout(b.refreshToken); }
  @HttpCode(200) @Post('switch-tenant') switchTenant(@Auth() a: AuthContext, @Body() b: SwitchDto, @Req() r: any) { return this.auth.switchTenant(a.userId, b.tenantId, meta(r)); }
  @Get('me') me(@Auth() a: AuthContext) { return this.auth.me(a.userId); }
}
