import express from "express";
import pool from "../db.js";
// 🔽 Importamos la nueva función de correo
import { enviarCorreoRetiro } from "../../utils/mailer.js";

const router = express.Router();

/**
 * POST /api/retiros
 * Cuerpo esperado:
 * {
 * idCuenta: number,
 * monto: number,
 * retiroSinTarjeta: boolean
 * }
 */
router.post("/", async (req, res) => {
  const { idCuenta, monto, retiroSinTarjeta } = req.body;

  if (!idCuenta || !monto || monto <= 0) {
    return res.status(400).json({ message: "Datos de retiro inválidos." });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1️⃣ Verificar saldo y obtener datos del usuario para el correo
    const [cuentaRows] = await connection.query(
      `SELECT c.saldo, u.email, u.nombre, c.clabe
       FROM cuenta c
       JOIN pertenece p ON c.idCuenta = p.idCuenta
       JOIN usuario u ON p.idUsuario = u.idUsuario
       WHERE c.idCuenta = ?
       LIMIT 1`,
      [idCuenta]
    );

    if (cuentaRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: "Cuenta o usuario no encontrados." });
    }

    const { saldo, email, clabe } = cuentaRows[0];

    if (saldo < monto) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: "Saldo insuficiente para realizar el retiro." });
    }

    // 2️⃣ Actualizar saldo
    await connection.query(
      "UPDATE cuenta SET saldo = saldo - ? WHERE idCuenta = ?",
      [monto, idCuenta]
    );

    let codigoGenerado = null;
    let tipoMovimiento = "RETIRO";
    let tipoCorreo = "ALERTA";
    let mensajeExito = " Retiro realizado correctamente.";

    // 3️⃣ Lógica condicional para retiro sin tarjeta
    if (retiroSinTarjeta) {
      codigoGenerado = Math.floor(100000 + Math.random() * 900000).toString();
      tipoMovimiento = "RETIRO_SIN_TARJETA";
      tipoCorreo = "CODIGO";
      mensajeExito = " Retiro sin tarjeta procesado. Revisa tu correo para ver el código.";
    }

    // 4️⃣ Registrar movimiento
    await connection.query(
      `INSERT INTO movimiento (idCuenta, monto, tipoMovimiento, fechaHora)
       VALUES (?, ?, ?, NOW())`,
      [idCuenta, -monto, tipoMovimiento]
    );

    // 5️⃣ Enviar correo (fuera de la transacción de BD)
    await connection.commit();
    connection.release();

    await enviarCorreoRetiro(email, tipoCorreo, monto, clabe, codigoGenerado);

    // 6️⃣ Enviar respuesta al frontend
    res.json({
      message: mensajeExito,
      nuevoSaldo: saldo - monto,
      codigo: codigoGenerado // Se envía el código (o null)
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error(" Error en retiro:", error);
    res.status(500).json({ message: "Error al procesar el retiro." });
  }
});

export default router;