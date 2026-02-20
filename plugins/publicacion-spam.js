import fs from 'fs/promises'
import path from 'path'

const activeTimers = new Map()

const getTimerKey = (groupId) => `timer:${groupId}`

const clearTimer = (groupId) => {
  const timerKey = getTimerKey(groupId);
  if (activeTimers.has(timerKey)) {
    console.log(`🛑 Deteniendo temporizador para grupo ${groupId}`);
    clearInterval(activeTimers.get(timerKey));
    activeTimers.delete(timerKey);
    return true;
  }
  return false;
};

function clearAllTimers(groupId = null) {
  let count = 0;
  for (const [key, timer] of activeTimers.entries()) {
    if (!groupId || key === `timer:${groupId}`) {
      clearInterval(timer);
      activeTimers.delete(key);
      count++;
    }
  }
  return count;
};

function hasActiveTimer(groupId) {
  return activeTimers.has(getTimerKey(groupId));
};

async function sendPublication(conn, groupId, pub, retryCount = 0) {
  const maxRetries = 3;
  const retryDelay = 5000; // 5 seconds

  if (!pub || !pub.image) {
    console.log(`⚠️ No hay imagen en la publicación del grupo ${groupId}`)
    return false
  }
  
  try {
    console.log(`📤 Intentando enviar al grupo ${groupId} (intento ${retryCount + 1}/${maxRetries + 1})`)
    
    let mediaBuffer;
    if (pub.image.startsWith('/') || pub.image.includes(':\\') || pub.image.includes('storage')) {
      mediaBuffer = await fs.readFile(pub.image)
    } else {
      mediaBuffer = Buffer.from(pub.image, 'base64')
    }
    
    const preTypingDelay = Math.random() * 1000 + 500
    await new Promise(resolve => setTimeout(resolve, preTypingDelay))
    
    await conn.sendPresenceUpdate('composing', groupId)
    
    const typingDuration = Math.random() * 3000 + 2000
    await new Promise(resolve => setTimeout(resolve, typingDuration))
    
    const message = {
      [pub.imageType === 'video' ? 'video' : 'image']: mediaBuffer,
      caption: pub.text || '',
      mentions: []
    }
    
    await conn.sendMessage(groupId, message)
    
    await conn.sendPresenceUpdate('available', groupId)
    
    console.log(`✅ Publicación enviada correctamente a ${groupId}`)
    return true
  } catch (e) {
    console.error(`❌ Error al enviar al grupo ${groupId} (intento ${retryCount + 1}):`, e.message)
    try {
      await conn.sendPresenceUpdate('available', groupId)
    } catch {}

    if (retryCount < maxRetries && (e.message.includes('rate') || e.message.includes('timeout') || e.message.includes('network'))) {
      console.log(`🔄 Reintentando en ${retryDelay / 1000} segundos...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      return await sendPublication(conn, groupId, pub, retryCount + 1)
    }

    return false
  }
}

function schedulePublication(conn, groupId, pub) {
  clearTimer(groupId);
  
  if (!pub.enabled || !pub.interval || pub.publications.length === 0) {
    console.log(`⏸  Publicación desactivada para grupo ${groupId}`);
    return false;
  }
  
  console.log(`🔄 Programando publicación para grupo ${groupId}, cada ${intervalToText(pub.interval)}`);
  
  let isActive = true;
  
  const sendAndReschedule = async () => {
    if (!isActive) return;
    
    try {
      await conn.groupMetadata(groupId).catch(() => {
        throw new Error('Grupo no encontrado o acceso denegado');
      });
      
      const currentCfg = global.db.data.publicaciones?.[groupId];
      
      if (!currentCfg || !currentCfg.enabled || !currentCfg.interval || currentCfg.publications.length === 0) {
        console.log(`⏹  Deteniendo envíos para grupo ${groupId} (desactivado o sin publicaciones)`);
        clearTimer(groupId);
        isActive = false;
        return;
      }
      
      if (currentCfg.interval !== pub.interval) {
        console.log(`🔄 Intervalo cambiado para grupo ${groupId}, reprogramando...`);
        schedulePublication(conn, groupId, currentCfg);
        return;
      }
      
      let successCount = 0;
      let failureCount = 0;
      
      for (const pubItem of currentCfg.publications) {
        if (pubItem.enabled !== false) {
          const success = await sendPublication(conn, groupId, pubItem);
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        }
      }
      
      console.log(`📊 Envío completado para ${groupId}: ${successCount} exitosos, ${failureCount} fallidos`);
      
    } catch (e) {
      console.error(`❌ Error permanente en el grupo ${groupId}:`, e.message);
      if (e.message.includes('Grupo no encontrado') || e.message.includes('acceso denegado')) {
        clearTimer(groupId)
        isActive = false
      } else {
        console.log(`🔄 Continuando envíos para ${groupId} a pesar del error temporal`)
      }
    }
  };
  
  const cleanup = () => {
    if (!isActive) return;
    isActive = false;
    const timerKey = getTimerKey(groupId);
    if (activeTimers.has(timerKey)) {
      clearInterval(activeTimers.get(timerKey));
      activeTimers.delete(timerKey);
    }
  };
  
  const timer = setInterval(sendAndReschedule, pub.interval + Math.floor(Math.random() * pub.interval * 0.2 - pub.interval * 0.1));
  const timerKey = getTimerKey(groupId);
  activeTimers.set(timerKey, timer);
  
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  return true;
};

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
    global.db.data.publicaciones[chatId] = { publications: [], interval: 600000, enabled: false, activatedBy: '', activatedAt: '', deactivatedBy: '', deactivatedAt: '', timeSetBy: '', timeSetAt: '' }
  }
  
  const cfg = global.db.data.publicaciones[chatId]
  
  if (!Array.isArray(cfg.publications)) {
    cfg.publications = []
  }
  
  if (typeof cfg.interval !== 'number') {
    cfg.interval = 600000
  }
  
  if (typeof cfg.lastInterval !== 'number') {
    cfg.lastInterval = cfg.interval
  }
  
  global.db.data.publicaciones[chatId] = cfg
  return cfg
}

const intervalToText = (ms) => {
  const hours = Math.round(ms / 3600000)
  const minutes = Math.round(ms / 60000)
  const seconds = Math.round(ms / 1000)
  if (ms >= 3600000) return `${hours} hora${hours > 1 ? 's' : ''}`
  if (ms >= 60000) return `${minutes} minuto${minutes > 1 ? 's' : ''}`
  return `${seconds} segundo${seconds > 1 ? 's' : ''}`
}

const parseSlot = (args, pos = 1) => {
  const slot = args[pos - 1]?.toLowerCase()
  if (slot === 'all') return 'all'
  const slotNum = parseInt(slot)
  if (isNaN(slotNum) || slotNum < 1 || slotNum > MAX_SLOTS) return null
  return slotNum - 1 // Convertir a índice base 0
}

const parseInterval = (timeStr) => {
  if (!timeStr) return { error: 'Debes especificar un intervalo de tiempo (ej: 5m, 30s, 1h)' }
  
  const num = parseFloat(timeStr)
  if (isNaN(num)) return { error: 'El tiempo debe ser un número válido' }
  
  if (timeStr.endsWith('s')) return { ms: num * 1000 }
  if (timeStr.endsWith('m')) return { ms: num * 60000 }
  if (timeStr.endsWith('h')) return { ms: num * 3600000 }
  
  return { ms: num * 60000 } 
}

const getSelectedGroups = (chatId) => {
  const groups = global.db.data.selectedGroups || []
  return groups.filter(groupId => {
    const exists = conn.chats && conn.chats[groupId];
    if (!exists) {
      console.log(`⚠️  Grupo ${groupId} ya no existe, eliminando de la selección`);
      return false;
    }
    return true;
  });
}

const getSelectedGroup = (chatId) => {
  const groups = getSelectedGroups(chatId);
  return groups.length > 0 ? groups[0] : null;
}

let handler = async (m, { conn, args, usedPrefix, isOwner }) => {
  try {
    if (m.isGroup) return
    if (!isOwner) {
      return conn.sendMessage(m.chat, { text: '❌ *Acceso denegado*: Solo los propietarios pueden usar este comando.' }, { quoted: m })
    }
    
    const [cmd, ...params] = args
    const subcmd = (params[0] || '').toLowerCase()
    
    const selectedGroups = getSelectedGroups(m.chat)
    const selectedGroup = selectedGroups.length > 0 ? selectedGroups[0] : null
  
  if (!cmd) {
    let help = `*Comandos de Publicación Automática*\n\n` +
      `• ${usedPrefix}publicg on - Activar publicación en grupos seleccionados\n` +
      `• ${usedPrefix}publicg off - Desactivar publicación en grupos seleccionados\n` +
      `• ${usedPrefix}publicg time <tiempo> - Establecer intervalo en grupos seleccionados\n` +
      `• ${usedPrefix}publicg status - Ver estado de grupos seleccionados\n` +
      `• ${usedPrefix}publicg all - Ver estado de todos los grupos seleccionados\n\n`
    
    if (selectedGroups.length > 0) {
      help += `✅ *Grupos seleccionados (${selectedGroups.length}):*\n`
      for (const groupId of selectedGroups) {
        const groupName = await conn.getName(groupId).catch(() => `Grupo ${groupId}`);
        help += `• ${groupName} (${groupId})\n`
      }
      help += `\nUsa ${usedPrefix}grupos para cambiar los grupos seleccionados.\n`
    } else {
      help += `⚠️ *No hay grupos seleccionados*\n`
      help += `Usa ${usedPrefix}grupos para ver la lista y seleccionar uno o más grupos.\n`
    }
    
    help += `\nEjemplo de uso:\n` +
      `${usedPrefix}publicg on\n` +
      `${usedPrefix}publicg time 30m\n`
    
    return conn.sendMessage(m.chat, { text: help }, { quoted: m })
  }
  
  if (['on', 'off'].includes(cmd)) {
    if (selectedGroups.length === 0) {
      return conn.sendMessage(m.chat, { 
        text: `❌ *Error*: No hay grupos seleccionados.\n\n` +
              `Usa ${usedPrefix}grupos para ver la lista de grupos y seleccionar uno o más.\n` +
              `Ejemplo: ${usedPrefix}grupos all - para seleccionar todos los grupos`
      }, { quoted: m })
    }
    
    const isOn = cmd === 'on';
    let successCount = 0;
    let resultMessage = `*Resultado de ${isOn ? 'activación' : 'desactivación'}*\n\n`;
    
    for (const groupId of selectedGroups) {
      try {
        const cfg = ensureChatConfig(groupId);
        const publications = cfg.publications;
        
        if (isOn) {
          if (!cfg.timeSetBy) {
            resultMessage += `❌ *${await conn.getName(groupId).catch(() => groupId)}*: Configura el tiempo con \`publicg time Xm\` primero\n`;
            continue;
          }
          
          if (publications.length === 0) {
            resultMessage += `❌ *${await conn.getName(groupId).catch(() => groupId)}*: No hay publicaciones guardadas\n`;
            continue;
          }
        }
        
        cfg.enabled = isOn;
        cfg[isOn ? 'activatedBy' : 'deactivatedBy'] = m.pushName || m.sender.split('@')[0];
        cfg[isOn ? 'activatedAt' : 'deactivatedAt'] = new Date().toISOString();
        
        if (isOn) {
          try {
            const groupInfo = await conn.groupMetadata(groupId).catch(() => {
              throw new Error('No se pudo acceder al grupo. Asegúrate de que el bot siga en el grupo.');
            });
            
            schedulePublication(conn, groupId, cfg);
            resultMessage += `✅ *${await conn.getName(groupId).catch(() => groupId)}*: Publicación activada (primera en ${intervalToText(cfg.interval)})\n`;
            successCount++;
            
          } catch (e) {
            console.error(`Error al activar en grupo ${groupId}:`, e);
            cfg.enabled = false;
            resultMessage += `❌ *${await conn.getName(groupId).catch(() => groupId)}*: Error al activar - ${e.message}\n`;
          }
        } else {
          clearTimer(groupId);
          resultMessage += `✅ *${await conn.getName(groupId).catch(() => groupId)}*: Publicación desactivada\n`;
          successCount++;
        }
      } catch (e) {
        console.error(`Error al procesar grupo ${groupId}:`, e);
        resultMessage += `❌ *${groupId}*: Error al procesar - ${e.message}\n`;
      }
    }
    
    await global.db.write();
    
    resultMessage += `\nTotal: ${successCount} grupos ${isOn ? 'activados' : 'desactivados'}.`;
    return conn.sendMessage(m.chat, { text: resultMessage }, { quoted: m });
  }
  
  if (cmd === 'time') {
    if (selectedGroups.length === 0) {
      return conn.sendMessage(m.chat, { 
        text: `❌ *Error*: No hay grupos seleccionados.\n\n` +
              `Usa ${usedPrefix}grupos para ver la lista de grupos y seleccionar uno o más.\n` +
              `Ejemplo: ${usedPrefix}grupos all - para seleccionar todos los grupos`
      }, { quoted: m })
    }
    
    if (!params[0]) {
      return conn.sendMessage(m.chat, { 
        text: `❌ *Error*: Debes especificar un intervalo de tiempo (ej: 5m, 30s, 1h).`
      }, { quoted: m })
    }
    
    const timeStr = params[0];
    const parsed = parseInterval(timeStr);
    
    if (parsed.error) {
      return conn.sendMessage(m.chat, { 
        text: `❌ *Error*: ${parsed.error}`
      }, { quoted: m })
    }
    
    let successCount = 0;
    let resultMessage = `*Resultado de cambio de intervalo a ${intervalToText(parsed.ms)}*\n\n`;
    
    for (const groupId of selectedGroups) {
      try {
        const cfg = ensureChatConfig(groupId);
        
        cfg.interval = parsed.ms;
        cfg.timeSetBy = m.pushName || m.sender.split('@')[0];
        cfg.timeSetAt = new Date().toISOString();
        
        if (cfg.enabled) {
          schedulePublication(conn, groupId, cfg);
        }
        
        const nextTime = new Date(Date.now() + parsed.ms).toLocaleString();
        resultMessage += `⏱ *${await conn.getName(groupId).catch(() => groupId)}*: Intervalo actualizado a ${intervalToText(parsed.ms)}\nPróxima publicación: ${nextTime}\n`;
        successCount++;
      } catch (e) {
        console.error(`Error al procesar grupo ${groupId}:`, e);
        resultMessage += `❌ *${groupId}*: Error al procesar - ${e.message}\n`;
      }
    }
    
    await global.db.write();
    
    resultMessage += `\nTotal: ${successCount} grupos actualizados.`;
    return conn.sendMessage(m.chat, { text: resultMessage }, { quoted: m });
  }
  
  if (cmd === 'status') {
    if (selectedGroups.length === 0) {
      return conn.sendMessage(m.chat, { 
        text: `❌ *Error*: No hay grupos seleccionados.\n\n` +
              `Usa ${usedPrefix}grupos para ver la lista de grupos y seleccionar uno o más.\n` +
              `Ejemplo: ${usedPrefix}grupos all - para seleccionar todos los grupos`
      }, { quoted: m })
    }
    
    let resultMessage = `*Estado de Publicaciones*\n\n`;
    
    for (const groupId of selectedGroups) {
      try {
        const cfg = ensureChatConfig(groupId);
        const publications = cfg.publications;
        const groupName = await conn.getName(groupId).catch(() => `Grupo ${groupId}`);
        
        resultMessage += `*📌 ${groupName}* (${groupId}):\n` +
                         `Estado: ${cfg.enabled ? '✅ Activado' : '❌ Desactivado'}\n` +
                         `Intervalo: ${intervalToText(cfg.interval)}\n` +
                         `Publicaciones: ${publications.length}\n`
        
        if (cfg.activatedBy) {
          resultMessage += `Activado por: ${cfg.activatedBy}\n`
          resultMessage += `Última activación: ${new Date(cfg.activatedAt).toLocaleString()}\n`
        }
        
        if (cfg.timeSetBy) {
          resultMessage += `⏰ Intervalo establecido por: ${cfg.timeSetBy}\n`
          resultMessage += `Último cambio: ${new Date(cfg.timeSetAt).toLocaleString()}\n`
        }
        
        if (publications.length > 0) {
          resultMessage += `📝 Última publicación guardada por: ${publications[publications.length - 1].savedBy}\n`
          resultMessage += `Fecha: ${new Date(publications[publications.length - 1].savedAt).toLocaleString()}\n`
          resultMessage += `Tipo: ${publications[publications.length - 1].imageType || 'Solo texto'}\n`
        } else {
          resultMessage += '⚠️ No hay publicaciones guardadas\n'
        }
        
        resultMessage += '\n';
      } catch (e) {
        console.error(`Error al obtener información del grupo ${groupId}:`, e);
        resultMessage += `❌ Error al cargar la información de ${groupId}\n\n`;
      }
    }
    
    return conn.sendMessage(m.chat, { text: resultMessage }, { quoted: m });
  }
  
  if (cmd === 'all') {
    if (!global.db.data.publicaciones) {
      return conn.sendMessage(m.chat, { text: 'No hay publicaciones configuradas.' }, { quoted: m })
    }
    
    let status = '*📋 Estado de todas las publicaciones*\n\n'
    
    if (selectedGroups.length > 0) {
      for (const groupId of selectedGroups) {
        try {
          const cfg = ensureChatConfig(groupId);
          const publications = cfg.publications;
          const groupName = await conn.getName(groupId).catch(() => `Grupo ${groupId}`);
          
          status += `*📌 ${groupName}* (${groupId}):\n` +
                    `  Estado: ${cfg.enabled ? '✅' : '❌'} | Intervalo: ${intervalToText(cfg.interval)} | Publicaciones: ${publications.length}`;
          
          if (cfg.enabled && cfg.activatedAt && publications.length > 0) {
            const nextTime = new Date(new Date(cfg.activatedAt).getTime() + cfg.interval).toLocaleString();
            status += ` | Próxima: ${nextTime}`;
          }
          
          status += '\n\n';
        } catch (e) {
          console.error(`Error al obtener información del grupo ${groupId}:`, e);
          status += `  ❌ Error al cargar la información de este grupo\n\n`;
        }
      }
      
      status += '✅ = Activado | ❌ = Desactivado | 📝 = Con publicación | 📭 = Vacío\n';
    } else {
      status += '⚠️ *No hay grupos seleccionados*\n\n';
      status += 'Usa los siguientes comandos para comenzar:\n';
      status += `1. ${usedPrefix}grupos - Ver y seleccionar grupos\n`;
      status += `2. ${usedPrefix}savep - Guardar una publicación\n`;
      status += `3. ${usedPrefix}publicg on - Activar publicaciones\n`;
      status += `4. ${usedPrefix}publicg time <tiempo> - Configurar intervalo\n`;
    }
    
    await conn.sendMessage(m.chat, { text: status }, { quoted: m });
    
  } else {
    return conn.sendMessage(m.chat, { 
      text: `❌ Comando no reconocido. Usa ${usedPrefix}publicg para ver la ayuda.` 
    }, { quoted: m })
  }
  
  } catch (e) {
    console.error('Error en publicg:', e)
    await conn.sendMessage(m.chat, { 
      text: '❌ *Error*: Ocurrió un error al configurar la publicación automática.' 
    }, { quoted: m })
    await global.db.write()
  }
}

if (typeof process !== 'undefined') {
  process.on('exit', () => {
    console.log('🔴 Limpiando todos los temporizadores...');
    clearAllTimers();
  });
  
  process.on('SIGINT', () => {
    clearAllTimers();
    process.exit(0);
  });
  
  process.on('uncaughtException', (err) => {
    console.error('⚠️  Error no manejado:', err);
    clearAllTimers();
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️  Promesa rechazada no manejada:', reason);
  });
}

handler.command = ['publicg', 'publicacion', 'spam']
handler.private = true

// Automated sending for web-enabled groups
setInterval(async () => {
  for (const groupId of Object.keys(global.db.data?.publicaciones || {})) {
    const currentCfg = global.db.data?.publicaciones?.[groupId]
    if (currentCfg && currentCfg.enabled && currentCfg.publications && currentCfg.publications.length > 0 && !hasActiveTimer(groupId)) {
      schedulePublication(conn, groupId, currentCfg)
    }
  }
}, 10000)

export default handler
