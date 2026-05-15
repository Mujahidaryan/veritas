import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { Strategy as HeaderStrategy } from 'passport-headerapikey';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private auth: AuthService) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(req: { body: { tenantSlug: string } }, email: string, password: string) {
    const user = await this.auth.validateUser(req.body.tenantSlug, email, password);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderStrategy as never, 'api-key') {
  constructor(private auth: AuthService) {
    super({ header: 'X-API-Key', prefix: '' }, true);
  }

  async validate(apiKey: string) {
    const key = await this.auth.validateApiKey(apiKey);
    if (!key) throw new UnauthorizedException('Invalid API key');
    return { tenantId: key.tenantId, scopes: key.scopes, apiKeyId: key.id };
  }
}
