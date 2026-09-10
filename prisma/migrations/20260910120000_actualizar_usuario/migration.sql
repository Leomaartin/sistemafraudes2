-- Agregar nuevo campo medidor
ALTER TABLE "Usuario"
ADD COLUMN "medidor" TEXT;

-- Eliminar relación antigua Usuario -> Cuadrilla
ALTER TABLE "Usuario"
DROP CONSTRAINT IF EXISTS "Usuario_idCuadrilla_fkey";

ALTER TABLE "Usuario"
DROP COLUMN IF EXISTS "idCuadrilla";

-- Crear nueva tabla para relación muchos-a-muchos
CREATE TABLE "_CuadrillaToUsuario" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CuadrillaToUsuario_pkey" PRIMARY KEY ("A", "B")
);

-- Índice para búsquedas por Usuario
CREATE INDEX "_CuadrillaToUsuario_B_index"
ON "_CuadrillaToUsuario"("B");

-- Relación con Cuadrilla
ALTER TABLE "_CuadrillaToUsuario"
ADD CONSTRAINT "_CuadrillaToUsuario_A_fkey"
FOREIGN KEY ("A")
REFERENCES "Cuadrilla"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Relación con Usuario
ALTER TABLE "_CuadrillaToUsuario"
ADD CONSTRAINT "_CuadrillaToUsuario_B_fkey"
FOREIGN KEY ("B")
REFERENCES "Usuario"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;