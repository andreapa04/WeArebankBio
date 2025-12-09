// Es el punto de entrada principal del backend
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js"; // importa el router de login
import transferenciasRoutes from "./routes/transferencias.js";
import movimientosRoutes from "./routes/movimientos.js";
import creditosRoutes from "./routes/creditos.js";
import prestamosRoutes from "./routes/prestamos.js";
import pagosRoutes from "./routes/pagos.js";
import retirosRoutes from "./routes/retiros.js";
import consultasRoutes from "./routes/consultas.js";
import ejecutivoRoutes from "./routes/ejecutivo.js";
import gerenteRoutes from "./routes/gerente.js";

//se arranca el servidor Express.
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Montar rutas de autenticación
app.use("/api/auth", authRoutes);
app.use("/api/transferencias", transferenciasRoutes);
app.use("/api/movimientos", movimientosRoutes);
app.use("/api/creditos", creditosRoutes);
app.use("/api/prestamos", prestamosRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/retiros", retirosRoutes);
app.use("/api/consultas", consultasRoutes);
app.use("/api/ejecutivo", ejecutivoRoutes);
app.use("/api/gerente", gerenteRoutes);


// 🔹 Endpoint de prueba (verificar servidor corriendo)
app.get("/", (req, res) => {
  // Corregido: espaciado normal
  res.send("Servidor corriendo correctamente 🚀");
});

// 🔹 Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});