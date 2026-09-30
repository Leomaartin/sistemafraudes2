"use client";

import { useState, useRef } from "react";
import { ResultadoProcesamientoExcel } from "@/lib/procesadorExcel";

interface ModalImportarExcelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ModalImportarExcel({
  isOpen,
  onClose,
  onSuccess,
}: ModalImportarExcelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDryRun, setIsDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoProcesamientoExcel | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg(null);
      setResultado(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setErrorMsg(null);
      setResultado(null);
    }
  };

  const handleProcesar = async () => {
    if (!file) {
      setErrorMsg("Por favor selecciona un archivo Excel (.xlsx o .xls).");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResultado(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("dryRun", isDryRun ? "true" : "false");

    try {
      const res = await fetch("/api/importar-excel", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.exito) {
        throw new Error(data.error || data.mensaje || "Error al procesar el archivo.");
      }

      setResultado(data);
      if (!isDryRun && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const resetear = () => {
    setFile(null);
    setResultado(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Importar y Actualizar Excel</h2>
              <p className="text-xs text-slate-400">Sincronización inteligente de usuarios e irregularidades</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Reglas y Protecciones */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 text-xs text-slate-300 space-y-1.5">
            <div className="font-semibold text-blue-400 flex items-center gap-1.5">
              <span>🛡️ Reglas de Sincronización Segura:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
              <li>
                <strong>Alineación:</strong> Se cruzan los registros por <strong>N° de Usuario</strong> y <strong>Nombre</strong>.
              </li>
              <li>
                <strong>Si el usuario ya existe:</strong> Se actualizan todos los campos que hayan cambiado (datos generales, fechas de vto, edificio/llave, comercio, etc.).
              </li>
              <li>
                <strong>Protección de Coordenadas:</strong> La <strong>latitud</strong> y <strong>longitud</strong> ya guardadas <strong>NUNCA</strong> se modifican.
              </li>
              <li>
                <strong>Si el usuario es nuevo:</strong> Se registra automáticamente en el sistema.
              </li>
            </ul>
          </div>

          {/* Selector de Archivo */}
          {!resultado && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500/70 bg-slate-950/40 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {file ? file.name : "Haz clic o arrastra tu archivo Excel aquí"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Soporta formatos .xlsx y .xls</p>
              </div>
            </div>
          )}

          {/* Opciones */}
          {!resultado && (
            <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-2">
                <input
                  id="chkDryRun"
                  type="checkbox"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 bg-slate-900 cursor-pointer"
                />
                <label htmlFor="chkDryRun" className="text-xs text-slate-300 cursor-pointer select-none">
                  Modo Simulación (Dry-Run: analiza cambios sin modificar la BD)
                </label>
              </div>
            </div>
          )}

          {/* Mensajes de error */}
          {errorMsg && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pantalla de Resultados */}
          {resultado && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-emerald-950/40 border border-emerald-600/40 rounded-xl">
                <h3 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {resultado.mensaje}
                </h3>
              </div>

              {/* Grid Estadísticas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
                  <span className="text-xs text-slate-400">Total Filas</span>
                  <p className="text-lg font-bold text-white mt-0.5">{resultado.totalFilas.toLocaleString()}</p>
                </div>
                <div className="bg-blue-950/30 p-3 rounded-xl border border-blue-700/40 text-center">
                  <span className="text-xs text-blue-300">Modificados</span>
                  <p className="text-lg font-bold text-blue-400 mt-0.5">{resultado.usuariosModificados.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-700/40 text-center">
                  <span className="text-xs text-emerald-300">Nuevos Creados</span>
                  <p className="text-lg font-bold text-emerald-400 mt-0.5">{resultado.usuariosCreados.toLocaleString()}</p>
                </div>
                <div className="bg-purple-950/30 p-3 rounded-xl border border-purple-700/40 text-center">
                  <span className="text-xs text-purple-300">Coords. Protegidas</span>
                  <p className="text-lg font-bold text-purple-400 mt-0.5">{resultado.coordenadasPreservadas.toLocaleString()}</p>
                </div>
              </div>

              {/* Muestra de Cambios */}
              {resultado.detallesMuestra.length > 0 && (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-300">
                    Muestra de Cambios ({resultado.detallesMuestra.length} primeros registros)
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                    {resultado.detallesMuestra.map((item, idx) => (
                      <div key={idx} className="p-2.5 hover:bg-slate-800/30">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.esNuevo ? "bg-emerald-950 text-emerald-300 border border-emerald-700/50" : "bg-blue-950 text-blue-300 border border-blue-700/50"}`}>
                            {item.esNuevo ? "NUEVO" : "MODIFICADO"}
                          </span>
                          <span className="font-semibold text-slate-200">N° {item.nroUsuario}</span>
                          <span className="text-slate-400">- {item.nombre}</span>
                        </div>
                        <ul className="mt-1 pl-4 space-y-0.5 list-disc text-slate-300 text-[11px]">
                          {item.cambios.map((c, cIdx) => (
                            <li key={cIdx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-900/80">
          {resultado ? (
            <>
              <button
                type="button"
                onClick={resetear}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cargar Otro Archivo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                Cerrar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProcesar}
                disabled={!file || loading}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition flex items-center gap-2"
              >
                {loading && (
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <span>{loading ? "Procesando Excel..." : isDryRun ? "Simular Sincronización" : "Iniciar Sincronización"}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
