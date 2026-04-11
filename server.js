import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { Low, JSONFile } from 'lowdb'
import os from 'os'

(async () => {
const app = express()
const PORT = 4500

// DB
const db = new Low(new JSONFile('storage/databases/database.json'))
await db.read()
db.data ||= { users: {}, chats: {}, stats: {}, msgs: {}, sticker: {}, settings: {}, botGroups: {}, antiImg: {}, bienvenidas: {}, publicaciones: {}, groups: [], selectedGroups: [] }
await db.write()


app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use('/images', express.static(path.join(process.cwd(), 'storage/images')))


const upload = multer({ storage: multer.memoryStorage() })

app.get('/', async (req, res) => {
  await db.read()
  const pubs = db.data.publicaciones || {}
  let html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BOT SPAM V2.5 - BETA WEB</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #121212;
            color: #ffffff;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .section {
            background: #1e1e1e;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid #333;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        h1 {
            text-align: center;
            font-size: 2.5em;
            margin-bottom: 30px;
            color: #ffffff;
        }
        h2 {
            font-size: 1.8em;
            margin-bottom: 15px;
            color: #ffffff;
        }
        .status-item {
            background: #2a2a2a;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .checkbox-group {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 10px;
        }
        .checkbox-item {
            background: #2a2a2a;
            padding: 10px;
            border-radius: 5px;
        }
        .checkbox-item label {
            display: flex;
            align-items: center;
            cursor: pointer;
            color: #ffffff;
        }
        .checkbox-item input[type="checkbox"] {
            margin-right: 10px;
        }
        textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #555;
            border-radius: 5px;
            background: #333;
            color: #ffffff;
            resize: vertical;
        }
        input[type="file"],
        input[type="number"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #555;
            border-radius: 5px;
            background: #333;
            color: #ffffff;
        }
        button {
            padding: 12px 20px;
            border: none;
            border-radius: 5px;
            background: #007bff;
            color: #ffffff;
            cursor: pointer;
            transition: background 0.3s ease;
            font-size: 1em;
            margin: 10px 5px 10px 0;
        }
        button:hover {
            background: #0056b3;
        }
        p {
            background: #2a2a2a;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
        }
        .pub-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .pub-item img,
        .pub-item video {
            max-width: 300px;
            border-radius: 5px;
            margin-right: 20px;
        }
        .pub-content {
            flex: 1;
        }
        a {
            color: #00d4ff;
            text-decoration: none;
            font-weight: bold;
        }
        a:hover {
            text-decoration: underline;
        }
        .pagination {
            display: flex;
            justify-content: center;
            gap: 5px;
            margin: 20px 0;
        }
        .pagination a {
            padding: 8px 12px;
            background: #007bff;
            border-radius: 5px;
            color: #ffffff;
            text-decoration: none;
        }
        .pagination a:hover {
            background: #0056b3;
        }
        .badge {
            background: #ff5722;
            color: white;
            border-radius: 50%;
            padding: 2px 6px;
            font-size: 0.8em;
            margin-left: 5px;
            font-weight: bold;
        }
        @media (max-width: 768px) {
            .container {
                padding: 20px;
            }
            h1 {
                font-size: 2em;
            }
            .pub-item {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1><i class="fas fa-robot"></i> BOT SPAM V2 -BETA WEB</h1>`

  
  html += `<div class="section"><h2>Estado de Grupos Seleccionados</h2>`
  const selectedGroups = db.data.selectedGroups || []
  const groupMap = new Map((db.data.groups || []).map(g => [g.id, g.name]))
  let totalPubs = 0;
  for (const groupId of selectedGroups) {
    const cfg = pubs[groupId];
    if (cfg && cfg.publications) {
      totalPubs += cfg.publications.filter(p => p.enabled !== false).length;
    }
  }
  if (selectedGroups.length === 0) {
    html += `<p>No hay grupos seleccionados.</p>`
  } else {
    for (const groupId of selectedGroups) {
      const cfg = pubs[groupId]
      const groupName = groupMap.get(groupId) || 'Desconocido'
      if (cfg && typeof cfg === 'object' && cfg.publications) {
        const interval = cfg.interval || 600000
        const nextTime = cfg.enabled ? new Date(Date.now() + interval).toLocaleString() : 'Desactivado'
        html += `<div class="status-item"><strong>${groupName} (${groupId})</strong>: ${cfg.enabled ? 'Activado' : 'Desactivado'} | Intervalo: ${Math.round(interval / 60000)}m | Próxima: ${nextTime} | Publicaciones: ${cfg.publications.filter(p => p.enabled !== false).length}</div>`
      } else {
        html += `<div class="status-item"><strong>${groupName} (${groupId})</strong>: Sin configuración</div>`
      }
    }
  }
  html += `</div>`

  
  html += `<div class="section"><h2>1. Seleccionar Grupos</h2>
    <form action="/select-groups" method="post">
      <div class="checkbox-group">`
  for (const group of db.data.groups || []) {
    const checked = selectedGroups.includes(group.id) ? 'checked' : ''
    html += `<div class="checkbox-item"><label><input type="checkbox" name="selectedGroups" value="${group.id}" ${checked}> ${group.name} (${group.id})</label></div>`
  }
  html += `</div><button type="submit">Guardar Selección</button>
    </form></div>`

  
  html += `<div class="section"><h2>2. Agregar Publicación</h2>
    <form action="/add-pub" method="post" enctype="multipart/form-data">
      <label>Texto:</label>
      <textarea name="text"></textarea>
      <label>Imagen/Video:</label>
      <input name="media" type="file" required>
      <button type="submit">Agregar</button>
    </form></div>`

  
  html += `<div class="section"><h2>3. Establecer Temporizador</h2>
    <form action="/set-time" method="post">
      <label>Tiempo (minutos):</label>
      <input type="number" min="1" value="10" name="minutes">
      <button type="submit">Establecer</button>
    </form></div>`

  
  html += `<div class="section"><h2>4. Activar/Desactivar Publicaciones</h2>
    <form action="/activate" method="post" style="display:inline;">
      <button type="submit" style="background:#28a745;">Activar</button>
    </form>
    <form action="/deactivate" method="post" style="display:inline;">
      <button type="submit" style="background:#dc3545;">Desactivar</button>
    </form></div>`

  html += `<div class="section"><button onclick="window.location.href='/pubs'">Ver Todas las Publicaciones <span class="badge">${totalPubs}</span></button></div>
    </div>
</body>
</html>`

  res.send(html);
});

app.post('/select-groups', async (req, res) => {
  try {
    const { selectedGroups } = req.body
    const groups = Array.isArray(selectedGroups) ? selectedGroups : selectedGroups ? [selectedGroups] : []
    await db.read()
    db.data.selectedGroups = groups
    
    const existingCfgs = Object.values(db.data.publicaciones).filter(cfg => cfg && cfg.interval)
    const defaultInterval = existingCfgs.length > 0 ? existingCfgs[0].interval : 600000
    let maxPubCfg = null
    let maxCount = 0
    for (const cfg of Object.values(db.data.publicaciones)) {
      if (cfg && cfg.publications && cfg.publications.length > maxCount) {
        maxCount = cfg.publications.length
        maxPubCfg = cfg
      }
    }
    for (const groupId of groups) {
      if (!db.data.publicaciones[groupId] || !db.data.publicaciones[groupId].publications || db.data.publicaciones[groupId].publications.length == 0) {
        const copiedPubs = maxPubCfg ? await Promise.all(maxPubCfg.publications.map(async p => {
          const newP = {...p}
          if (p.image) {
            const buffer = await fs.readFile(p.image)
            const extension = p.imageType === 'video' ? '.mp4' : '.png'
            const filename = Date.now() + '_copy_' + Math.random().toString(36).substring(2) + extension
            const filepath = path.join(process.cwd(), 'storage', 'images', filename)
            await fs.mkdir(path.dirname(filepath), { recursive: true })
            await fs.writeFile(filepath, buffer)
            newP.image = filepath
          }
          return newP
        })) : []
        db.data.publicaciones[groupId] = { 
          publications: copiedPubs, 
          interval: defaultInterval, 
          enabled: true 
        }
      }
    }
    await db.write();
    res.redirect('/');
  } catch (e) {
    res.send('Error guardando selección: ' + e.message);
  }
});

app.post('/add-pub', upload.single('media'), async (req, res) => {
  try {
    const { text } = req.body
    if (!text || !text.trim()) {
      return res.send('Ingresa un texto para la publicación.')
    }
    const selectedGroups = db.data.selectedGroups || []
    if (selectedGroups.length === 0) {
      return res.send('No hay grupos seleccionados. Selecciona grupos primero.')
    }
    await db.read()
    for (const groupId of selectedGroups) {
      if (!db.data.publicaciones[groupId]) db.data.publicaciones[groupId] = { publications: [], interval: 600000, enabled: false }
      const pub = {
        image: '',
        text,
        imageType: '',
        savedBy: 'web',
        savedAt: new Date().toISOString(),
        enabled: true
      }
      if (req.file) {
        const extension = req.file.mimetype.startsWith('video') ? '.mp4' : '.png'
        const filename = Date.now() + '_web' + extension
        const filepath = path.join(process.cwd(), 'storage', 'images', filename)
        await fs.mkdir(path.dirname(filepath), { recursive: true })
        await fs.writeFile(filepath, req.file.buffer)
        pub.image = filepath
        pub.imageType = req.file.mimetype.startsWith('video') ? 'video' : 'image'
      }
      db.data.publicaciones[groupId].publications.push(pub)
    }
    await db.write()
    res.redirect('/');
  } catch (e) {
    res.send('Error agregando publicación: ' + e.message);
  }
});

app.post('/activate', async (req, res) => {
  const selectedGroups = db.data.selectedGroups || []
  if (selectedGroups.length === 0) {
    return res.send('No hay grupos seleccionados.')
  }
  await db.read()
  for (const groupId of selectedGroups) {
    if (db.data.publicaciones[groupId]) {
      db.data.publicaciones[groupId].enabled = true
    }
  }
  await db.write();
  res.redirect('/');
});

app.post('/deactivate', async (req, res) => {
  const selectedGroups = db.data.selectedGroups || []
  if (selectedGroups.length === 0) {
    return res.send('No hay grupos seleccionados.')
  }
  await db.read()
  for (const groupId of selectedGroups) {
    if (db.data.publicaciones[groupId]) {
      db.data.publicaciones[groupId].enabled = false
    }
  }
  await db.write();
  res.redirect('/');
});

const parseInterval = (timeStr) => {
  const num = parseFloat(timeStr)
  if (timeStr.endsWith('s')) return num * 1000
  if (timeStr.endsWith('m')) return num * 60000
  if (timeStr.endsWith('h')) return num * 3600000
  return num * 60000
}

app.post('/set-time', async (req, res) => {
  const { minutes } = req.body
  const ms = parseInt(minutes) * 60000
  const selectedGroups = db.data.selectedGroups || []
  if (selectedGroups.length === 0) {
    return res.send('No hay grupos seleccionados.')
  }
  await db.read()
  for (const groupId of selectedGroups) {
    if (db.data.publicaciones[groupId]) {
      db.data.publicaciones[groupId].interval = ms
      console.log(`Temporizador establecido para grupo ${groupId}: ${minutes} min (${ms} ms)`)
    }
  }
  await db.write();
  res.redirect('/');
});

app.get('/pubs', async (req, res) => {
  await db.read()
  const page = parseInt(req.query.page) || 1
  const limit = 10
  const selectedGroups = db.data.selectedGroups || []
  const groupMap = new Map((db.data.groups || []).map(g => [g.id, g.name]))
  const allPubs = []
  for (const groupId of selectedGroups) {
    const cfg = db.data.publicaciones[groupId]
    if (cfg && cfg.publications) {
      cfg.publications.forEach((pub, index) => {
        allPubs.push({ groupId, index, pub })
      })
    }
  }
  const total = allPubs.length
  const start = (page - 1) * limit
  const pubs = allPubs.slice(start, start + limit)
  let html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Publicaciones</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #121212;
            color: #ffffff;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .section {
            background: #1e1e1e;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid #333;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        h1 {
            text-align: center;
            font-size: 2.5em;
            margin-bottom: 30px;
            color: #ffffff;
        }
        h2 {
            font-size: 1.8em;
            margin-bottom: 15px;
            color: #ffffff;
        }
        .status-item {
            background: #2a2a2a;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .checkbox-group {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 10px;
        }
        .checkbox-item {
            background: #2a2a2a;
            padding: 10px;
            border-radius: 5px;
        }
        .checkbox-item label {
            display: flex;
            align-items: center;
            cursor: pointer;
            color: #ffffff;
        }
        .checkbox-item input[type="checkbox"] {
            margin-right: 10px;
        }
        textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #555;
            border-radius: 5px;
            background: #333;
            color: #ffffff;
            resize: vertical;
        }
        input[type="file"],
        input[type="number"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #555;
            border-radius: 5px;
            background: #333;
            color: #ffffff;
        }
        button {
            padding: 12px 20px;
            border: none;
            border-radius: 5px;
            background: #007bff;
            color: #ffffff;
            cursor: pointer;
            transition: background 0.3s ease;
            font-size: 1em;
            margin: 10px 5px 10px 0;
        }
        button:hover {
            background: #0056b3;
        }
        p {
            background: #2a2a2a;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
        }
        .pub {
            background: #1e1e1e;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid #333;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        .pub-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
        }
        .action-bar {
            position: sticky;
            top: 20px;
            background: #1e1e1e;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 10px;
            border: 1px solid #333;
            z-index: 100;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        }
        .pub-checkbox {
            width: 25px;
            height: 25px;
            cursor: pointer;
        }
        .btn-delete-selected {
            background: #dc3545;
        }
        .btn-delete-selected:disabled {
            background: #555;
            cursor: not-allowed;
        }
        .trash-icon {
            background: transparent;
            border: none;
            color: #dc3545;
            cursor: pointer;
            font-size: 1.3em;
            padding: 5px 10px;
            border-radius: 5px;
            transition: 0.3s;
        }
        .trash-icon:hover {
            background: rgba(220, 53, 69, 0.1);
        }
        .pub-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .pub-item img,
        .pub-item video {
            max-width: 300px;
            border-radius: 5px;
            margin-right: 20px;
        }
        .pub-content {
            flex: 1;
        }
        .pagination {
            display: flex;
            justify-content: center;
            gap: 5px;
            margin: 20px 0;
        }
        .pagination a {
            padding: 8px 12px;
            background: #007bff;
            border-radius: 5px;
            color: #ffffff;
            text-decoration: none;
        }
        .pagination a:hover {
            background: #0056b3;
        }
        .badge {
            background: #ff5722;
            color: white;
            border-radius: 50%;
            padding: 2px 6px;
            font-size: 0.8em;
            margin-left: 5px;
            font-weight: bold;
        }
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            h1 {
                font-size: 1.8em;
            }
            .action-bar {
                flex-direction: column;
                gap: 10px;
                top: 5px;
                padding: 10px;
            }
            .action-bar div {
                display: flex;
                width: 100%;
                gap: 5px;
            }
            .action-bar button {
                flex: 1;
                font-size: 0.9em;
                padding: 10px 5px;
                margin: 0;
            }
            #deleteBtn {
                width: 100%;
            }
            .pub-header {
                flex-wrap: wrap;
            }
            .pub-header label {
                margin-bottom: 10px;
            }
            .pub img, .pub video {
                width: 100%;
                max-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Todas las Publicaciones</h1>
        <form id="deleteForm" action="/delete-multiple-pubs" method="post">
        <div class="action-bar-container" style="position: sticky; top: 20px; z-index: 100; margin-bottom: 20px;">
            <div class="action-bar" style="margin-bottom: 0;">
                <div>
                    <button type="button" onclick="selectAll()" style="background:#555;"><i class="fas fa-check-square"></i> Seleccionar Todos</button>
                    <button type="button" onclick="window.location.href='/'" style="background:#333;"><i class="fas fa-home"></i> Inicio</button>
                </div>
                <button type="submit" class="btn-delete-selected" id="deleteBtn" disabled>
                    <i class="fas fa-trash"></i> Eliminar Seleccionados (<span id="count">0</span>)
                </button>
            </div>
            <div class="pagination" style="background: #1e1e1e; padding: 10px; border-radius: 0 0 10px 10px; border: 1px solid #333; border-top: none; display: flex; justify-content: center; gap: 5px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">`
  
  const totalPages = Math.ceil(total / limit)
  for (let p = 1; p <= totalPages; p++) {
    html += `<a href="/pubs?page=${p}" style="padding: 2px 12px; background: ${p === page ? '#00d4ff' : '#333'}; border-radius: 5px; color: #fff; text-decoration: none; font-weight: bold; border: 1px solid ${p === page ? '#00d4ff' : '#444'};">${p}</a>`
  }

  html += `</div>
        </div>`
  for (const item of pubs) {
    const groupName = groupMap.get(item.groupId) || 'Desconocido'
    html += `<div class="pub">
      <div class="pub-header">
        <label style="display:flex; align-items:center; cursor:pointer; flex: 1;">
            <input type="checkbox" form="deleteForm" name="pubKeys" value="${item.groupId}:${item.index}" class="pub-checkbox" onchange="updateCount()">
            <span style="margin-left:15px; font-weight:bold; color: #00d4ff;">${groupName}</span>
            <span style="margin-left:10px; font-size: 0.8em; color: #888;">(${item.groupId})</span>
        </label>
        <button type="button" onclick="deleteSingle('${item.groupId}', ${item.index})" class="trash-icon" title="Eliminar ahora">
            <i class="fas fa-trash-alt"></i>
        </button>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: bold; color: #888;">Contenido del mensaje:</span>
        <button type="button" onclick="openEditModal('${item.groupId}', ${item.index})" class="edit-icon" title="Editar texto">
            <i class="fas fa-edit"></i> Editar Texto
        </button>
      </div>
      <div style="background: #2a2a2a; padding: 15px; border-radius: 8px; margin: 10px 0; border: 1px solid #333;">
        <div id="text-${item.groupId}-${item.index}" style="white-space: pre-wrap; color: #eee; font-size: 1.1em; line-height: 1.5;">${item.pub.text || ''}</div>
      </div>`
    if (item.pub.image) {
      const filename = path.basename(item.pub.image)
      if (item.pub.imageType === 'video') {
        html += `<video controls width="300"><source src="/images/${filename}"></video>`
      } else {
        html += `<img src="/images/${filename}" width="300">`
      }
    }
    html += `<div style="margin-top:15px; display: flex; gap: 10px;">
    <form action="/toggle-pub" method="post" style="display:inline;">
      <input type="hidden" name="groupId" value="${item.groupId}">
      <input type="hidden" name="index" value="${item.index}">
      <button type="submit" style="background: ${item.pub.enabled !== false ? '#28a745' : '#6c757d'}">${item.pub.enabled !== false ? '<i class="fas fa-eye"></i> Publicando' : '<i class="fas fa-eye-slash"></i> Pausado'}</button>
    </form>
    </div>
    </div>`
  }
  
  html += `</form>
  <script>
    function updateCount() {
        const checked = document.querySelectorAll('.pub-checkbox:checked').length;
        document.getElementById('count').innerText = checked;
        document.getElementById('deleteBtn').disabled = checked === 0;
    }
    function selectAll() {
        const checkboxes = document.querySelectorAll('.pub-checkbox');
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        checkboxes.forEach(c => c.checked = !allChecked);
        updateCount();
    }
    function deleteSingle(groupId, index) {
        if(confirm('¿Eliminar esta publicación?')) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/delete-pub';
            const inputG = document.createElement('input');
            inputG.type = 'hidden';
            inputG.name = 'groupId'; inputG.value = groupId;
            const inputI = document.createElement('input');
            inputI.type = 'hidden';
            inputI.name = 'index'; inputI.value = index;
            form.appendChild(inputG); form.appendChild(inputI);
            document.body.appendChild(form);
            form.submit();
        }
    }
    document.getElementById('deleteForm').onsubmit = function() {
        return confirm('¿Eliminar las publicaciones seleccionadas?');
    }

    
    function openEditModal(groupId, index) {
        const textElement = document.getElementById('text-' + groupId + '-' + index);
        const currentText = textElement ? textElement.innerText : '';
        document.getElementById('editGroupId').value = groupId;
        document.getElementById('editIndex').value = index;
        document.getElementById('editText').value = currentText;
        document.getElementById('editModal').style.display = 'block';
    }

    function closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    async function saveEditedText() {
        const groupId = document.getElementById('editGroupId').value;
        const index = document.getElementById('editIndex').value;
        const text = document.getElementById('editText').value;
        const saveBtn = document.getElementById('saveEditBtn');
        
        saveBtn.disabled = true;
        saveBtn.innerText = 'Guardando...';

        try {
            const response = await fetch('/edit-pub-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId, index: parseInt(index), text })
            });

            if (response.ok) {
                
                const textElement = document.getElementById('text-' + groupId + '-' + index);
                if (textElement) {
                    textElement.innerText = text;
                }
                closeEditModal();
                alert('¡Publicación actualizada con éxito!');
            } else {
                alert('Error al guardar los cambios.');
            }
        } catch (e) {
            console.error('Error:', e);
            alert('Error al conectar con el servidor.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = 'Guardar Cambios';
        }
    }

    
    window.onclick = function(event) {
        const modal = document.getElementById('editModal');
        if (event.target == modal) {
            closeEditModal();
        }
    }
  </script>
  
  <!-- Modal de Edición -->
  <div id="editModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2 style="margin: 0; font-size: 1.4em; color: #00d4ff;"><i class="fas fa-edit"></i> Editar Publicación</h2>
            <button type="button" onclick="closeEditModal()" style="background:none; color:#888; border:none; font-size:1.5em; cursor:pointer;">&times;</button>
        </div>
        <input type="hidden" id="editGroupId">
        <input type="hidden" id="editIndex">
        <textarea id="editText" rows="10" style="margin-bottom: 0; font-size:1em; line-height:1.5; font-family: inherit;"></textarea>
        <div class="modal-footer">
            <button type="button" onclick="closeEditModal()" style="background:#444;">Cancelar</button>
            <button type="button" id="saveEditBtn" onclick="saveEditedText()" style="background:#28a745;">Guardar Cambios</button>
        </div>
    </div>
  </div>
  
  <style>
    .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0; top: 0;
        width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.85);
        backdrop-filter: blur(5px);
    }
    .modal-content {
        background-color: #1e1e1e;
        margin: 5% auto;
        padding: 25px;
        border: 1px solid #333;
        width: 90%;
        max-width: 600px;
        border-radius: 15px;
        box-shadow: 0 5px 30px rgba(0,0,0,0.8);
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #333;
        padding-bottom: 15px;
    }
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 15px;
        margin-top: 20px;
    }
    .edit-icon {
        background: rgba(0, 212, 255, 0.1);
        border: 1px solid rgba(0, 212, 255, 0.3);
        color: #00d4ff;
        cursor: pointer;
        font-size: 0.9em;
        padding: 6px 12px;
        border-radius: 6px;
        transition: 0.3s;
    }
    .edit-icon:hover {
        background: rgba(0, 212, 255, 0.2);
        color: white;
    }
  </style>`;
  html += '</div></body></html>';
  res.send(html);
});

app.post('/edit-pub-text', async (req, res) => {
  try {
    const { groupId, index, text } = req.body
    await db.read()
    
    if (db.data.publicaciones[groupId] && db.data.publicaciones[groupId].publications) {
      const idx = parseInt(index)
      if (idx >= 0 && idx < db.data.publicaciones[groupId].publications.length) {
        db.data.publicaciones[groupId].publications[idx].text = text
        await db.write()
        return res.sendStatus(200)
      }
    }
    res.status(404).send('Publicación no encontrada')
  } catch (e) {
    res.status(500).send(e.message)
  }
})

app.post('/delete-multiple-pubs', async (req, res) => {
  try {
    const { pubKeys } = req.body
    if (!pubKeys) return res.redirect('/pubs')
    
    const keys = Array.isArray(pubKeys) ? pubKeys : [pubKeys]
    await db.read()
    
    const toDelete = {} 
    
    for (const key of keys) {
      const [groupId, index] = key.split(':')
      if (!toDelete[groupId]) toDelete[groupId] = []
      toDelete[groupId].push(parseInt(index))
    }
    
    for (const groupId in toDelete) {
      if (db.data.publicaciones[groupId] && db.data.publicaciones[groupId].publications) {
        
        const indices = toDelete[groupId].sort((a, b) => b - a)
        for (const idx of indices) {
          const pub = db.data.publicaciones[groupId].publications[idx]
          if (pub && pub.image) {
            try {
              await fs.access(pub.image)
              await fs.unlink(pub.image)
            } catch (e) {
              console.log('Error deleting image:', e.message)
            }
          }
          db.data.publicaciones[groupId].publications.splice(idx, 1)
        }
      }
    }
    
    await db.write();
    res.redirect('/pubs');
  } catch (e) {
    res.send('Error eliminando publicaciones: ' + e.message);
  }
});

app.post('/toggle-pub', async (req, res) => {
  const { groupId, index } = req.body
  await db.read()
  if (db.data.publicaciones[groupId] && db.data.publicaciones[groupId].publications) {
    const idx = parseInt(index)
    if (idx >= 0 && idx < db.data.publicaciones[groupId].publications.length) {
      const pub = db.data.publicaciones[groupId].publications[idx]
      pub.enabled = !(pub.enabled !== false)
    }
  }
  await db.write();
  res.redirect('/pubs');
});

app.post('/delete-pub', async (req, res) => {
  const { groupId, index } = req.body
  await db.read()
  if (db.data.publicaciones[groupId] && db.data.publicaciones[groupId].publications) {
    const idx = parseInt(index)
    if (idx >= 0 && idx < db.data.publicaciones[groupId].publications.length) {
      const pub = db.data.publicaciones[groupId].publications[idx]
      if (pub.image) {
        try {
          await fs.access(pub.image)
          await fs.unlink(pub.image)
        } catch (e) {
          console.log('Error deleting image:', e.message)
        }
      }
      db.data.publicaciones[groupId].publications.splice(idx, 1)
    }
  }
  await db.write()
  res.redirect('/pubs')
})

const getLocalIP = () => {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP()
  console.log(`Panel web en http://localhost:${PORT} (accesible desde la red local en http://${ip}:${PORT})`)
})
})()
