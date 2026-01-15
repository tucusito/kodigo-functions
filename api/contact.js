// api/contact.js

// 1. Función para refrescar el token de Zoho
async function getAccessToken() {
  const url = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`;
  
  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();
  
  if (!data.access_token) {
    console.error("Error al renovar token:", data);
    throw new Error("No se pudo obtener el access_token de Zoho");
  }
  return data.access_token;
}

export default async function handler(req, res) {
  // 2. CONFIGURACIÓN DE CORS UNIVERSAL
  // Esto permite que tu web en HostGator se comunique sin bloqueos
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Responder a la petición de control (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo aceptamos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    // En Vercel, el body ya viene como objeto si el Content-Type fue application/json
    const body = req.body;
    
    // --- EXTRACCIÓN DE DATOS ---
    const nombre = body.nombre || "";
    const email = body.email || "";
    const apellido = body.apellido || "Suscripción"; 
    const telefono = body.telefono || "Sin Teléfono";
    const servicio = body.servicio || "General";
    const mensaje = body.mensaje || "Registro automático desde la web";

    // Validación básica
    if (!nombre || !email) {
      return res.status(400).json({ error: "El Nombre y el Email son obligatorios" });
    }

    // --- OBTENER TOKEN DE ACCESO ---
    const accessToken = await getAccessToken();

    // --- MAPEO DE DATOS PARA ZOHO CRM ---
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
          Lead_Status: servicio.includes('Newsletter') ? 'Suscrito' : 'Nuevo'
        }
      ],
      trigger: ["workflow"] // Esto activa correos automáticos si tienes en Zoho
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

    // --- RESPUESTA AL FRONTEND ---
    if (zohoResult.data && zohoResult.data[0].status === 'success') {
      return res.status(200).json({ 
        message: "Lead registrado con éxito en Zoho CRM",
        id: zohoResult.data[0].details.id 
      });
    } else {
      console.error("Zoho rechazó los datos:", JSON.stringify(zohoResult));
      return res.status(400).json({ 
        error: "Zoho rechazó el registro", 
        details: zohoResult.data ? zohoResult.data[0] : zohoResult 
      });
    }

  } catch (error) {
    console.error("Error crítico en la función:", error.message);
    return res.status(500).json({ 
      error: "Error interno en el servidor", 
      details: error.message 
    });
  }
}
