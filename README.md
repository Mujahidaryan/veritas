# Veritas — Enterprise Document Integrity Infrastructure Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)

**Author:** Muhammad Mujahid — [github.com/Mujahidaryan](https://github.com/Mujahidaryan)

---

Veritas is a **production-grade enterprise integrity middleware** that makes every document your organization produces **legally defensible, instantly verifiable, and tamper-evident** — without replacing or migrating your existing systems.

## What it does

Veritas sits between your existing enterprise systems and an immutable verification layer:

```
Your EHR / HRMS / DMS / ERP
         ↓  (REST API or SDK — 5 lines of code)
   Veritas Core Services
         ↓  (hash only — never raw content)
  Hyperledger Fabric Ledger (immutable proof)
```

**Documents never leave your infrastructure.** Only SHA-256 cryptographic hashes are anchored on the permissioned blockchain.

---

## Monorepo Structure

```
veritas/
├── apps/
│   ├── web/                    # Next.js enterprise dashboard (port 3000)
│   ├── api/                    # NestJS core API (port 4000)
│   └── verification-portal/    # Public QR verification app (port 3001)
├── packages/
│   ├── sdk/                    # @veritas/sdk — npm-publishable SDK
│   ├── hashing-engine/         # Deterministic SHA-256 pipeline
│   ├── blockchain-client/      # Hyperledger Fabric wrapper
│   └── shared-types/           # Shared TypeScript types
├── contracts/
│   └── document-registry/      # Go chaincode (Hyperledger Fabric)
├── infra/
│   ├── terraform/              # GCP infrastructure as code
│   ├── k8s/                    # Kubernetes manifests
│   ├── docker/                 # Dockerfiles + docker-compose
│   └── monitoring/             # Prometheus + alerting rules
└── .github/workflows/          # CI/CD pipeline
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm 10+

### 1. Clone and install
```bash
git clone https://github.com/Mujahidaryan/veritas.git
cd veritas
npm install
```

### 2. Configure environment
```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your values (see .env.example for guidance)
```

### 3. Start infrastructure
```bash
npm run docker:up
# Starts: PostgreSQL, Redis, Hyperledger Fabric (orderer + peer)
```

### 4. Run database migrations and seed
```bash
npm run db:migrate
npm run db:seed
```

### 5. Start development servers
```bash
npm run dev
# API: http://localhost:4000
# Dashboard: http://localhost:3000
# Verification portal: http://localhost:3001
# Swagger docs: http://localhost:4000/api/docs
```

### 6. Login with seed credentials
```
Organization: demo-hospital
Email:        admin@demo-hospital.com
Password:     Admin@Veritas123!
```

---

## SDK Usage

```bash
npm install @veritas/sdk
```

```typescript
import { VeritasClient } from '@veritas/sdk';

const veritas = new VeritasClient({
  apiKey: process.env.VERITAS_API_KEY,
  baseUrl: 'https://api.veritas.io/api',
});

// Issue a document
const doc = await veritas.documents.issue({
  file: pdfBuffer,
  fileName: 'report.pdf',
  mimeType: 'application/pdf',
  departmentId: 'dept_cardiology_id',
  metadata: {
    type: 'medical-report',
    title: 'Blood Test Report — March 2025',
    issuedTo: 'patient-ref-001',
  },
});

console.log(doc.qrUrl);     // Embed in PDF
console.log(doc.blockchainTxId); // Proof reference

// Verify a document
const result = await veritas.documents.verify({
  file: uploadedBuffer,
  fileName: 'report.pdf',
  mimeType: 'application/pdf',
});

if (result.status === 'authentic') {
  console.log('✅ Document is authentic');
} else if (result.status === 'tampered') {
  console.error('⚠️ Tamper detected!');
}
```

---

## API Reference

Full OpenAPI docs available at `http://localhost:4000/api/docs` in development.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Login | Public |
| POST | `/api/auth/refresh` | Refresh tokens | Public |
| POST | `/api/v1/documents/issue` | Issue document | Bearer / API Key |
| POST | `/api/v1/documents/verify` | Verify by file upload | Bearer / API Key |
| GET  | `/api/v1/documents` | List documents | Bearer |
| GET  | `/api/v1/documents/:id` | Get document | Bearer |
| PUT  | `/api/v1/documents/:id/revoke` | Revoke document | Bearer |
| GET  | `/api/v1/audit/logs` | Audit log | Bearer |
| GET  | `/api/v1/analytics/summary` | Analytics | Bearer |
| GET  | `/api/pub/verify/:slug/:id/:token` | Public QR verify | **Public** |

---

## Deployment

### Google Cloud (GKE) — Production

```bash
# 1. Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Provision infrastructure
cd infra/terraform
terraform init
terraform plan -var="project_id=YOUR_PROJECT_ID"
terraform apply

# 3. Configure kubectl
gcloud container clusters get-credentials veritas-prod \
  --zone asia-south1-a \
  --project YOUR_PROJECT_ID

# 4. Create secrets
kubectl create secret generic veritas-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=JWT_SECRET="$(openssl rand -hex 64)" \
  --from-literal=QR_HMAC_SECRET="$(openssl rand -hex 32)" \
  --from-literal=STORAGE_ENCRYPTION_KEY="$(openssl rand -base64 32 | head -c 32)" \
  --namespace=veritas

# 5. Deploy
kubectl apply -f infra/k8s/ -n veritas
```

### On-premise / Self-hosted

```bash
# Build all images
docker-compose -f infra/docker/docker-compose.yml build

# Start everything
docker-compose -f infra/docker/docker-compose.yml up -d

# Run migrations
docker-compose exec api npx prisma migrate deploy
```

---

## Security

- **Encryption at rest**: AES-256-GCM for all stored files (client-side, before upload to GCS)
- **Encryption in transit**: TLS 1.3 mandatory, HSTS enforced
- **Authentication**: Argon2id password hashing, rotating JWT refresh tokens, MFA (TOTP)
- **RBAC**: 6-level role hierarchy with granular permissions
- **Rate limiting**: Redis token bucket per API key and IP
- **Audit chain**: Each event hashes the previous — tamper-evident append-only log
- **Secrets**: HashiCorp Vault / GCP Secret Manager in production
- **OWASP Top 10**: All items mitigated — see security checklist in `docs/`

---

## Architecture Decision Records

See `docs/ADRs/` for detailed rationale on:
- **ADR-001**: Hyperledger Fabric over public blockchain
- **ADR-002**: Hash-only blockchain storage (privacy)
- **ADR-003**: NestJS over Express for enterprise structure
- **ADR-004**: Client-side encryption before cloud storage
- **ADR-005**: Append-only audit chain with hash links

---

## License

MIT — Copyright © 2025 [Muhammad Mujahid](https://github.com/Mujahidaryan)
