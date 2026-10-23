import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthService } from './strategies/jwt/jwt.service';
import { JwtStrategy } from './strategies/jwt/jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: 86400,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthService, JwtStrategy],
  exports: [AuthService, JwtAuthService, JwtModule],
})
export class AuthModule {}