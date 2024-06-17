import { expect } from 'chai';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import NetworkCore from '../src/networking/NetworkCore';
import Auth from '../src/Auth';
import { describe, it, before } from 'mocha';

let app: FastifyInstance;
  describe('Auth Module', () => {
    it('should return 200 for valid login', async () => {
      const res = await request(NetworkCore.fastifyApp)
        .get('/auth/login')
        .query({ email: 'test@example.com' });
  
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('token');
    });

    it('should return 403 for invalid token on logout', async () => {
      const res = await request(NetworkCore.fastifyApp)
        .get('/auth/logout')
        .query({ token: 'invalid_token' });

      expect(res.status).to.equal(403);
    });

    it('should return 403 for invalid token on token validation', async () => {
      const res = await request(NetworkCore.fastifyApp)
        .get('/auth/token/validate')
        .query({ token: 'invalid_token' });

      expect(res.status).to.equal(403);
    });

    it('should return 403 for invalid token on token renewal', async () => {
      const res = await request(NetworkCore.fastifyApp)
        .get('/auth/token/renew')
        .query({ token: 'invalid_token' });

      expect(res.status).to.equal(403);
    });

    it('should return 403 for invalid token on token activation', async () => {
      const res = await request(NetworkCore.fastifyApp)
        .get('/auth/token/activate')
        .query({ token: 'invalid_token', auth_code: '123456' });

      expect(res.status).to.equal(403);
    });

    it('should return 403 for invalid email on getting user info', async () => {
      const res = await request(NetworkCore.fastifyApp)
        .get('/auth/user/info/others')
        .query({ email: 'invalid_email@example.com', token: 'valid_token' });

      expect(res.status).to.equal(403);
    });

    it('should return 403 for invalid email on admin user info', async () => {
      const res = await request(NetworkCore.fastifyApp)
        .get('/auth/admin/user/info')
        .query({ email: 'invalid_email@example.com', password: 'valid_password' });

      expect(res.status).to.equal(403);
    });
});

