import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL ||= 'file:./dev.db';
const prisma = new PrismaClient();

const statements = [
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL UNIQUE, "phone" TEXT UNIQUE, "name" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'editor', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS "CollectionItem" ("id" TEXT NOT NULL PRIMARY KEY, "slug" TEXT NOT NULL UNIQUE, "title" TEXT NOT NULL, "summary" TEXT NOT NULL, "description" TEXT NOT NULL, "era" TEXT, "location" TEXT, "category" TEXT, "coverImageUrl" TEXT, "lifecycleStatus" TEXT NOT NULL DEFAULT 'draft', "isDemo" BOOLEAN NOT NULL DEFAULT false, "createdById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "ProvenanceRecord" ("id" TEXT NOT NULL PRIMARY KEY, "collectionItemId" TEXT NOT NULL, "sourceName" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL, "sourceLocator" TEXT, "accessedAt" DATETIME NOT NULL, "verificationStatus" TEXT NOT NULL DEFAULT 'needs_evidence', "notes" TEXT, "createdById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "ContentVersion" ("id" TEXT NOT NULL PRIMARY KEY, "collectionItemId" TEXT NOT NULL, "title" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'video', "script" TEXT NOT NULL, "narrationText" TEXT, "mediaUrl" TEXT, "status" TEXT NOT NULL DEFAULT 'draft', "isDemo" BOOLEAN NOT NULL DEFAULT false, "reviewerNote" TEXT, "reviewedAt" DATETIME, "reviewedById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "WorkflowTask" ("id" TEXT NOT NULL PRIMARY KEY, "collectionItemId" TEXT NOT NULL, "contentVersionId" TEXT, "requestedById" TEXT NOT NULL, "title" TEXT NOT NULL, "durationSeconds" INTEGER, "outputMode" TEXT, "language" TEXT, "frameTemplate" TEXT, "workflowName" TEXT, "provider" TEXT NOT NULL DEFAULT 'unconfigured', "providerVersion" TEXT, "providerTaskId" TEXT, "status" TEXT NOT NULL DEFAULT 'queued', "currentStep" TEXT, "errorMessage" TEXT, "generationEvidenceJson" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE, FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "WorkflowStep" ("id" TEXT NOT NULL PRIMARY KEY, "taskId" TEXT NOT NULL, "key" TEXT NOT NULL, "label" TEXT NOT NULL, "stepOrder" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', "provider" TEXT, "providerVersion" TEXT, "providerTaskId" TEXT, "outputRef" TEXT, "errorMessage" TEXT, "evidenceJson" TEXT, "startedAt" DATETIME, "finishedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("taskId") REFERENCES "WorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "WorkflowStep_taskId_key_key" UNIQUE ("taskId", "key"))`,
  `CREATE TABLE IF NOT EXISTS "AuditLog" ("id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "detailsJson" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "SystemSetting" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "valueJson" TEXT NOT NULL, "isPublic" BOOLEAN NOT NULL DEFAULT false, "description" TEXT, "updatedById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Organization" ("id" TEXT NOT NULL PRIMARY KEY, "slug" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL, "creditCode" TEXT NOT NULL DEFAULT '', "tagline" TEXT, "description" TEXT, "logoUrl" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS "OrganizationSetting" ("id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "key" TEXT NOT NULL, "valueJson" TEXT NOT NULL, "isPublic" BOOLEAN NOT NULL DEFAULT false, "description" TEXT, "updatedById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE, UNIQUE ("organizationId", "key"))`,
  `CREATE TABLE IF NOT EXISTS "Interaction" ("id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "collectionItemId" TEXT, "event" TEXT NOT NULL, "source" TEXT NOT NULL, "sessionId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Lead" ("id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "collectionItemId" TEXT, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "company" TEXT, "message" TEXT, "consent" BOOLEAN NOT NULL, "consentedAt" DATETIME, "source" TEXT NOT NULL DEFAULT 'direct', "status" TEXT NOT NULL DEFAULT 'new', "createdById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE, FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "ProductMedia" ("id" TEXT NOT NULL PRIMARY KEY, "collectionItemId" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'video', "originalName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "storagePath" TEXT NOT NULL, "mediaUrl" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ready', "createdById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "KnowledgeFile" ("id" TEXT NOT NULL PRIMARY KEY, "collectionItemId" TEXT NOT NULL, "originalName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "storagePath" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', "indexDocumentId" TEXT, "errorMessage" TEXT, "isPublic" BOOLEAN NOT NULL DEFAULT false, "confirmedAt" DATETIME, "confirmedById" TEXT, "createdById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE, FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "ProvenanceRecord_collectionItemId_idx" ON "ProvenanceRecord"("collectionItemId")`,
  `CREATE INDEX IF NOT EXISTS "ContentVersion_collectionItemId_idx" ON "ContentVersion"("collectionItemId")`,
  `CREATE INDEX IF NOT EXISTS "WorkflowStep_taskId_stepOrder_idx" ON "WorkflowStep"("taskId", "stepOrder")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId")`,
  `CREATE INDEX IF NOT EXISTS "CollectionItem_organizationId_lifecycleStatus_idx" ON "CollectionItem"("organizationId", "lifecycleStatus")`,
  `CREATE INDEX IF NOT EXISTS "OrganizationSetting_organizationId_isPublic_idx" ON "OrganizationSetting"("organizationId", "isPublic")`,
  `CREATE INDEX IF NOT EXISTS "Interaction_organizationId_createdAt_idx" ON "Interaction"("organizationId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Interaction_collectionItemId_event_source_idx" ON "Interaction"("collectionItemId", "event", "source")`,
  `CREATE INDEX IF NOT EXISTS "Lead_organizationId_status_createdAt_idx" ON "Lead"("organizationId", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Lead_collectionItemId_createdAt_idx" ON "Lead"("collectionItemId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ProductMedia_collectionItemId_kind_status_idx" ON "ProductMedia"("collectionItemId", "kind", "status")`,
  `CREATE INDEX IF NOT EXISTS "KnowledgeFile_collectionItemId_status_isPublic_idx" ON "KnowledgeFile"("collectionItemId", "status", "isPublic")`,
];

async function main() {
  for (const statement of statements.filter((value) => !value.startsWith('CREATE INDEX'))) await prisma.$executeRawUnsafe(statement);
  const userColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("User")`);
  if (!userColumns.some((column) => column.name === 'phone')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "phone" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")`);
  }
  if (!userColumns.some((column) => column.name === 'organizationId')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "organizationId" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId")`);
  }
  const collectionColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("CollectionItem")`);
  if (!collectionColumns.some((column) => column.name === 'era')) await prisma.$executeRawUnsafe(`ALTER TABLE "CollectionItem" ADD COLUMN "era" TEXT`);
  if (!collectionColumns.some((column) => column.name === 'location')) await prisma.$executeRawUnsafe(`ALTER TABLE "CollectionItem" ADD COLUMN "location" TEXT`);
  if (!collectionColumns.some((column) => column.name === 'organizationId')) await prisma.$executeRawUnsafe(`ALTER TABLE "CollectionItem" ADD COLUMN "organizationId" TEXT`);
  if (!collectionColumns.some((column) => column.name === 'useCase')) await prisma.$executeRawUnsafe(`ALTER TABLE "CollectionItem" ADD COLUMN "useCase" TEXT`);
  if (!collectionColumns.some((column) => column.name === 'audience')) await prisma.$executeRawUnsafe(`ALTER TABLE "CollectionItem" ADD COLUMN "audience" TEXT`);
  if (!collectionColumns.some((column) => column.name === 'specificationsJson')) await prisma.$executeRawUnsafe(`ALTER TABLE "CollectionItem" ADD COLUMN "specificationsJson" TEXT`);
  if (!collectionColumns.some((column) => column.name === 'resourcesJson')) await prisma.$executeRawUnsafe(`ALTER TABLE "CollectionItem" ADD COLUMN "resourcesJson" TEXT`);
  const organizationColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Organization")`);
  if (!organizationColumns.some((column) => column.name === 'creditCode')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Organization" ADD COLUMN "creditCode" TEXT NOT NULL DEFAULT ''`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Organization_creditCode_key" ON "Organization"("creditCode")`);
  }
  const workflowColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("WorkflowTask")`);
  if (!workflowColumns.some((column) => column.name === 'durationSeconds')) await prisma.$executeRawUnsafe(`ALTER TABLE "WorkflowTask" ADD COLUMN "durationSeconds" INTEGER`);
  if (!workflowColumns.some((column) => column.name === 'outputMode')) await prisma.$executeRawUnsafe(`ALTER TABLE "WorkflowTask" ADD COLUMN "outputMode" TEXT`);
  if (!workflowColumns.some((column) => column.name === 'language')) await prisma.$executeRawUnsafe(`ALTER TABLE "WorkflowTask" ADD COLUMN "language" TEXT`);
  if (!workflowColumns.some((column) => column.name === 'frameTemplate')) await prisma.$executeRawUnsafe(`ALTER TABLE "WorkflowTask" ADD COLUMN "frameTemplate" TEXT`);
  if (!workflowColumns.some((column) => column.name === 'workflowName')) await prisma.$executeRawUnsafe(`ALTER TABLE "WorkflowTask" ADD COLUMN "workflowName" TEXT`);
  for (const statement of statements.filter((value) => value.startsWith('CREATE INDEX'))) await prisma.$executeRawUnsafe(statement);
  console.log('SQLite schema ready');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
