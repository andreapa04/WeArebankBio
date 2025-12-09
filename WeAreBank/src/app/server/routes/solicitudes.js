import express from "express";
import pool from "../db.js";

const router = express.Router();

/** --- CLIENTE SOLICITA APERTURA DE CUENTA --- **/
router.post("/solicitar-cuenta", async (req, res) => {
  try {
    const { idUsuario, tipoCuenta } = req.body;

    // Verificar si ya tiene una cuenta activa
    const [cuentas] = await pool.query(
      `SELECT c.idCuenta 
       FROM cuenta c 
       JOIN pertenece p ON p.idCuenta = c.idCuenta
       WHERE p.idUsuario = ?`,
      [idUsuario]
    );

    if (cuentas.length > 0) {
      return res.status(400).json({ error: "Ya tienes una cuenta activa" });
    }

    await pool.query(
      `INSERT INTO solicitud_cuenta (idUsuario, tipoCuenta) VALUES (?, ?)`,
      [idUsuario, tipoCuenta || "AHORRO"]
    );

    res.json({ message: "Solicitud de apertura enviada correctamente" });
  } catch (err) {
    console.error("Error al solicitar cuenta:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/** --- GERENTE O EJECUTIVO APRUEBA LA SOLICITUD --- **/
router.put("/aprobar-cuenta/:idSolicitud", async (req, res) => {
  try {
    const { idSolicitud } = req.params;

    // Obtener usuario
    const [solicitud] = await pool.query(
      `SELECT idUsuario, tipoCuenta FROM solicitud_cuenta WHERE idSolicitud = ?`,
      [idSolicitud]
    );

    if (!solicitud.length) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const { idUsuario, tipoCuenta } = solicitud[0];

    // Crear cuenta
    const clabe = "646180" + Math.floor(1000000000 + Math.random() * 9000000000);
    const [resultCuenta] = await pool.query(
      `INSERT INTO cuenta (clabe, saldo, tipoCuenta) VALUES (?, 0.00, ?)`,
      [clabe, tipoCuenta]
    );

    const idCuenta = resultCuenta.insertId;

    // Asociar al usuario
    await pool.query(`INSERT INTO pertenece (idUsuario, idCuenta) VALUES (?, ?)`, [
      idUsuario,
      idCuenta,
    ]);

    // Crear tarjeta
    const numeroTarjeta = "411111" + Math.floor(100000000000 + Math.random() * 900000000000);
    const vencimiento = new Date();
    vencimiento.setFullYear(vencimiento.getFullYear() + 5);
    const cvv = Math.floor(100 + Math.random() * 900);

    await pool.query(
      `INSERT INTO tarjeta (idCuenta, numeroTarjeta, vencimiento, cvv, tipoTarjeta, esVirtual, estado, limiteDeposito, retiroMaximo)
       VALUES (?, ?, ?, ?, 'DEBITO', FALSE, 'ACTIVA', 100000.00, 50000.00)`,
      [idCuenta, numeroTarjeta, vencimiento, cvv]
    );

    // Actualizar estado de solicitud
    await pool.query(
      `UPDATE solicitud_cuenta SET estado='APROBADA' WHERE idSolicitud = ?`,
      [idSolicitud]
    );

    res.json({ message: "Cuenta y tarjeta creadas correctamente" });
  } catch (err) {
    console.error("Error al aprobar cuenta:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
