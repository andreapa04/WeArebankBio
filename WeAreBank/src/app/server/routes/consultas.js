import express from "express";
import pool from "../db.js";
import { generarEstadoCuentaPDF } from "./estadoCuentaPDF.js";

const router = express.Router();

/**
 * 🔹 GET /api/consultas/mis-cuentas/:idUsuario
 */
router.get("/mis-cuentas/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  try {
    const [cuentas] = await pool.query(
      `SELECT c.idCuenta, c.clabe, c.tipoCuenta, c.saldo
       FROM cuenta c
       INNER JOIN pertenece p ON p.idCuenta = c.idCuenta
       WHERE p.idUsuario = ?`,
      [idUsuario]
    );

    res.json(cuentas);
  } catch (error) {
    console.error("Error al consultar cuentas:", error);
    res.status(500).json({ message: "Error al obtener las cuentas." });
  }
});

/**
 * 🔹 GET /api/consultas/estado-cuenta-pdf/:clabe
 */
router.get("/estado-cuenta-pdf/:clabe", async (req, res) => {
  const { clabe } = req.params;

  if (!clabe) {
    return res.status(400).json({ message: "CLABE es requerida." });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();

    const [cuentaRows] = await connection.query(
      `SELECT * FROM cuenta WHERE clabe = ?`,
      [clabe]
    );

    if (cuentaRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Cuenta no encontrada." });
    }
    const datosCuenta = cuentaRows[0];
    const idCuenta = datosCuenta.idCuenta;

    const [usuarioRows] = await connection.query(
      `SELECT u.nombre, u.apellidoP, u.apellidoM, u.RFC, u.email 
       FROM usuario u
       JOIN pertenece p ON u.idUsuario = p.idUsuario
       WHERE p.idCuenta = ?
       LIMIT 1`,
      [idCuenta]
    );
    
    if (usuarioRows.length === 0) {
      connection.release();
      return res.status(404).json({ message: "Usuario no encontrado para esta cuenta." });
    }
    const usuario = usuarioRows[0];

    const [movimientos] = await connection.query(
      `SELECT * FROM movimiento
       WHERE idCuenta = ?
       ORDER BY fechaHora ASC`,
      [idCuenta]
    );

    connection.release();

    const pdfBuffer = await generarEstadoCuentaPDF(datosCuenta, movimientos, usuario);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=estado-cuenta-${clabe}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    if (connection) connection.release();
    console.error("Error al generar estado de cuenta PDF:", error);
    res.status(500).json({ message: "Error al generar el PDF." });
  }
});

/**
 * 🔹 GET /api/consultas/mis-tarjetas/:idUsuario
 * ¡CORREGIDO! Ahora incluye idCuenta, limiteCredito y estado.
 */
router.get("/mis-tarjetas/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  if (!idUsuario) {
    return res.status(400).json({ message: "ID de usuario es requerido" });
  }

  try {
    // ⚠️ AQUÍ ESTABA EL ERROR: Faltaban campos en el SELECT
    const [tarjetas] = await pool.query(
      `SELECT
         t.idTarjeta, 
         t.idCuenta,        -- Necesario para vincular débito con saldo de cuenta
         t.numeroTarjeta, 
         t.vencimiento, 
         t.tipoTarjeta, 
         t.esVirtual, 
         t.limiteCredito,   -- Necesario para mostrar el crédito
         t.estado,          -- Necesario para ver si está activa
         u.nombre, 
         u.apellidoP, 
         u.apellidoM
       FROM tarjeta t
       JOIN cuenta c ON t.idCuenta = c.idCuenta
       JOIN pertenece p ON c.idCuenta = p.idCuenta
       JOIN usuario u ON p.idUsuario = u.idUsuario
       WHERE p.idUsuario = ?
       ORDER BY t.tipoTarjeta, t.idTarjeta`,
      [idUsuario]
    );

    res.json(tarjetas);
  } catch (error) {
    console.error("Error al consultar tarjetas:", error);
    res.status(500).json({ message: "Error al obtener las tarjetas." });
  }
});

/**
 * 🔹 GET /api/consultas/movimientos/:idCuenta
 */
router.get("/movimientos/:idCuenta", async (req, res) => {
  const { idCuenta } = req.params;

  try {
    const [movimientos] = await pool.query(
      `SELECT 
         idMovimiento,
         monto,
         tipoMovimiento,
         fechaHora
       FROM movimiento
       WHERE idCuenta = ?
       ORDER BY fechaHora DESC`,
      [idCuenta]
    );

    res.json(movimientos);
  } catch (error) {
    console.error("Error al consultar movimientos:", error);
    res.status(500).json({ message: "Error al obtener los movimientos." });
  }
});

router.post("/solicitar-cierre", async (req, res) => {
  const { idUsuario, razon_cliente } = req.body;

  if (!idUsuario) {
    return res.status(400).json({ message: "Información de usuario no encontrada." });
  }

  try {
    const [existente] = await pool.query(
      "SELECT idSolicitudCierre FROM solicitud_cierre WHERE idUsuario = ? AND estado = 'PENDIENTE'",
      [idUsuario]
    );

    if (existente.length > 0) {
      return res.status(400).json({ message: "Ya tienes una solicitud de cierre pendiente de revisión." });
    }

    await pool.query(
      "INSERT INTO solicitud_cierre (idUsuario, razon_cliente, estado) VALUES (?, ?, 'PENDIENTE')",
      [idUsuario, razon_cliente || null]
    );

    res.status(201).json({ message: "Solicitud de cierre enviada. Un ejecutivo la revisará pronto." });
    
  } catch (error) {
    console.error("Error al solicitar cierre:", error);
    res.status(500).json({ message: "Error al procesar la solicitud." });
  }
});

/**
 * 🔹 GET /api/consultas/detalle-cuenta/:idCuenta
 */
router.get("/detalle-cuenta/:idCuenta", async (req, res) => {
  const { idCuenta } = req.params;

  try {
    const [cuentaRows] = await pool.query(
      `SELECT idCuenta, clabe, tipoCuenta, saldo
       FROM cuenta
       WHERE idCuenta = ?`,
      [idCuenta]
    );

    if (cuentaRows.length === 0)
      return res.status(404).json({ message: "Cuenta no encontrada." });

    const [movimientos] = await pool.query(
      `SELECT 
         idMovimiento,
         monto,
         tipoMovimiento,
         fechaHora
       FROM movimiento
       WHERE idCuenta = ?
       ORDER BY fechaHora DESC`,
      [idCuenta]
    );

    res.json({
      cuenta: cuentaRows[0],
      movimientos,
    });
  } catch (error) {
    console.error("Error al consultar detalle de cuenta:", error);
    res.status(500).json({ message: "Error al obtener el detalle de la cuenta." });
  }
});

export default router;