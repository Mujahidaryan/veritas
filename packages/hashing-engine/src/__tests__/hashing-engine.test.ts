import { HashingEngine } from '../src/index';

describe('HashingEngine', () => {
  let engine: HashingEngine;

  beforeEach(() => {
    engine = new HashingEngine();
  });

  // ─── Core hashing ───────────────────────────────────────────────

  it('produces consistent SHA-256 hash for identical content', async () => {
    const buffer = Buffer.from('Hello, Veritas!');
    const r1 = await engine.hashBuffer(buffer, 'application/pdf');
    const r2 = await engine.hashBuffer(buffer, 'application/pdf');
    expect(r1.sha256).toBe(r2.sha256);
  });

  it('produces different hashes for different content', async () => {
    const r1 = await engine.hashBuffer(Buffer.from('Document A'), 'application/pdf');
    const r2 = await engine.hashBuffer(Buffer.from('Document B'), 'application/pdf');
    expect(r1.sha256).not.toBe(r2.sha256);
  });

  it('detects a single-byte change in document', async () => {
    const original = Buffer.from('Report content here');
    const tampered = Buffer.from('Report content Here'); // capital H
    const r1 = await engine.hashBuffer(original, 'image/jpeg');
    const r2 = await engine.hashBuffer(tampered, 'image/jpeg');
    expect(r1.sha256).not.toBe(r2.sha256);
  });

  it('includes file size in result', async () => {
    const buffer = Buffer.from('test content');
    const result = await engine.hashBuffer(buffer, 'application/pdf');
    expect(result.size).toBe(buffer.length);
  });

  // ─── Tenant-scoped HMAC ─────────────────────────────────────────

  it('produces different hashes for same content but different tenants', async () => {
    const buffer = Buffer.from('Shared document');
    const r1 = await engine.hashBuffer(buffer, 'application/pdf', { tenantSalt: 'tenant-A' });
    const r2 = await engine.hashBuffer(buffer, 'application/pdf', { tenantSalt: 'tenant-B' });
    expect(r1.sha256).not.toBe(r2.sha256);
  });

  // ─── Verification ───────────────────────────────────────────────

  it('verify returns true for matching hash', async () => {
    const buffer = Buffer.from('Medical report content');
    const { sha256 } = await engine.hashBuffer(buffer, 'application/pdf');
    const valid = await engine.verify(buffer, 'application/pdf', sha256);
    expect(valid).toBe(true);
  });

  it('verify returns false for tampered content', async () => {
    const original = Buffer.from('Original content');
    const { sha256 } = await engine.hashBuffer(original, 'application/pdf');
    const tampered = Buffer.from('Modified content');
    const valid = await engine.verify(tampered, 'application/pdf', sha256);
    expect(valid).toBe(false);
  });

  // ─── Metadata hashing ───────────────────────────────────────────

  it('hashMetadata is deterministic regardless of key order', () => {
    const meta1 = { type: 'degree', title: 'BSc CS', issuedTo: 'Ali' };
    const meta2 = { issuedTo: 'Ali', title: 'BSc CS', type: 'degree' };
    expect(engine.hashMetadata(meta1)).toBe(engine.hashMetadata(meta2));
  });

  it('hashMetadata changes when value changes', () => {
    const meta1 = { title: 'BSc CS' };
    const meta2 = { title: 'MSc CS' };
    expect(engine.hashMetadata(meta1)).not.toBe(engine.hashMetadata(meta2));
  });

  // ─── QR tokens ──────────────────────────────────────────────────

  it('generates and verifies QR token successfully', () => {
    const docId = 'doc-123';
    const tenantId = 'tenant-456';
    const secret = 'super-secret-key';
    const token = engine.generateQrToken(docId, tenantId, secret);
    expect(engine.verifyQrToken(token, docId, tenantId, secret)).toBe(true);
  });

  it('rejects tampered QR token', () => {
    const token = engine.generateQrToken('doc-1', 'tenant-1', 'secret');
    const tampered = token.slice(0, -4) + 'ffff';
    expect(engine.verifyQrToken(tampered, 'doc-1', 'tenant-1', 'secret')).toBe(false);
  });

  it('rejects QR token for different document', () => {
    const token = engine.generateQrToken('doc-1', 'tenant-1', 'secret');
    expect(engine.verifyQrToken(token, 'doc-2', 'tenant-1', 'secret')).toBe(false);
  });
});
