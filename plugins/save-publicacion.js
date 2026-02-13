import fs from 'fs/promises'
import path from 'path'

const defaultPublication = () => ({
  enabled: false,
  image: '',
  text: '',
  imageType: '',
  interval: 600000,
  savedBy: '',
  savedAt: '',
  activatedBy: '',
  activatedAt: '',
  timeSetBy: '',
  timeSetAt: ''
})

const ensureChatConfig = (chatId) => {
  if (!global.db.data.publicaciones) global.db.data.publicaciones = {}
  
  if (!global.db.data.publicaciones[chatId]) {
    global.db.data.publicaciones[chatId] = { publications: [] }
  }
  
  const cfg = global.db.data.publicaciones[chatId]
  
  if (cfg.publication && !cfg.publications) {
    cfg.publications = [cfg.publication]
    delete cfg.publication
  }
  
  if (!Array.isArray(cfg.publications)) {
    cfg.publications = []
  }
  
  global.db.data.publicaciones[chatId] = cfg
  return cfg
}

const getSelectedGroups = (chatId) => {
  if (!global.db.data.publicaciones?.[chatId]?.selectedGroups) {
    return [];
  }
  return [...global.db.data.publicaciones[chatId].selectedGroups];
}

let handler = async (m, { conn, usedPrefix, isOwner, args }) => {
  try {
    if (m.isGroup) {
      return conn.sendMessage(m.chat, { 
        text: '⚠️ Por favor, usa este comando en el chat privado con el bot.'
      }, { quoted: m })
    }
    
    if (!isOwner) {
      return conn.sendMessage(m.chat, { 
        text: '❌ *Acceso denegado*: Solo los propietarios pueden usar este comando.'
      }, { quoted: m })
    }
    
    if (!m.quoted) {
      const help = `📝 *Guardar Publicación*\n\n` +
        `*Uso:*\n` +
        `1. Primero selecciona un grupo con:\n` +
        `   ${usedPrefix}grupos\n` +
        `2. Luego responde a un mensaje con:\n` +
        `   ${usedPrefix}savep\n\n` +
        `*Nota:* La publicación se guardará en todos los grupos seleccionados.`
      
      return conn.sendMessage(m.chat, { text: help }, { quoted: m })
    }
    
    const selectedGroups = getSelectedGroups(m.chat);
    if (selectedGroups.length === 0) {
      return conn.sendMessage(m.chat, { 
        text: `❌ *Error*: No hay grupos seleccionados.\n\n` +
              `Usa ${usedPrefix}grupos para ver la lista de grupos y seleccionar uno o más.\n` +
              `Ejemplo: ${usedPrefix}grupos all - para seleccionar todos los grupos`
      }, { quoted: m });
    }
    
    if (!m.quoted.mimetype || !m.quoted.mimetype.startsWith('image') && !m.quoted.mimetype.startsWith('video')) {
      return conn.sendMessage(m.chat, { 
        text: '❌ *Error*: El mensaje debe contener una imagen o video.'
      }, { quoted: m });
    }
    
    let imageBuffer;
    let imageType = 'image';
    
    try {
      imageBuffer = await m.quoted.download();
      imageType = m.quoted.mimetype.startsWith('video') ? 'video' : 'image';
    } catch (e) {
      console.error('Error al descargar el archivo:', e);
      return conn.sendMessage(m.chat, { 
        text: '❌ *Error*: No se pudo descargar el archivo. Intenta enviarlo de nuevo.'
      }, { quoted: m });
    }
    
    const text = m.quoted.caption || m.quoted.text || '';
    const savedBy = m.pushName || m.sender.split('@')[0];
    const savedAt = new Date().toISOString();
    
    const extension = imageType === 'video' ? '.mp4' : '.png'
    const timestamp = Date.now()
    const safeName = savedBy.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `${timestamp}_${safeName}${extension}`
    const filePath = path.join(process.cwd(), 'storage', 'images', fileName)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, imageBuffer)
    const imagePath = `storage/images/${fileName}`
    
    let successCount = 0;
    const results = [];
    
    for (const groupId of selectedGroups) {
      try {
        const cfg = ensureChatConfig(groupId);
        
        const groupName = await conn.getName(groupId).catch(() => `Grupo ${groupId}`);
        
        cfg.publications.push({
          image: imagePath,
          text: text,
          imageType: imageType,
          savedBy: savedBy,
          savedAt: savedAt
        });
        
        results.push({
          groupName,
          success: true
        });
        
        successCount++;
      } catch (e) {
        console.error(`Error al guardar en grupo ${groupId}:`, e);
        results.push({
          groupId,
          success: false,
          error: e.message
        });
      }
    }
    
    await global.db.write();
    
    let resultMessage = `✅ *Publicación guardada en ${successCount} grupo(s)*\n\n`;
    
    results.forEach(result => {
      if (result.success) {
        resultMessage += `✅ *${result.groupName}*\n`;
      } else {
        resultMessage += `❌ *${result.groupId}*: ${result.error || 'Error desconocido'}\n`;
      }
    });
    
    resultMessage += `\nUsa ${usedPrefix}publicg on para activar las publicaciones.`;
    
    return conn.sendMessage(m.chat, { text: resultMessage }, { quoted: m });
  } catch (e) {
    console.error('Error en savep:', e)
    return conn.sendMessage(m.chat, {
      text: '❌ *Error*: Ocurrió un error al guardar la publicación.\n' +
            'Por favor, verifica que el mensaje contenga una imagen o video e inténtalo de nuevo.'
    }, { quoted: m })
  }
}

handler.command = ['savep', 'savepublicacion']
handler.admin = true

export default handler
