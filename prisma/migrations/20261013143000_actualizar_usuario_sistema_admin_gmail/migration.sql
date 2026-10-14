-- AlterTable
ALTER TABLE "UsuarioSistema" 
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "rol" TEXT NOT NULL DEFAULT 'operador',
ADD COLUMN IF NOT EXISTS "esAdmin" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "fechaVto" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UsuarioSistema_email_key" ON "UsuarioSistema"("email");
