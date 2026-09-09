-- CreateTable
CREATE TABLE "UsuarioSistema" (
    "id" SERIAL NOT NULL,
    "usuario" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UsuarioSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioSistema_usuario_key" ON "UsuarioSistema"("usuario");
