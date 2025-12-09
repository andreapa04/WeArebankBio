import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * POST /api/creditos/solicitar
 * Crea una nueva solicitud de crédito (SIEMPRE EN REVISIÓN)
 */
router.post("/solicitar", async (req, res) => {
  const { idCuenta, montoTotal, plazo, tipo } = req.body;

  if (!idCuenta || !montoTotal || montoTotal <= 0 || !plazo || !tipo || !tipo.startsWith('CREDITO_')) {
    return res.status(400).json({ error: "Datos incompletos o inválidos" });
  }

  try {
    // 1️⃣ Obtener usuario dueño de la cuenta
    const [usuarioRows] = await pool.query(
      `SELECT u.idUsuario, u.nombre, u.apellidoP
       FROM usuario u
       JOIN pertenece p ON u.idUsuario = p.idUsuario
       WHERE p.idCuenta = ?`,
      [idCuenta]
    );

    if (usuarioRows.length === 0) {
      return res.status(404).json({ error: "Cuenta no encontrada o sin dueño" });
    }

    const usuario = usuarioRows[0];

    // 2️⃣ Revisar buró
    const [buroRows] = await pool.query(
      "SELECT puntaje FROM buro WHERE idUsuario = ?",
      [usuario.idUsuario]
    );

    if (buroRows.length === 0) {
      return res.status(400).json({ error: "No se encontró historial de buró de crédito" });
    }

    const puntaje = buroRows[0].puntaje;

    // 3️⃣ Verificar si ya tiene una solicitud en revisión
    const [pendientes] = await pool.query(
      `SELECT COUNT(*) AS total FROM solicitud
       WHERE idCuenta = ? AND estado = 'EN_REVISION'`,
      [idCuenta]
    );

    if (pendientes[0].total > 0) {
      return res.status(400).json({
        error: "Ya tienes una solicitud en revisión, espera su resultado.",
      });
    }

    // 4️⃣ Calcular tasas (Solo informativo, el estado inicial siempre es EN_REVISION)
    let intereses = 0;
    let cat = 0;
    let estado = "EN_REVISION"; // ⚠️ CAMBIO: Siempre pasa a revisión primero

    if (puntaje >= 750) {
      intereses = 10.5;
      cat = 13.5;
    } else if (puntaje >= 650) {
      intereses = 14.0;
      cat = 17.5;
    } else {
      // Si el puntaje es muy bajo, se rechaza automáticamente
      estado = "RECHAZADA";
      intereses = 0;
      cat = 0;
    }

    // 5️⃣ Insertar solicitud
    const [result] = await pool.query(
      `INSERT INTO solicitud (idCuenta, estado, montoTotal, plazo, intereses, cat, tipo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idCuenta, estado, montoTotal, plazo, intereses, cat, tipo]
    );

    const idSolicitud = result.insertId;

    res.json({
      message: estado === "RECHAZADA" 
        ? "Tu solicitud ha sido rechazada debido al historial crediticio."
        : "Solicitud enviada exitosamente. Un ejecutivo la revisará pronto.",
      estado,
      idSolicitud,
      puntaje,
      intereses,
      cat,
    });
  } catch (error) {
    console.error(" Error al registrar solicitud:", error);
    res.status(500).json({ error: "Error interno al procesar la solicitud." });
  }
});

/**
 * GET /api/creditos/mis-solicitudes/:idUsuario
 */
router.get("/mis-solicitudes/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;

  try {
    const [solicitudes] = await pool.query(
      `SELECT s.*, c.clabe
       FROM solicitud s
       JOIN cuenta c ON s.idCuenta = c.idCuenta
       JOIN pertenece p ON c.idCuenta = p.idCuenta
       WHERE p.idUsuario = ? AND s.tipo LIKE 'CREDITO_%'
       ORDER BY s.fechaSolicitud DESC`,
      [idUsuario]
    );

    res.json(solicitudes);
  } catch (error) {
    console.error(" Error al obtener solicitudes:", error);
    res.status(500).json({ error: "Error al cargar solicitudes" });
  }
});

export default router;