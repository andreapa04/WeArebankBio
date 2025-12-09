import nodemailer from "nodemailer";

// Configuración del transporter (reutilizable)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "andreaperezare@gmail.com", // Tu correo
    pass: "iptc rvln sbqk qcge", // Tu contraseña de app
  },
});

/**
 * 🔹 Correo para Transferencias, Depósitos y Pagos
 */
export async function enviarCorreoMovimiento(destinatario, tipo, monto, clabe) {
  let subject = '';
  let textBody = '';

  // Lógica para personalizar el correo según el tipo de movimiento
  if (tipo.startsWith('PAGO_SERVICIO:')) {
    const servicioPagado = tipo.split(': ')[1] || 'un servicio';
    subject = `Comprobante de Pago: ${servicioPagado}`;
    textBody = `Hola,\n\nSe ha realizado un pago de servicio desde tu cuenta CLABE ${clabe}.\n\n- Servicio: ${servicioPagado}\n- Monto: $${monto.toFixed(2)} MXN\n\nGracias por usar WeAreBank.`;
  
  } else if (tipo.startsWith('PAGO_PRESTAMO:')) {
    const prestamoTipo = tipo.split(': ')[1] || 'un préstamo';
    subject = `Comprobante de Abono: ${prestamoTipo}`;
    textBody = `Hola,\n\nSe ha realizado un abono a tu ${prestamoTipo} desde tu cuenta CLABE ${clabe}.\n\n- Monto: $${monto.toFixed(2)} MXN\n\nGracias por usar WeAreBank.`;
  
  } else if (tipo === 'TRANSFERENCIA_RECIBIDA') {
    subject = 'Notificación: Has recibido una transferencia';
    textBody = `Hola,\n\n¡Buenas noticias! Tu cuenta CLABE ${clabe} ha recibido una transferencia por $${monto.toFixed(2)} MXN.\n\nGracias por usar WeAreBank.`;
  
  } else if (tipo.includes('TRANSFERENCIA_ENVIADA') || tipo === 'TRANSFERENCIA') {
    subject = 'Notificación de Transferencia Enviada';
    textBody = `Tu cuenta ${clabe} ha realizado una TRANSFERENCIA ENVIADA por $${monto.toFixed(2)}.`;
  
  } else if (tipo === 'DEPÓSITO') {
    subject = 'Notificación de Depósito Recibido';
    textBody = `Hola,\n\n¡Buenas noticias! Tu cuenta CLABE ${clabe} ha recibido un ${tipo} por $${monto.toFixed(2)}.\n\nGracias por usar WeAreBank.`;
  
  } else {
    // Fallback genérico
    subject = `Movimiento: ${tipo}`;
    textBody = `Tu cuenta ${clabe} ha realizado un movimiento de tipo ${tipo} por $${monto.toFixed(2)}.`;
  }

  try {
    const info = await transporter.sendMail({
      from: '"WeAreBank" <andreaperezare@gmail.com>',
      to: destinatario,
      subject: subject,
      text: textBody, // Usamos 'text' para correos simples
    });

    console.log("Correo de movimiento enviado:", info.messageId);
  } catch (err) {
    console.error("Error al enviar correo de movimiento:", err.message);
  }
}

/**
 * 🔹 Correo para Retiros (Alerta o Código)
 */
export async function enviarCorreoRetiro(destinatario, tipo, monto, clabe, codigo) {
  let subject = '';
  let htmlBody = '';

  if (tipo === 'CODIGO') {
    subject = 'Código para Retiro Sin Tarjeta';
    htmlBody = `
      <p>Hola,</p>
      <p>Has generado un <b>retiro sin tarjeta</b> para tu cuenta CLABE ${clabe}.</p>
      <p>El monto del retiro es: <b>$${monto.toFixed(2)} MXN</b>.</p>
      <p>Usa el siguiente código en cualquier cajero WeAreBank:</p>
      <h2 style="color: #5D5B9D; font-size: 28px; text-align: center;">${codigo}</h2>
      <p>Este código es válido por 30 minutos.</p>
    `;
  } else { // tipo === 'ALERTA'
    subject = 'Alerta de Retiro en Cajero';
    htmlBody = `
      <p>Hola,</p>
      <p>Detectamos un <b>retiro en cajero</b> de tu cuenta CLABE ${clabe}.</p>
      <p>El monto retirado fue: <b>$${monto.toFixed(2)} MXN</b>.</p>
      <p>Si no reconoces este movimiento, por favor contacta a soporte inmediatamente.</p>
    `;
  }

  try {
    const info = await transporter.sendMail({
      from: '"WeAreBank" <andreaperezare@gmail.com>',
      to: destinatario,
      subject: subject,
      html: htmlBody, // Usamos HTML para mejor formato
    });

    console.log("Correo de retiro enviado:", info.messageId);
  } catch (err) {
    console.error("Error al enviar correo de retiro:", err.message);
  }
}


// 🔽 --- ¡NUEVA FUNCIÓN! --- 🔽
/**
 * 🔹 Correo para Cierre de Cuenta
 * Notifica al usuario que su cuenta ha sido marcada como INACTIVA
 */
export async function enviarCorreoCierreCuenta(destinatario, nombre) {
  const subject = 'Notificación de Cierre de Cuenta - WeAreBank';
  const htmlBody = `
    <p>Hola, <b>${nombre}</b>,</p>
    <p>Te informamos que tu cuenta en WeAreBank ha sido <b>cerrada y marcada como INACTIVA</b> en nuestro sistema, de acuerdo a la solicitud procesada por nuestros ejecutivos.</p>
    <p>Ya no podrás iniciar sesión con tus credenciales. Si crees que esto es un error o deseas más información, por favor, contacta a nuestra línea de soporte.</p>
    <p>Agradecemos tu tiempo con nosotros.</p>
    <br>
    <p>Atentamente,<br>El equipo de WeAreBank</p>
  `;

  try {
    const info = await transporter.sendMail({
      from: '"WeAreBank" <andreaperezare@gmail.com>',
      to: destinatario,
      subject: subject,
      html: htmlBody,
    });

    console.log("Correo de cierre de cuenta enviado:", info.messageId);
  } catch (err) {
    console.error("Error al enviar correo de cierre de cuenta:", err.message);
  }
}