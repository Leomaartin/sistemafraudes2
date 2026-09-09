-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nroUsuario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "domicilio" TEXT,
    "ruta" TEXT,
    "observaciones" TEXT,
    "maps" TEXT,
    "idCuadrilla" INTEGER,
    "idEstado" INTEGER,
    "idTarifa" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuadrilla" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Cuadrilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estado" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarifa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Imagen" (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "Imagen_usuarioId_fkey"
        FOREIGN KEY ("usuarioId")
        REFERENCES "Usuario"(id)
        ON DELETE CASCADE
);
-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nroUsuario_key" ON "Usuario"("nroUsuario");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_idCuadrilla_fkey" FOREIGN KEY ("idCuadrilla") REFERENCES "Cuadrilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_idEstado_fkey" FOREIGN KEY ("idEstado") REFERENCES "Estado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_idTarifa_fkey" FOREIGN KEY ("idTarifa") REFERENCES "Tarifa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
