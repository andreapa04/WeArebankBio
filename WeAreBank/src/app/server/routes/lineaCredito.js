import express from "express";
import pool from "../db.js";

const router = express.Router();

/** --- CLIENTE SOLICITA LÍNEA DE CRÉDITO --- **/
router.post("/solicitar", async (req, res) => {
  try {
    const { idUsuario, ingresoMensual, montoSolicitado } = req.body;

    if (!idUsuario || !ingresoMensual || !montoSolicitado) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    await pool.query(
      `INSERT INTO linea_credito (idUsuario, ingresoMensual, montoSolicitado)
       VALUES (?, ?, ?)`,
      [idUsuario, ingresoMensual, montoSolicitado]
    );

    res.json({ message: "Solicitud de línea de crédito enviada" });
  } catch (err) {
    console.error("Error al solicitar línea de crédito:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/** --- EJECUTIVO/GERENTE APRUEBA O RECHAZA --- **/
router.put("/resolver/:idLinea", async (req, res) => {
  try {
    const { idLinea } = req.params;
    const { aprobar, montoAprobado, tasaInteres } = req.body;

    const estado = aprobar ? "APROBADA" : "RECHAZADA";
    const montoFinal = aprobar ? montoAprobado : null;
    const tasa = aprobar ? tasaInteres : null;

    await pool.query(
      `UPDATE linea_credito
       SET estado = ?, montoAprobado = ?, tasaInteres = ?, fechaResolucion = NOW()
       WHERE idLinea = ?`,
      [estado, montoFinal, tasa, idLinea]
    );

    res.json({ message: `Solicitud ${estado.toLowerCase()} correctamente` });
  } catch (err) {
    console.error("Error al resolver línea de crédito:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/** --- VER SOLICITUDES (para ejecutivo/gerente) --- **/
router.get("/pendientes", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT lc.*, u.nombre, u.apellidoP, u.apellidoM, u.email
     FROM linea_credito lc
     JOIN usuario u ON u.idUsuario = lc.idUsuario
     WHERE lc.estado = 'PENDIENTE'`
  );
  res.json(rows);
});

export default router;
