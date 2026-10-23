import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from '../../auth.service';

@Injectable()
export class JwtAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async generateToken(user: AuthenticatedUser): Promise<string> {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles.map((userRole) => userRole.name),
    };

    return this.jwtService.signAsync(payload);
  }
}