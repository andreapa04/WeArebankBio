import express from "express";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import { enviarCorreoCierreCuenta } from "../../utils/mailer.js"; // Importante importar el mailer

const router = express.Router();

// =================================================================
// GESTIÓN DE EJECUTIVOS
// =================================================================

router.get("/ejecutivos", async (req, res) => {
  try {
    const [ejecutivos] = await pool.query(
      `SELECT idUsuario, nombre, apellidoP, apellidoM, email, estatus 
       FROM usuario WHERE idRol = 2 ORDER BY apellidoP, nombre`
    );
    res.json(ejecutivos);
  } catch (error) {
    res.status(500).json({ error: "Error al cargar ejecutivos" });
  }
});

router.post("/ejecutivos", async (req, res) => {
  const {
    nombre, apellidoP, apellidoM, direccion, telefono, email,
    contrasenia, fechaNacimiento, CURP, RFC, INE,
    preguntaSeguridad, respuestaSeguridad
  } = req.body;

  try {
    const hash = await bcrypt.hash(contrasenia, 10);
    const [result] = await pool.query(
      `INSERT INTO usuario (
         idRol, nombre, apellidoP, apellidoM, direccion, telefono,
         email, contrasenia, fechaNacimiento, CURP, RFC, INE,
         preguntaSeguridad, respuestaSeguridad, estatus, bloqueado, intentosFallidos
       ) VALUES (2, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', FALSE, 0)`,
      [nombre, apellidoP, apellidoM, direccion, telefono, email, hash, fechaNacimiento, CURP, RFC, INE, preguntaSeguridad, respuestaSeguridad]
    );

    const idUsuario = result.insertId;
    await pool.query(`INSERT INTO Usuario_Permiso (idUsuario, idPermiso) SELECT ?, idPermiso FROM Permisos`, [idUsuario]);

    res.status(201).json({ message: "Ejecutivo creado", idUsuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear ejecutivo" });
  }
});

router.delete("/ejecutivos/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;
  try {
    await pool.query("UPDATE usuario SET estatus = 'INACTIVO' WHERE idUsuario = ? AND idRol = 2", [idUsuario]);
    res.json({ message: "Ejecutivo desactivado" });
  } catch (error) {
    res.status(500).json({ error: "Error al desactivar ejecutivo" });
  }
});

// =================================================================
// GESTIÓN DE PERMISOS
// =================================================================

router.get("/permisos/catalogo", async (req, res) => {
  const [permisos] = await pool.query("SELECT * FROM Permisos ORDER BY nombrePermiso");
  res.json(permisos);
});

router.get("/permisos/ejecutivo/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;
  const [permisos] = await pool.query("SELECT idPermiso FROM Usuario_Permiso WHERE idUsuario = ?", [idUsuario]);
  res.json(permisos.map(p => p.idPermiso));
});

router.put("/permisos/ejecutivo/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;
  const { permisos } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query("DELETE FROM Usuario_Permiso WHERE idUsuario = ?", [idUsuario]);
    if (permisos.length > 0) {
      const values = permisos.map(id => [idUsuario, id]);
      await connection.query("INSERT INTO Usuario_Permiso (idUsuario, idPermiso) VALUES ?", [values]);
    }
    await connection.commit(); connection.release();
    res.json({ message: "Permisos actualizados" });
  } catch (e) {
    if(connection) await connection.rollback();
    res.status(500).json({ error: "Error" });
  }
});

// =================================================================
// GESTIÓN DE CLIENTES (Lógica de Ejecutivo agregada para Gerente)
// =================================================================

router.put("/cliente-detalle/:idUsuario", async (req, res) => {
  const { idUsuario } = req.params;
  const { nombre, apellidoP, apellidoM, direccion, telefono, email } = req.body;
  try {
    await pool.query(
      "UPDATE usuario SET nombre=?, apellidoP=?, apellidoM=?, direccion=?, telefono=?, email=? WHERE idUsuario=? AND idRol=3",
      [nombre, apellidoP, apellidoM, direccion, telefono, email, idUsuario]
    );
    res.json({ message: "Cliente actualizado" });
  } catch (e) { res.status(500).json({ error: "Error" }); }
});

// ⚠️ LOGICA DE CIERRE DE CUENTA (Copiada de ejecutivo.js)

// 1. Eliminar/Cerrar cuenta directamente
router.delete("/eliminar-cuenta/:idCuenta", async (req, res) => {
  const { idCuenta } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [p] = await connection.query("SELECT p.idUsuario, u.email, u.nombre FROM pertenece p JOIN usuario u ON p.idUsuario=u.idUsuario WHERE p.idCuenta=?", [idCuenta]);
    if (!p.length) throw new Error("Usuario no encontrado");
    const { idUsuario, email, nombre } = p[0];

    // Validar APROBADA
    const [s] = await connection.query("SELECT COUNT(*) as activos FROM solicitud s JOIN pertenece p ON s.idCuenta=p.idCuenta WHERE p.idUsuario=? AND s.estado='APROBADA'", [idUsuario]);
    
    if (s[0].activos > 0) {
      await connection.rollback(); connection.release();
      return res.status(400).json({ message: "Cliente tiene préstamos activos." });
    }

    await connection.query("UPDATE usuario SET estatus='INACTIVO' WHERE idUsuario=?", [idUsuario]);
    await connection.commit(); connection.release();
    await enviarCorreoCierreCuenta(email, nombre);
    res.json({ message: "Cuenta cerrada exitosamente." });

  } catch (e) {
    if(connection) await connection.rollback();
    res.status(500).json({ message: "Error al cerrar cuenta" });
  }
});

// 2. Listar solicitudes de cierre
router.get("/solicitudes-cierre", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT sc.idSolicitudCierre, sc.fechaSolicitud, u.idUsuario, u.nombre, u.apellidoP, u.email
      FROM solicitud_cierre sc JOIN usuario u ON sc.idUsuario = u.idUsuario
      WHERE sc.estado = 'PENDIENTE' ORDER BY sc.fechaSolicitud ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Error al cargar solicitudes" }); }
});

// 3. Procesar solicitud de cierre
router.post("/procesar-cierre", async (req, res) => {
  const { idSolicitudCierre, aprobado, razon_rechazo } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [sol] = await connection.query("SELECT idUsuario FROM solicitud_cierre WHERE idSolicitudCierre=?", [idSolicitudCierre]);
    if (!sol.length) throw new Error("Solicitud no encontrada");
    const idUsuario = sol[0].idUsuario;

    if (aprobado) {
      const [check] = await connection.query("SELECT COUNT(*) as activos FROM solicitud s JOIN pertenece p ON s.idCuenta=p.idCuenta WHERE p.idUsuario=? AND s.estado='APROBADA'", [idUsuario]);
      if (check[0].activos > 0) {
        await connection.rollback(); connection.release();
        return res.status(400).json({ message: "Préstamos activos, no se puede cerrar." });
      }
      await connection.query("UPDATE usuario SET estatus='INACTIVO' WHERE idUsuario=?", [idUsuario]);
      await connection.query("UPDATE solicitud_cierre SET estado='APROBADA' WHERE idSolicitudCierre=?", [idSolicitudCierre]);
      const [u] = await connection.query("SELECT email, nombre FROM usuario WHERE idUsuario=?", [idUsuario]);
      await enviarCorreoCierreCuenta(u[0].email, u[0].nombre);
    } else {
      await connection.query("UPDATE solicitud_cierre SET estado='RECHAZADA', razon_rechazo=? WHERE idSolicitudCierre=?", [razon_rechazo, idSolicitudCierre]);
    }

    await connection.commit(); connection.release();
    res.json({ message: aprobado ? "Cuenta cerrada." : "Rechazada." });
  } catch (e) {
    if(connection) await connection.rollback();
    res.status(500).json({ message: "Error procesando cierre" });
  }
});

export default router;