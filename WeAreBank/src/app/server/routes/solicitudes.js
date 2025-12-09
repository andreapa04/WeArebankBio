import express from "express";
import pool from "../db.js";
import { enviarCorreoMovimiento } from "../../utils/mailer.js";

const router = express.Router();

/** --- Obtener cuentas del usuario --- **/
router.get("/mis-cuentas/:idUsuario", async (req, res) => {
  try {
    const { idUsuario } = req.params;
    const [rows] = await pool.query(
      `SELECT c.idCuenta, c.clabe, c.saldo, c.tipoCuenta
       FROM cuenta c
       JOIN pertenece p ON p.idCuenta = c.idCuenta
       WHERE p.idUsuario = ?`,
      [idUsuario]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener cuentas" });
  }
});

/** * ENVÍO DE TRANSFERENCIAS (INTERNA/EXTERNA) 
 * Mantenemos la lógica existente que usa los Stored Procedures actuales.
 */
router.post("/", async (req, res) => {
  try {
    const {
      idCuentaOrigen,
      idCuentaDestino,
      cuentaDestino,
      destinoExterno,
      bancoDestino,
      monto,
      concepto,
      tipo
    } = req.body;

    if (!idCuentaOrigen || !monto) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    // Calcular total con comisión para validación (aunque el SP lo hace)
    const comision = parseFloat((monto * 0.07).toFixed(2));
    const total = monto + comision;

    let destinoID = null;
    let destinoExt = null;

    if (tipo === "INTERNA") {
      const destino = idCuentaDestino || cuentaDestino;
      
      const [dest] = await pool.query(
        "SELECT idCuenta FROM cuenta WHERE clabe = ? OR idCuenta = ?",
        [destino, destino]
      );
      
      if (!dest.length) throw new Error("Cuenta interna no encontrada");
      destinoID = dest[0].idCuenta;

      if (destinoID == idCuentaOrigen) {
        return res.status(400).json({ error: "No puedes transferir a la misma cuenta." });
      }

      await pool.query("CALL sp_transferencia_interna(?, ?, ?, ?)", [
        idCuentaOrigen,
        destinoID,
        monto,
        concepto,
      ]);

      if (destinoID) {
        await pool.query(
          "INSERT INTO movimiento (idCuenta, monto, tipoMovimiento) VALUES (?, ?, 'TRANSFERENCIA_RECIBIDA')",
          [destinoID, monto]
        );
        
        const [receptorUser] = await pool.query(
          `SELECT u.email, c.clabe FROM usuario u
           JOIN pertenece p ON p.idUsuario = u.idUsuario
           JOIN cuenta c ON c.idCuenta = p.idCuenta
           WHERE c.idCuenta = ? LIMIT 1`,
          [destinoID]
        );

        if (receptorUser.length) {
          await enviarCorreoMovimiento(receptorUser[0].email, "TRANSFERENCIA_RECIBIDA", monto, receptorUser[0].clabe);
        }
      }

    } else {
      // EXTERNA
      destinoExt = destinoExterno || cuentaDestino;
      await pool.query("CALL sp_transferencia_externa(?, ?, ?, ?, ?)", [
        idCuentaOrigen,
        destinoExt,
        bancoDestino,
        monto,
        concepto,
      ]);
    }

    const [user] = await pool.query(
      `SELECT u.email, c.clabe FROM usuario u
       JOIN pertenece p ON p.idUsuario = u.idUsuario
       JOIN cuenta c ON c.idCuenta = p.idCuenta
       WHERE c.idCuenta = ? LIMIT 1`,
      [idCuentaOrigen]
    );

    if (user.length) {
      await enviarCorreoMovimiento(user[0].email, "TRANSFERENCIA_ENVIADA", total, user[0].clabe);
    }

    res.json({ message: "Transferencia completada exitosamente" });
  } catch (err) {
    console.error("Error transferencia:", err.message);
    res.status(400).json({ error: err.message });
  }
});

/** * 🔹 RECEPCIÓN DE TRANSFERENCIA EXTERNA (NUEVO)
 * Simula que llega dinero de otro banco (SPEI).
 * No usa la tabla Transferencia para evitar errores de FK, solo Movimientos y Saldo.
 */
router.post("/recepcion-externa", async (req, res) => {
  try {
    const { clabeDestino, monto, bancoOrigen, nombreEmisor, concepto } = req.body;

    if (!clabeDestino || !monto) {
      return res.status(400).json({ error: "Datos incompletos para recepción." });
    }

    // 1. Buscar cuenta destino
    const [dest] = await pool.query("SELECT idCuenta, saldo FROM cuenta WHERE clabe = ?", [clabeDestino]);
    
    if (!dest.length) {
      return res.status(404).json({ error: "La cuenta destino (CLABE) no existe en WeAreBank." });
    }
    const idCuenta = dest[0].idCuenta;

    // 2. Actualizar Saldo (Manual, sin SP para controlar el tipo de movimiento)
    await pool.query("UPDATE cuenta SET saldo = saldo + ? WHERE idCuenta = ?", [monto, idCuenta]);

    // 3. Registrar Movimiento con etiqueta clara
    const conceptoMov = `SPEI RECIBIDO: ${bancoOrigen} - ${nombreEmisor} - ${concepto}`;
    await pool.query(
      "INSERT INTO movimiento (idCuenta, monto, tipoMovimiento, fechaHora) VALUES (?, ?, ?, NOW())",
      [idCuenta, monto, 'TRANSFERENCIA_EXTERNA_RECIBIDA'] // Tipo personalizado
    );

    // 4. Notificar
    const [user] = await pool.query(
      `SELECT u.email FROM usuario u
       JOIN pertenece p ON p.idUsuario = u.idUsuario
       JOIN cuenta c ON c.idCuenta = p.idCuenta
       WHERE c.idCuenta = ? LIMIT 1`,
      [idCuenta]
    );

    if (user.length) {
      await enviarCorreoMovimiento(user[0].email, "TRANSFERENCIA_RECIBIDA_EXTERNA", monto, clabeDestino);
    }

    res.json({ message: `Recepción de $${monto} exitosa desde ${bancoOrigen}.` });

  } catch (err) {
    console.error("Error en recepción externa:", err.message);
    res.status(500).json({ error: "Error procesando la recepción externa." });
  }
});

/** --- DEPÓSITO SIMPLE --- **/
router.post("/deposito", async (req, res) => {
  // ... (Mismo código de depósito que ya tenías)
  try {
    const { cuentaDestino, monto, concepto } = req.body;
    if (!cuentaDestino || !monto) return res.status(400).json({ error: "Datos incompletos" });

    const [dest] = await pool.query("SELECT idCuenta FROM cuenta WHERE clabe=? OR idCuenta=?", [cuentaDestino, cuentaDestino]);
    if (!dest.length) throw new Error("Cuenta destino no encontrada");

    const idCuenta = dest[0].idCuenta;
    await pool.query("CALL sp_deposito(?, ?, ?)", [idCuenta, monto, concepto]);
    
    // El SP ya inserta movimiento DEPOSITO, pero agregamos logica de correo si es necesario
    res.json({ message: "Depósito realizado exitosamente" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;