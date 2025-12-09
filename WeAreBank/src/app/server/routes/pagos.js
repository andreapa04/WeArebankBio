import express from "express";
import pool from "../db.js";
import { enviarCorreoMovimiento } from "../../utils/mailer.js";

const router = express.Router();

/**
 * 🔹 POST /api/pagos/servicio
 * Realiza un pago de servicio (Agua, Luz, etc.)
 */
router.post("/servicio", async (req, res) => {
  const { idCuenta, monto, referencia } = req.body;
  let connection;

  if (!idCuenta || !monto || monto <= 0) {
    return res.status(400).json({ error: "Datos de pago inválidos" });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Bloquear fila para verificar saldo
    const [cuentaRows] = await connection.query(
      `SELECT c.saldo, u.email, c.clabe 
       FROM cuenta c
       JOIN pertenece p ON c.idCuenta = p.idCuenta
       JOIN usuario u ON p.idUsuario = u.idUsuario
       WHERE c.idCuenta = ?
       FOR UPDATE`,
      [idCuenta]
    );

    if (cuentaRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "Cuenta no encontrada" });
    }

    const { saldo, email, clabe } = cuentaRows[0];

    if (saldo < monto) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    // Actualizar saldo
    await connection.query(
      "UPDATE cuenta SET saldo = saldo - ? WHERE idCuenta = ?",
      [monto, idCuenta]
    );

    // Registrar movimiento
    const tipoMov = `PAGO_SERVICIO: ${referencia || 'Servicio'}`;
    await connection.query(
      `INSERT INTO movimiento (idCuenta, monto, tipoMovimiento, fechaHora)
       VALUES (?, ?, ?, NOW())`,
      [idCuenta, -monto, tipoMov]
    );

    await connection.commit();
    connection.release();

    // Enviar correo
    if (email) {
      await enviarCorreoMovimiento(email, tipoMov, monto, clabe);
    }

    res.json({
      message: `Pago de ${referencia || "servicio"} realizado correctamente.`,
      nuevoSaldo: saldo - monto,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error("Error en pago de servicio:", error);
    res.status(500).json({ error: "Error al procesar el pago" });
  }
});

/**
 * 🔹 POST /api/pagos/prestamo
 * Llama al procedimiento almacenado sp_realizar_pago_prestamo
 * Este SP maneja la lógica de saldo pendiente y cambio a 'FINALIZADO'
 */
router.post("/prestamo", async (req, res) => {
  const { idCuenta, idSolicitud, monto } = req.body;

  if (!idCuenta || !idSolicitud || !monto) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    // Llamar al SP
    const [result] = await pool.query(
      "CALL sp_realizar_pago_prestamo(?, ?, ?)", 
      [idCuenta, idSolicitud, monto]
    );
    
    // El SP devuelve un result set con el mensaje en la primera fila
    const mensaje = result[0][0].mensaje;

    res.json({ message: mensaje });
  } catch (error) {
    console.error("Error en pago prestamo:", error);
    // Capturar mensaje de error del SQL SIGNAL si existe
    res.status(500).json({ error: error.sqlMessage || "Error al procesar el pago de préstamo" });
  }
});

/**
 * 🔹 GET /api/pagos/historial/:idUsuario
 * Historial combinado de servicios y préstamos
 */
router.get("/historial/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  try {
    // Pagos de Servicios
    const [pagosServicios] = await pool.query(
      `SELECT 
         m.idMovimiento, m.fechaHora, m.monto, m.tipoMovimiento, c.clabe
       FROM movimiento m
       INNER JOIN cuenta c ON m.idCuenta = c.idCuenta
       INNER JOIN pertenece p ON c.idCuenta = p.idCuenta
       WHERE p.idUsuario = ? AND m.tipoMovimiento LIKE 'PAGO_SERVICIO%'
       ORDER BY m.fechaHora DESC`,
      [idUsuario]
    );

    // Pagos de Préstamos (Tabla PagosSolicitud)
    const [pagosPrestamos] = await pool.query(
      `SELECT 
         ps.idPago, ps.fechaHora, ps.monto, s.tipo as tipoMovimiento, c.clabe, s.idSolicitud
       FROM PagosSolicitud ps
       INNER JOIN solicitud s ON ps.idSolicitud = s.idSolicitud
       INNER JOIN cuenta c ON s.idCuenta = c.idCuenta
       INNER JOIN pertenece p ON c.idCuenta = p.idCuenta
       WHERE p.idUsuario = ?
       ORDER BY ps.fechaHora DESC`,
      [idUsuario]
    );

    const historialCompleto = [
      ...pagosServicios.map(p => ({
        id: p.idMovimiento,
        fecha: p.fechaHora,
        monto: Math.abs(p.monto),
        tipo: p.tipoMovimiento.replace('PAGO_SERVICIO: ', ''),
        clabe: p.clabe,
        categoria: 'Servicio'
      })),
      ...pagosPrestamos.map(p => ({
        id: p.idPago,
        fecha: p.fechaHora,
        monto: p.monto,
        tipo: p.tipoMovimiento,
        clabe: p.clabe,
        categoria: 'Préstamo',
        idSolicitud: p.idSolicitud
      }))
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(historialCompleto);
  } catch (error) {
    console.error("Error historial pagos:", error);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

/**
 * 🔹 GET /api/pagos/prestamos/:idUsuario
 * Obtiene préstamos ACTIVOS (APROBADA) para pagar.
 * Los FINALIZADO ya no se muestran aquí para evitar pagos extra.
 */
router.get("/prestamos/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  try {
    const [prestamos] = await pool.query(
      `SELECT 
         s.idSolicitud, s.tipo, s.montoTotal, s.plazo, s.intereses, s.estado,
         c.idCuenta, c.clabe,
         COALESCE(SUM(ps.monto), 0) as totalPagado
       FROM solicitud s
       INNER JOIN cuenta c ON s.idCuenta = c.idCuenta
       INNER JOIN pertenece p ON c.idCuenta = p.idCuenta
       LEFT JOIN PagosSolicitud ps ON s.idSolicitud = ps.idSolicitud
       WHERE p.idUsuario = ? AND s.estado = 'APROBADA'
       GROUP BY s.idSolicitud, s.tipo, s.montoTotal, s.plazo, s.intereses, s.estado, c.idCuenta, c.clabe`,
      [idUsuario]
    );

    res.json(prestamos);
  } catch (error) {
    console.error("Error prestamos usuario:", error);
    res.status(500).json({ error: "Error al obtener préstamos" });
  }
});

export default router;