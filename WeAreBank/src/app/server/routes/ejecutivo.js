import express from "express";
import pool from "../db.js";
import { enviarCorreoCierreCuenta } from "../../utils/mailer.js";

const router = express.Router();

/**
 * 🔹 GET /api/ejecutivo/stats
 * Obtiene las estadísticas para el dashboard del ejecutivo
 */
router.get("/stats", async (req, res) => {
  try {
    const [[{ clientesActivos }]] = await pool.query(
      "SELECT COUNT(*) AS clientesActivos FROM usuario WHERE idRol = 3 AND estatus = 'ACTIVO'"
    );
    const [[{ prestamosOtorgados }]] = await pool.query(
      "SELECT COUNT(*) AS prestamosOtorgados FROM solicitud WHERE estado = 'APROBADA'"
    );
    const [[{ solicitudesMes }]] = await pool.query(
      "SELECT COUNT(*) AS solicitudesMes FROM solicitud WHERE MONTH(fechaSolicitud) = MONTH(NOW()) AND YEAR(fechaSolicitud) = YEAR(NOW())"
    );
    res.json({ clientesActivos, prestamosOtorgados, solicitudesMes });
  } catch (error) {
    console.error("Error al cargar stats:", error);
    res.status(500).json({ message: "Error al cargar estadísticas" });
  }
});

/**
 * 🔹 GET /api/ejecutivo/cartera-cuentas
 * Obtiene la lista de todos los clientes (rol 3) con sus cuentas principales
 */
router.get("/cartera-cuentas", async (req, res) => {
  try {
    const [cartera] = await pool.query(`
      SELECT
        c.idCuenta, c.clabe, c.tipoCuenta, c.saldo,
        u.idUsuario, u.nombre, u.apellidoP, u.apellidoM, u.email,
        u.telefono, u.direccion, u.RFC, u.CURP
      FROM cuenta c
      JOIN pertenece p ON c.idCuenta = p.idCuenta
      JOIN usuario u ON p.idUsuario = u.idUsuario
      WHERE u.idRol = 3
      ORDER BY u.apellidoP, c.idCuenta
    `);
    res.json(cartera);
  } catch (error) {
    console.error("Error al cargar cartera:", error);
    res.status(500).json({ message: "Error al cargar cartera de cuentas" });
  }
});

/**
 * 🔹 DELETE /api/ejecutivo/eliminar-cuenta/:idCuenta
 * Cierra la cuenta de un cliente (lo marca como INACTIVO)
 */
router.delete("/eliminar-cuenta/:idCuenta", async (req, res) => {
  const { idCuenta } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Obtener el idUsuario, email y nombre
    const [perteneceRows] = await connection.query(
      `SELECT p.idUsuario, u.email, u.nombre
       FROM pertenece p
       JOIN usuario u ON p.idUsuario = u.idUsuario
       WHERE p.idCuenta = ?`,
      [idCuenta]
    );
    if (perteneceRows.length === 0) {
      throw new Error("Usuario no encontrado");
    }
    const { idUsuario, email, nombre } = perteneceRows[0];

    // 2. Validar que no tenga préstamos o créditos activos (APROBADA)
    // ⚠️ CAMBIO: Si el estado es FINALIZADO, RECHAZADA o PAGADO, no cuenta como activo. Solo APROBADA bloquea el cierre.
    const [solicitudRows] = await connection.query(
      `SELECT COUNT(*) AS activos
       FROM solicitud s
       JOIN pertenece p ON s.idCuenta = p.idCuenta
       WHERE p.idUsuario = ? AND s.estado = 'APROBADA'`,
      [idUsuario]
    );

    if (solicitudRows[0].activos > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        message: "No se puede cerrar: Cliente tiene préstamos activos pendientes de pago.",
      });
    }

    // 3. Si no hay deudas activas, marcar al usuario como INACTIVO
    await connection.query(
      "UPDATE usuario SET estatus = 'INACTIVO' WHERE idUsuario = ?",
      [idUsuario]
    );

    await connection.commit();
    connection.release();

    // Enviar correo de notificación
    await enviarCorreoCierreCuenta(email, nombre);

    res.status(200).json({
        message: `El usuario (ID: ${idUsuario}) ha sido marcado como INACTIVO.`,
      });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error("Error al cerrar cuenta:", error);
    res.status(500).json({ message: "Error al procesar el cierre de la cuenta." });
  }
});

/**
 * 🔹 GET /api/ejecutivo/solicitudes-prestamo
 */
router.get("/solicitudes-prestamo", async (req, res) => {
  try {
    const [pendientes] = await pool.query(
      `SELECT s.*, u.nombre, u.apellidoP, u.email, b.puntaje
       FROM solicitud s
       JOIN cuenta c ON s.idCuenta = c.idCuenta
       JOIN pertenece p ON c.idCuenta = p.idCuenta
       JOIN usuario u ON p.idUsuario = u.idUsuario
       LEFT JOIN buro b ON u.idUsuario = b.idUsuario
       WHERE s.estado = 'EN_REVISION'
       ORDER BY s.fechaSolicitud ASC`
    );

    const [historial] = await pool.query(
      `SELECT s.*, u.nombre, u.apellidoP, u.email
       FROM solicitud s
       JOIN cuenta c ON s.idCuenta = c.idCuenta
       JOIN pertenece p ON c.idCuenta = p.idCuenta
       JOIN usuario u ON p.idUsuario = u.idUsuario
       WHERE s.estado != 'EN_REVISION'
       ORDER BY s.fechaSolicitud DESC
       LIMIT 50`
    );

    res.json({ pendientes, historial });
  } catch (error) {
    console.error("Error al cargar solicitudes:", error);
    res.status(500).json({ message: "Error al cargar solicitudes" });
  }
});

/**
 * 🔹 POST /api/ejecutivo/procesar-prestamo
 * Aprobación de crédito/préstamo.
 * - PRÉSTAMO: Suma saldo a la cuenta.
 * - CRÉDITO: Crea tarjeta de crédito o aumenta límite (NO suma saldo a cuenta).
 */
router.post("/procesar-prestamo", async (req, res) => {
  const { idSolicitud, aprobado } = req.body;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT * FROM solicitud WHERE idSolicitud = ?", [idSolicitud]);
    if (rows.length === 0) throw new Error("Solicitud no encontrada");

    const solicitud = rows[0];
    if (solicitud.estado !== "EN_REVISION")
      throw new Error("La solicitud ya fue procesada");

    const nuevoEstado = aprobado ? "APROBADA" : "RECHAZADA";

    await connection.query(
      "UPDATE solicitud SET estado = ? WHERE idSolicitud = ?",
      [nuevoEstado, idSolicitud]
    );

    if (aprobado) {
      // CASO 1: PRÉSTAMO (Dinero líquido a la cuenta)
      if (solicitud.tipo.startsWith("PRESTAMO_")) {
        await connection.query(
          "UPDATE cuenta SET saldo = saldo + ? WHERE idCuenta = ?",
          [solicitud.montoTotal, solicitud.idCuenta]
        );
        await connection.query(
          "INSERT INTO movimiento (idCuenta, monto, tipoMovimiento) VALUES (?, ?, 'ABONO_PRESTAMO')",
          [solicitud.idCuenta, solicitud.montoTotal]
        );
      }

      // CASO 2: CRÉDITO (Aumentar límite de tarjeta, NO tocar saldo de cuenta)
      if (solicitud.tipo.startsWith("CREDITO_")) {
        // Verificar si ya tiene tarjeta de crédito en esa cuenta
        const [tarjetas] = await connection.query(
          "SELECT * FROM tarjeta WHERE idCuenta = ? AND tipoTarjeta = 'CREDITO'",
          [solicitud.idCuenta]
        );

        if (tarjetas.length > 0) {
          // Ya tiene tarjeta: Aumentar el límite
          const tarjetaExistente = tarjetas[0];
          const nuevoLimite = parseFloat(tarjetaExistente.limiteCredito) + parseFloat(solicitud.montoTotal);

          await connection.query(
            "UPDATE tarjeta SET limiteCredito = ? WHERE idTarjeta = ?",
            [nuevoLimite, tarjetaExistente.idTarjeta]
          );
        } else {
          // No tiene tarjeta de crédito: Crear una nueva
          const numeroTarjeta =
            "5500" + Math.floor(100000000000 + Math.random() * 900000000000).toString().substring(0, 12);
          const cvv = Math.floor(100 + Math.random() * 900);
          const vencimiento = new Date();
          vencimiento.setFullYear(vencimiento.getFullYear() + 5);

          await connection.query(
            `INSERT INTO tarjeta (idCuenta, numeroTarjeta, vencimiento, cvv, tipoTarjeta, estado, limiteCredito, intereses, anualidad)
             VALUES (?, ?, ?, ?, 'CREDITO', 'ACTIVA', ?, ?, ?)`,
            [
              solicitud.idCuenta,
              numeroTarjeta,
              vencimiento,
              cvv,
              solicitud.montoTotal,
              solicitud.intereses,
              800, // Anualidad de ejemplo
            ]
          );
        }
        // NOTA: Para créditos NO insertamos movimiento en la cuenta de débito.
      }
    }

    await connection.commit();
    connection.release();
    res.json({ message: `Solicitud ${nuevoEstado} exitosamente.` });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error("Error al procesar solicitud:", error);
    res.status(500).json({ message: "Error al procesar la solicitud" });
  }
});

/**
 * 🔹 GET /api/ejecutivo/solicitudes-cierre
 */
router.get("/solicitudes-cierre", async (req, res) => {
  try {
    const [solicitudes] = await pool.query(`
      SELECT sc.idSolicitudCierre, sc.fechaSolicitud, u.idUsuario, u.nombre, u.apellidoP, u.email
      FROM solicitud_cierre sc
      JOIN usuario u ON sc.idUsuario = u.idUsuario
      WHERE sc.estado = 'PENDIENTE'
      ORDER BY sc.fechaSolicitud ASC
    `);
    res.json(solicitudes);
  } catch (error) {
    console.error("Error al cargar solicitudes de cierre:", error);
    res.status(500).json({ message: "Error al cargar solicitudes" });
  }
});

/**
 * 🔹 POST /api/ejecutivo/procesar-cierre
 * Aprueba o rechaza una solicitud de cierre
 */
router.post("/procesar-cierre", async (req, res) => {
  const { idSolicitudCierre, aprobado, razon_rechazo } = req.body;
  const idEjecutivo = 2; // ID de ejecutivo (puede venir del token)
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Obtener el idUsuario de la solicitud
    const [solRows] = await connection.query(
      "SELECT idUsuario FROM solicitud_cierre WHERE idSolicitudCierre = ?",
      [idSolicitudCierre]
    );
    if (solRows.length === 0) {
      throw new Error("Solicitud de cierre no encontrada");
    }
    const idUsuario = solRows[0].idUsuario;

    if (aprobado) {
      // 2. Validar que no tenga préstamos o créditos activos (APROBADA)
      const [solicitudRows] = await connection.query(
        `SELECT COUNT(*) AS activos
         FROM solicitud s
         JOIN pertenece p ON s.idCuenta = p.idCuenta
         WHERE p.idUsuario = ? AND s.estado = 'APROBADA'`,
        [idUsuario]
      );

      if (solicitudRows[0].activos > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          message:
            "Aprobación denegada: El cliente tiene préstamos activos. Rechaza la solicitud e informa al cliente.",
        });
      }

      // 3. Si no hay deudas activas, marcar al usuario como INACTIVO
      await connection.query(
        "UPDATE usuario SET estatus = 'INACTIVO' WHERE idUsuario = ?",
        [idUsuario]
      );

      // 4. Actualizar la solicitud de cierre
      await connection.query(
        "UPDATE solicitud_cierre SET estado = 'APROBADA', idEjecutivo = ? WHERE idSolicitudCierre = ?",
        [idEjecutivo, idSolicitudCierre]
      );

      // 5. Obtener datos para correo
      const [userRows] = await connection.query("SELECT nombre, email FROM usuario WHERE idUsuario = ?", [idUsuario]);
      const { nombre, email } = userRows[0];

      await connection.commit();
      connection.release();

      // 6. Enviar correo
      await enviarCorreoCierreCuenta(email, nombre);

      res.json({ message: "Solicitud de cierre aprobada. El usuario ha sido desactivado." });

    } else {
      // Rechazar la solicitud
      if (!razon_rechazo) {
        return res.status(400).json({ message: "Se requiere una razón para el rechazo." });
      }

      await connection.query(
        "UPDATE solicitud_cierre SET estado = 'RECHAZADA', idEjecutivo = ?, razon_rechazo = ? WHERE idSolicitudCierre = ?",
        [idEjecutivo, razon_rechazo, idSolicitudCierre]
      );

      await connection.commit();
      connection.release();
      res.json({ message: "Solicitud de cierre rechazada." });
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error("Error al procesar cierre:", error);
    res.status(500).json({ message: "Error al procesar la solicitud" });
  }
});

/**
 * 🔹 GET /api/ejecutivo/clientes-consulta
 */
router.get("/clientes-consulta", async (req, res) => {
  try {
    const [clientes] = await pool.query(
      `SELECT idUsuario, nombre, apellidoP, apellidoM, email, telefono, RFC, CURP, direccion
       FROM usuario WHERE idRol = 3
       ORDER BY apellidoP, nombre`
    );
    res.json(clientes);
  } catch (error) {
    console.error("Error al cargar lista de clientes:", error);
    res.status(500).json({ message: "Error al cargar clientes" });
  }
});

/**
 * 🔹 GET /api/ejecutivo/cliente-detalle/:idUsuario
 */
router.get("/cliente-detalle/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;
  try {
    const [cuentas] = await pool.query(
      `SELECT c.idCuenta, c.clabe, c.tipoCuenta, c.saldo
       FROM cuenta c
       JOIN pertenece p ON c.idCuenta = p.idCuenta
       WHERE p.idUsuario = ?`,
      [idUsuario]
    );

    // Obtener movimientos
    const [movimientos] = await pool.query(
      `SELECT m.idMovimiento, m.fechaHora, m.tipoMovimiento, m.monto
       FROM movimiento m
       JOIN pertenece p ON m.idCuenta = p.idCuenta
       WHERE p.idUsuario = ?
       ORDER BY m.fechaHora DESC
       LIMIT 50`,
      [idUsuario]
    );

    res.json({ cuentas, movimientos });
  } catch (error) {
    console.error("Error al cargar detalle de cliente:", error);
    res.status(500).json({ message: "Error al cargar detalle" });
  }
});

/**
 * 🔹 PUT /api/ejecutivo/cliente-detalle/:idUsuario
 * Ejecutivo actualiza datos de un cliente (Rol 3)
 */
router.put("/cliente-detalle/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;
  const { nombre, apellidoP, apellidoM, direccion, telefono, email } = req.body;

  if (!nombre || !apellidoP || !apellidoM || !direccion || !telefono || !email) {
    return res.status(400).json({ error: "Todos los campos editables son requeridos." });
  }

  try {
    const [result] = await pool.query(
      `UPDATE usuario
       SET nombre = ?, apellidoP = ?, apellidoM = ?, direccion = ?, telefono = ?, email = ?
       WHERE idUsuario = ? AND idRol = 3`,
      [nombre, apellidoP, apellidoM, direccion, telefono, email, idUsuario]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Cliente no encontrado o sin cambios." });
    }

    // Auditoría
    await pool.query(
      `INSERT INTO Auditoria (idUsuarioResponsable, tipoEvento, descripcion, idEntidadAfectada, tablaAfectada)
       VALUES (2, 'MODIFICACION_CLIENTE', ?, ?, 'usuario')`, // ID ejecutivo hardcodeado a 2 por ahora
      [`Ejecutivo modificó datos del cliente ID: ${idUsuario}`, idUsuario]
    );

    res.json({ message: "Datos del cliente actualizados correctamente" });
  } catch (error) {
    console.error("Error al actualizar cliente:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "El email ya está en uso por otra cuenta." });
    }
    res.status(500).json({ error: "Error interno al actualizar cliente." });
  }
});

export default router;
