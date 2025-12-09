import express from "express";
import pool from "../db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, contrasenia } = req.body;
    if (!email || !contrasenia)
      return res.status(400).json({ error: "Email y contraseña son requeridos" });

    const [rows] = await pool.query(
      "SELECT idUsuario, nombre, apellidoP, apellidoM, idRol, contrasenia, intentosFallidos, bloqueado, estatus FROM usuario WHERE email = ?",
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ error: "Correo no registrado" });

    const user = rows[0];

    if (user.estatus != "ACTIVO")
      return res.status(403).json({ error: "Cuenta bloqueada." });

    if (user.bloqueado)
      return res.status(403).json({ error: "Cuenta cerrada." });

    const coincide = await bcrypt.compare(contrasenia, user.contrasenia);

    if (!coincide) {
      const nuevosIntentos = user.intentosFallidos + 1;
      // ... lógica de bloqueo ...
      if (nuevosIntentos >= 3) {
        await pool.query("UPDATE usuario SET bloqueado = TRUE, intentosFallidos = ? WHERE idUsuario = ?", [nuevosIntentos, user.idUsuario]);
        return res.status(403).json({ error: "Cuenta bloqueada tras 3 intentos." });
      } else {
        await pool.query("UPDATE usuario SET intentosFallidos = ? WHERE idUsuario = ?", [nuevosIntentos, user.idUsuario]);
        return res.status(401).json({ error: "Contraseña incorrecta." });
      }
    }

    await pool.query("UPDATE usuario SET intentosFallidos = 0 WHERE idUsuario = ?", [user.idUsuario]);

    // Cargar permisos
    let permisos = [];
    if (user.idRol === 2 || user.idRol === 1) {
      let queryPermisos = (user.idRol === 1) 
        ? `SELECT nombrePermiso FROM Permisos`
        : `SELECT p.nombrePermiso FROM Usuario_Permiso up JOIN Permisos p ON up.idPermiso = p.idPermiso WHERE up.idUsuario = ?`;
      const [permisosRows] = await pool.query(queryPermisos, [user.idUsuario]);
      permisos = permisosRows.map(p => p.nombrePermiso);
    }

    res.json({
      message: "✅ Login exitoso",
      user: {
        id: user.idUsuario,
        nombre: user.nombre,
        apellidoP: user.apellidoP,
        rol: user.idRol,
        permisos: permisos
      },
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

/**
 * RECUPERAR CONTRASEÑA
 */
router.post("/recuperar", async (req, res) => {
  const { email } = req.body;
  const [rows] = await pool.query(
    "SELECT preguntaSeguridad, bloqueado FROM usuario WHERE email = ?",
    [email]
  );
  if (rows.length === 0)
    return res.status(404).json({ error: "Correo no encontrado" });

  res.json({ preguntaSeguridad: rows[0].preguntaSeguridad, bloqueado: rows[0].bloqueado});
});

// Verificar respuesta
router.post("/verificar-respuesta", async (req, res) => {
  const { email, respuesta } = req.body;
  const [rows] = await pool.query(
    "SELECT respuestaSeguridad FROM usuario WHERE email = ?",
    [email]
  );

  if (rows.length === 0)
    return res.status(404).json({ error: "Correo no encontrado" });

  if (rows[0].respuestaSeguridad.toLowerCase() !== respuesta.toLowerCase())
    return res.status(401).json({ error: "Respuesta incorrecta" });

  res.json({ message: "Respuesta correcta" });
});

// Resetear contraseña
router.post("/reset-password", async (req, res) => {
  const { email, nuevaContrasenia } = req.body;
  const hash = await bcrypt.hash(nuevaContrasenia, 10);
  await pool.query("UPDATE usuario SET contrasenia = ?, intentosFallidos = 0, bloqueado = FALSE WHERE email = ?", [hash, email]);
  res.json({ message: "Contraseña actualizada correctamente" });
});

/**
 * REGISTRO DE CLIENTES (Rol 3)
 * Llama al Stored Procedure
 */
router.post("/register", async (req, res) => {
  try {
    const {
      nombre, apellidoP, apellidoM, direccion, telefono, email,
      contrasenia, fechaNacimiento, CURP, RFC, INE,
      preguntaSeguridad, respuestaSeguridad
    } = req.body;

    // Encriptar contraseña antes de guardar
    const hash = await bcrypt.hash(contrasenia, 10);

    // Ejecutar el procedimiento almacenado
    await pool.query(
      `CALL registrar_usuario_completo(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre, apellidoP, apellidoM, direccion, telefono, email,
        hash, fechaNacimiento, CURP, RFC, INE,
        preguntaSeguridad, respuestaSeguridad
      ]
    );

    res.status(201).json({
      message: "Usuario registrado correctamente con cuenta y tarjeta asignadas."
    });

  } catch (error) {
    console.error("❌ Error en /register:", error);
    res.status(500).json({ message: "Error al registrar el usuario." });
  }
});

export default router;