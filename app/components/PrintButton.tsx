"use client";

export function PrintButton() {
  return (
    <button className="btn no-print" style={{ width: "auto" }} onClick={() => window.print()}>
      Imprimir / Salvar como PDF
    </button>
  );
}
