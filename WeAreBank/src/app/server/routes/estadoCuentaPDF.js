import PDFDocument from "pdfkit";

/**
 * 🔹 Genera un PDF del estado de cuenta con todos los movimientos del mes
 */
export const generarEstadoCuentaPDF = (datosCuenta, movimientos, usuario) => {
  return new Promise((resolve, reject) => {
    try {
      // Colores del tema
      const colores = {
        primary: "#241c45",
        secondary: "#31296E",
        accent: "#443A8C",
        light: "#5D5B9D",
        medium: "#3A2D65",
      };

      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ===== ENCABEZADO =====
      doc
        .fillColor(colores.primary)
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("WeAreBank", { align: "center" })
        .moveDown(0.3);

      doc
        .fillColor(colores.secondary)
        .fontSize(16)
        .font("Helvetica")
        .text("Estado de Cuenta Bancario", { align: "center" })
        .moveDown(1);

      // Línea separadora
      doc
        .moveTo(50, doc.y)
        .lineTo(562, doc.y)
        .strokeColor(colores.accent)
        .lineWidth(2)
        .stroke()
        .moveDown(1);

      // ===== INFORMACIÓN DEL CLIENTE =====
      doc
        .fillColor(colores.primary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("INFORMACIÓN DEL TITULAR", { underline: true })
        .moveDown(0.5);

      doc
        .fillColor("#000000")
        .fontSize(10)
        .font("Helvetica")
        .text(`Nombre: ${usuario.nombre} ${usuario.apellidoP} ${usuario.apellidoM}`)
        .text(`RFC: ${usuario.RFC}`)
        .text(`Email: ${usuario.email}`)
        .moveDown(1);

      // ===== INFORMACIÓN DE LA CUENTA =====
      doc
        .fillColor(colores.primary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("INFORMACIÓN DE LA CUENTA", { underline: true })
        .moveDown(0.5);

      doc
        .fillColor("#000000")
        .fontSize(10)
        .font("Helvetica")
        .text(`CLABE: ${datosCuenta.clabe}`)
        .text(`Tipo de Cuenta: ${datosCuenta.tipoCuenta}`)
        .text(`Saldo Actual: $${parseFloat(datosCuenta.saldo).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`)
        .moveDown(0.5);

      const fechaActual = new Date().toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(`Fecha de Emisión: ${fechaActual}`).moveDown(1.5);

      // ===== ENCABEZADO DE TABLA =====
      doc
        .fillColor(colores.primary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("MOVIMIENTOS DEL MES", { underline: true })
        .moveDown(0.8);

      const tableTop = doc.y;
      const colWidths = {
        fecha: 100,
        tipo: 140,
        monto: 80,
        saldo: 80,
      };

      // Dibujar encabezado de tabla con fondo
      doc
        .rect(50, tableTop, 512, 25)
        .fillColor(colores.secondary)
        .fill();

      doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("FECHA", 55, tableTop + 8, { width: colWidths.fecha, align: "left" })
        .text("TIPO DE MOVIMIENTO", 155, tableTop + 8, { width: colWidths.tipo, align: "left" })
        .text("MONTO", 295, tableTop + 8, { width: colWidths.monto, align: "right" })
        .text("SALDO", 375, tableTop + 8, { width: colWidths.saldo, align: "right" });

      let yPosition = tableTop + 30;
      let saldoActual = parseFloat(datosCuenta.saldo);

      // Calcular saldo inicial (restando todos los movimientos)
      movimientos.forEach((mov) => {
        saldoActual -= parseFloat(mov.monto);
      });

      // ===== FILAS DE MOVIMIENTOS =====
      doc.font("Helvetica").fontSize(9);

      movimientos.forEach((movimiento, index) => {
        // Verificar si necesitamos una nueva página
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        saldoActual += parseFloat(movimiento.monto);
        const fecha = new Date(movimiento.fechaHora).toLocaleDateString("es-MX");
        const monto = parseFloat(movimiento.monto);
        const montoFormateado = `${monto >= 0 ? "+" : ""}$${Math.abs(monto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
        const saldoFormateado = `$${saldoActual.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

        // Alternar color de fondo para filas
        const bgColor = index % 2 === 0 ? "#F5F5F5" : "#FFFFFF";
        doc.rect(50, yPosition - 5, 512, 20).fillColor(bgColor).fill();

        // Color del texto según tipo de movimiento
        const colorTexto = monto >= 0 ? "#006400" : "#8B0000";

        doc
          .fillColor("#000000")
          .text(fecha, 55, yPosition, { width: colWidths.fecha, align: "left" })
          .text(movimiento.tipoMovimiento, 155, yPosition, { width: colWidths.tipo, align: "left" })
          .fillColor(colorTexto)
          .text(montoFormateado, 295, yPosition, { width: colWidths.monto, align: "right" })
          .fillColor("#000000")
          .text(saldoFormateado, 375, yPosition, { width: colWidths.saldo, align: "right" });

        yPosition += 20;
      });

      // ===== RESUMEN FINAL =====
      yPosition += 20;
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }

      doc
        .moveTo(50, yPosition)
        .lineTo(562, yPosition)
        .strokeColor(colores.accent)
        .lineWidth(1)
        .stroke();

      yPosition += 15;

      doc
        .fillColor(colores.primary)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("RESUMEN", 50, yPosition)
        .moveDown(0.5);

      const totalIngresos = movimientos
        .filter((m) => parseFloat(m.monto) > 0)
        .reduce((sum, m) => sum + parseFloat(m.monto), 0);

      const totalEgresos = movimientos
        .filter((m) => parseFloat(m.monto) < 0)
        .reduce((sum, m) => sum + Math.abs(parseFloat(m.monto)), 0);

      doc
        .fillColor("#000000")
        .fontSize(10)
        .font("Helvetica")
        .text(`Total de Movimientos: ${movimientos.length}`)
        .text(`Total Ingresos: $${totalIngresos.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`)
        .text(`Total Egresos: $${totalEgresos.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`)
        .moveDown(2);

      // ===== PIE DE PÁGINA =====
      doc
        .fontSize(8)
        .fillColor(colores.light)
        .text(
          "Este documento es un estado de cuenta generado electrónicamente y no requiere firma autógrafa.",
          50,
          750,
          { align: "center", width: 512 }
        )
        .text("WeAreBank © 2025 - Todos los derechos reservados", { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
