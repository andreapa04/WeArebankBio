import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * 🔹 1. Solicitar un préstamo
 * Cliente solicita un préstamo que queda "EN_REVISION"
 */
router.post("/solicitar", async (req, res) => {
  const { idCuenta, montoTotal, plazo, tipo } = req.body;

  // 🔽 Validar que el TIPO sea un préstamo
  if (!tipo || !tipo.startsWith('PRESTAMO_')) {
    return res.status(400).json({ error: "El tipo de solicitud no es un préstamo válido." });
  }

  try {
    // Obtener usuario del titular
    const [[usuario]] = await pool.query(`
      SELECT u.idUsuario, b.puntaje, c.saldo
      FROM cuenta c
      JOIN pertenece p ON c.idCuenta = p.idCuenta
      JOIN usuario u ON p.idUsuario = u.idUsuario
      LEFT JOIN buro b ON b.idUsuario = u.idUsuario
      WHERE c.idCuenta = ?;
    `, [idCuenta]);

    if (!usuario) return res.status(404).json({ error: "Cuenta no encontrada" });

    // Reglas de evaluación inicial
    if (!usuario.puntaje || usuario.puntaje < 650) {
      return res.status(400).json({ error: "Puntaje de crédito insuficiente" });
    }

    if (usuario.saldo < montoTotal * 0.1) {
      return res.status(400).json({ error: "Saldo insuficiente para respaldo" });
    }

    // Calcular tasa de interés (según puntaje)
    let intereses = 0;
    if (usuario.puntaje >= 750) intereses = 12.5;
    else if (usuario.puntaje >= 700) intereses = 15.5;
    else intereses = 18.5;

    const cat = intereses + 3.0; // ejemplo

    // Insertar solicitud en revisión
    const [result] = await pool.query(`
      INSERT INTO solicitud (idCuenta, estado, montoTotal, plazo, intereses, cat, tipo)
      VALUES (?, 'EN_REVISION', ?, ?, ?, ?, ?)
    `, [idCuenta, montoTotal, plazo, intereses, cat, tipo]);

    res.json({
      message: "Solicitud de préstamo registrada con éxito, en revisión",
      idSolicitud: result.insertId
    });

  } catch (error) {
    console.error(" Error al registrar solicitud:", error);
    res.status(500).json({ error: "Error al registrar la solicitud" });
  }
});

/**
 * 🔹 2. Aprobar o rechazar préstamo (solo ejecutivo/gerente)
 */
router.put("/aprobar/:idSolicitud", async (req, res) => {
  const { idSolicitud } = req.params;
  const { aprobado } = req.body; // true o false

  try {
    const [[solicitud]] = await pool.query(
      "SELECT * FROM solicitud WHERE idSolicitud = ?",
      [idSolicitud]
    );

    if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
    if (solicitud.estado !== "EN_REVISION")
      return res.status(400).json({ error: "Solicitud ya procesada" });

    const nuevoEstado = aprobado ? "APROBADA" : "RECHAZADA";

    await pool.query(
      "UPDATE solicitud SET estado = ? WHERE idSolicitud = ?",
      [nuevoEstado, idSolicitud]
    );

    if (aprobado) {
      // Depositar monto a la cuenta
      await pool.query(
        "UPDATE cuenta SET saldo = saldo + ? WHERE idCuenta = ?",
        [solicitud.montoTotal, solicitud.idCuenta]
      );

      // Registrar movimiento
      await pool.query(
        "INSERT INTO movimiento (idCuenta, monto, tipoMovimiento) VALUES (?, ?, 'PRESTAMO_DEPOSITADO')",
        [solicitud.idCuenta, solicitud.montoTotal]
      );
    }

    res.json({ message: `Solicitud ${nuevoEstado.toLowerCase()} correctamente` });
  } catch (error) {
    console.error(" Error al procesar solicitud:", error);
    res.status(500).json({ error: "Error al procesar solicitud" });
  }
});

/**
 * 🔹 3. Registrar un pago de préstamo
 * (Esta ruta ya contenía la lógica para marcar como 'FINALIZADO')
 */
router.post("/pago", async (req, res) => {
  const { idSolicitud, monto } = req.body;

  try {
    const [[solicitud]] = await pool.query(
      "SELECT * FROM solicitud WHERE idSolicitud = ?",
      [idSolicitud]
    );

    if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
    if (solicitud.estado !== "APROBADA")
      return res.status(400).json({ error: "Solo se puede pagar préstamos aprobados" });

    // Registrar el pago
    await pool.query(
      "INSERT INTO PagosSolicitud (idSolicitud, monto) VALUES (?, ?)",
      [idSolicitud, monto]
    );

    // Registrar movimiento en cuenta (Esto debe mejorarse, necesita el idCuenta del pago)
    // Por ahora, se infiere de la solicitud
    await pool.query(
      "INSERT INTO movimiento (idCuenta, monto, tipoMovimiento) VALUES (?, ?, 'PAGO_PRESTAMO')",
      [solicitud.idCuenta, -monto]
    );

    // Calcular total pagado
    const [[{ totalPagado }]] = await pool.query(
      "SELECT SUM(monto) AS totalPagado FROM PagosSolicitud WHERE idSolicitud = ?",
      [idSolicitud]
    );

    // 🔽 LÓGICA DE COMPLETADO (ya existía)
    if (totalPagado >= solicitud.montoTotal) {
      await pool.query("UPDATE solicitud SET estado = 'FINALIZADO' WHERE idSolicitud = ?", [idSolicitud]);
    }

    res.json({ message: "Pago registrado con éxito", totalPagado });
  } catch (error) {
    console.error(" Error al registrar pago:", error);
    res.status(500).json({ error: "Error al registrar el pago" });
  }
});

/**
 * 🔹 4. Consultar solicitudes de PRÉSTAMO de un usuario
 */
router.get("/mis-solicitudes/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  try {
    const [solicitudes] = await pool.query(
      `SELECT s.*, c.clabe
       FROM solicitud s
       JOIN cuenta c ON s.idCuenta = c.idCuenta
       JOIN pertenece p ON c.idCuenta = p.idCuenta
       WHERE p.idUsuario = ? AND s.tipo LIKE 'PRESTAMO_%'
       ORDER BY s.fechaSolicitud DESC`,
      [idUsuario]
    );

    // Calcular saldos pendientes para cada solicitud
    for (const solicitud of solicitudes) {
      const [[{ totalPagado }]] = await pool.query(
        "SELECT SUM(monto) AS totalPagado FROM PagosSolicitud WHERE idSolicitud = ?",
        [solicitud.idSolicitud]
      );
      solicitud.totalPagado = totalPagado || 0;
      solicitud.saldoPendiente = solicitud.montoTotal - (solicitud.totalPagado || 0);
    }

    res.json(solicitudes);
  } catch (error) {
    console.error(" Error al consultar solicitudes de préstamo:", error);
    res.status(500).json({ error: "Error al consultar solicitudes" });
  }
});


// 🔽 ==== ¡SOLUCIÓN AL ERROR 404! ==== 🔽
/**
 * 🔹 5. Consultar pagos de una solicitud específica
 * (Este endpoint faltaba y causaba el error 404)
 */
router.get("/pagos/:idSolicitud", async (req, res) => {
  const { idSolicitud } = req.params;

  if (!idSolicitud) {
    return res.status(400).json({ error: "Se requiere un ID de solicitud" });
  }

  try {
    const [pagos] = await pool.query(
      "SELECT * FROM PagosSolicitud WHERE idSolicitud = ? ORDER BY fechaHora DESC",
      [idSolicitud]
    );

    // No es un error si no hay pagos, solo regresa un array vacío
    res.json(pagos);
  } catch (error) {
    console.error(" Error al consultar pagos:", error);
    res.status(500).json({ error: "Error al consultar los pagos" });
  }
});
// 🔼 =================================== 🔼

export default router;