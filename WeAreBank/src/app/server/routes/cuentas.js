import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/cuentas/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;
  const [rows] = await pool.query(
    `SELECT c.idCuenta, c.clabe, c.tipoCuenta, c.saldo
     FROM cuenta c
     JOIN pertenece p ON p.idCuenta = c.idCuenta
     WHERE p.idUsuario = ?`,
    [idUsuario]
  );
  res.json(rows);
});

router.get("/movimientos/:idCuenta", async (req, res) => {
  const { idCuenta } = req.params;
  const [rows] = await pool.query(
    `SELECT tipoMovimiento, monto, fechaHora
     FROM movimiento
     WHERE idCuenta = ?
     ORDER BY fechaHora DESC`,
    [idCuenta]
  );
  res.json(rows);
});

export default router;
