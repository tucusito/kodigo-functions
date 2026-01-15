// api/contact.js

// 1. Función para refrescar el token de Zoho (Se mantiene igual)
async function getAccessToken() {
  const url = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`;
  
  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("No se pudo obtener el access_token de Zoho");
  }
  return data.access_token;
}

export default async function handler(req, res) {
  // 2. CONFIGURACIÓN DE CORS (Vital para que HostGator pueda conectar)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://www.kodigolatinoamerica.com'); // Tu dominio en HostGator
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Si es una petición "preflight" (OPTIONS), respondemos OK y salimos
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Solo aceptamos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const body = req.body; // En Vercel Serverless, el body ya viene parseado
    
    // --- TU LÓGICA DE EXTRACCIÓN ---
    const nombre = body.nombre || "";
    const email = body.email || "";
    const apellido = body.apellido || "Suscripción"; 
    const telefono = body.telefono || "Sin Teléfono";
    const servicio = body.servicio || "General";
    const mensaje = body.mensaje || "Registro automático desde la web";

    if (!nombre || !email) {
      return res.status(400).json({ error: "El Nombre y el Email son obligatorios" });
    }

    // --- OBTENER TOKEN ---
    const accessToken = await getAccessToken();

    // --- MAPEO A ZOHO ---
    const leadData = {
      data: [
        {
          First_Name: nombre,
          Last_Name: apellido, 
          Email: email,
          Phone: telefono,
          Description: `Área de Interés: ${servicio}. Mensaje: ${mensaje}`,
          Lead_Source: "Web Kódigo Latinoamérica",
          Company: "Prospecto Web",
          Status: servicio.includes('Newsletter') ? 'Suscrito' : 'Nuevo'
        }
      ]
    };

    // --- ENVÍO A ZOHO ---
    const zohoResponse = await fetch('https://www.zohoapis.com/crm/v2/Leads', {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    });

    const zohoResult = await zohoResponse.json();

    // --- VERIFICACIÓN Y RESPUESTA FINAL ---
    if (zohoResult.data && zohoResult.data[0].status === 'success') {
      return res.status(200).json({ message: "Lead registrado con éxito en Zoho CRM" });
    } else {
      console.error("Zoho CRM rechazó el lead:", zohoResult);
      return res.status(400).json({ error: "Error en Zoho", details: zohoResult.data[0] });
    }

  } catch (error) {
    console.error("Error crítico:", error);
    return res.status(500).json({ error: "Error interno", details: error.message });
  }
}