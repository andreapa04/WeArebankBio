import express from "express";
import pool from "../db.js";
import { enviarCorreoMovimiento } from "../../utils/mailer.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { idCuentaDestino, monto } = req.body;

  try {
    await pool.query("UPDATE cuenta SET saldo = saldo + ? WHERE idCuenta = ?", [monto, idCuentaDestino]);

    await pool.query(
      "INSERT INTO movimiento (idCuenta, monto, tipoMovimiento) VALUES (?, ?, 'DEPOSITO')",
      [idCuentaDestino, monto]
    );

    // ENVIAR CORREO
    const [user] = await pool.query(
      `SELECT email, nombre, clabe FROM usuario
       JOIN pertenece ON usuario.idUsuario = pertenece.idUsuario
       JOIN cuenta ON cuenta.idCuenta = pertenece.idCuenta
       WHERE pertenece.idCuenta = ?`,
      [idCuentaDestino]
    );

    if (user.length) {
      await enviarCorreoMovimiento(user[0].email, "DEPÓSITO", monto, user[0].clabe);
    }

    res.json({ message: "Depósito exitoso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al realizar el depósito" });
  }
});

export default router;
