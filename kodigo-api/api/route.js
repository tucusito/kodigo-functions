import { NextResponse } from 'next/server';

// Función para refrescar el token de Zoho
async function getAccessToken() {
  const url = `https://accounts.zoho.com/oauth/v2/token?refresh_token=${process.env.ZOHO_REFRESH_TOKEN}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`;
  
  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("No se pudo obtener el access_token de Zoho");
  }
  return data.access_token;
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // 1. Extracción con valores por defecto para evitar errores de validación
    // Si apellido o telefono no vienen (como en el newsletter), se asignan valores genéricos
    const nombre = body.nombre || "";
    const email = body.email || "";
    const apellido = body.apellido || "Suscripción"; 
    const telefono = body.telefono || "Sin Teléfono";
    const servicio = body.servicio || "General";
    const mensaje = body.mensaje || "Registro automático desde la web";

    // 2. Validación de campos críticos (Mínimos necesarios para que Zoho y tú tengan datos útiles)
    if (!nombre || !email) {
      return NextResponse.json(
        { error: "El Nombre y el Email son obligatorios para el registro" },
        { status: 400 }
      );
    }

    // 3. Obtener Token
    const accessToken = await getAccessToken();

    // 4. Mapeo profesional a Zoho CRM
    // Zoho exige "Last_Name" y "Company" como campos obligatorios por defecto
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
          // Etiqueta para identificar rápidamente si es Newsletter en el CRM
          Status: servicio.includes('Newsletter') ? 'Suscrito' : 'Nuevo'
        }
      ]
    };

    // 5. Envío a la API de Leads de Zoho
    const zohoResponse = await fetch('https://www.zohoapis.com/crm/v2/Leads', {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    });

    const zohoResult = await zohoResponse.json();

    // 6. Verificación de la respuesta de Zoho
    if (zohoResult.data && zohoResult.data[0].status === 'success') {
      return NextResponse.json(
        { message: "Lead registrado con éxito en Zoho CRM" },
        { status: 200 }
      );
    } else {
      console.error("Zoho CRM rechazó el lead:", zohoResult);
      return NextResponse.json(
        { error: "Error en la validación de Zoho", details: zohoResult.data[0] },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Error crítico en el servidor:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 }
    );
  }
}