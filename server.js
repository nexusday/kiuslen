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

// Middleware
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json())
  app.use('/images', express.static(path.join(process.cwd(), 'storage', 'images')))

  // Multer in-memory storage for uploads
  const upload = multer({ storage: multer.memoryStorage() })

  // Ruta principal (panel)
  app.get('/', async (req, res) => {
    await db.read()
    const html = `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BOT SPAM V2 - BETA WEB</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #121212;
          color: #fff;
          padding: 20px;
          margin: 0;
        }
        .container {
          max-width: 1200px;
          margin: auto;
        }
        h1 {
          text-align: center;
        }
        .section {
          background: #1e1e1e;
          padding: 20px;
          border-radius: 10px;
          margin-top: 20px;
        }
        button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 5px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>BOT SPAM V2 - BETA WEB</h1>
        <div class="section">
          <button onclick="window.location.href='/pubs'">
            Ver Publicaciones
          </button>
        </div>
      </div>
    </body>
    </html>`

    res.send(html)
  })

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
    res.redirect('/')
  } catch (e) {
    res.send('Error agregando publicación: ' + e.message)
  }
})

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
  await db.write()
  res.redirect('/')
})

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
  await db.write()
  res.redirect('/')
})

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
  await db.write()
  res.redirect('/')
})

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
        .pub-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .pub-checkbox {
          flex: 0 0 36px;
        }
        .pub-content {
          flex: 1;
          min-width: 200px;
          display: flex;
          flex-direction: column;
        }
        .pub-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 120px;
        }
        .media {
          width: 100%;
          max-width: 250px;
          height: auto;
          border-radius: 8px;
          margin-top: 10px;
          object-fit: cover;
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
          .pub-row {
            flex-direction: column;
            align-items: stretch;
          }
          .pub-content {
            align-items: center;
          }
          .media {
            max-width: 180px;
          }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Todas las Publicaciones</h1>`
  for (const item of pubs) {
    const groupName = groupMap.get(item.groupId) || 'Desconocido'
    const filename = item.pub.image ? path.basename(item.pub.image) : ''
    html += `<div class="pub" data-group="${item.groupId}" data-index="${item.index}">
  <div class="pub-row">
    <div class="pub-checkbox">
      <input type="checkbox" class="pub-select" data-group="${item.groupId}" data-index="${item.index}">
    </div>

    <div class="pub-content">
      <p><strong>Grupo:</strong> ${groupName} (${item.groupId})</p>
      <p><strong>Texto:</strong> ${item.pub.text || ''}</p>`

    if (item.pub.image) {
      if (item.pub.imageType === 'video') {
        html += `<video controls class="media"><source src="/images/${filename}"></video>`
      } else {
        html += `<img src="/images/${filename}" class="media">`
      }
    }

    html += `</div>
    <div class="pub-actions">
      <form action="/toggle-pub" method="post">
        <input type="hidden" name="groupId" value="${item.groupId}">
        <input type="hidden" name="index" value="${item.index}">
        <button type="submit">${item.pub.enabled !== false ? 'Deshabilitar' : 'Habilitar'}</button>
      </form>
      <form action="/delete-pub" method="post">
        <input type="hidden" name="groupId" value="${item.groupId}">
        <input type="hidden" name="index" value="${item.index}">
        <button type="submit" class="btn-danger" onclick="return confirm('¿Eliminar esta publicación?')">Eliminar</button>
      </form>
    </div>
  </div>
</div>`
  }
  
  const totalPages = Math.ceil(total / limit)
  html += '<div class="pagination">'
  for (let p = 1; p <= totalPages; p++) {
    html += `<a href="/pubs?page=${p}">${p}</a>`
  }
  html += '</div>'
  html += '<button onclick="window.location.href=\'/\'">Volver al Panel</button>'

  // Bulk-action toolbar and client JS
  html += `
  <style>
    .bulk-toolbar { position: fixed; right: 20px; bottom: 20px; display:flex; gap:8px; align-items:center; z-index:9999 }
    .bulk-btn { background:#dc3545; color:#fff; border:none; padding:12px 14px; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:8px; }
    .bulk-btn:disabled { opacity:0.5; cursor:not-allowed }
    .bulk-count { background:#007bff;color:#fff;padding:6px 8px;border-radius:999px;font-weight:bold }
  </style>
  <div class="bulk-toolbar">
    <div class="bulk-count" id="bulkCount">0</div>
    <button id="bulkDelete" class="bulk-btn" title="Eliminar seleccionadas" disabled>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
      </svg>
      Eliminar seleccionadas
    </button>
  </div>
  <script>
    (function(){
      const checkboxes = () => Array.from(document.querySelectorAll('.pub-select'))
      const bulkCount = document.getElementById('bulkCount')
      const bulkDelete = document.getElementById('bulkDelete')

      function updateCount(){
        const selected = checkboxes().filter(c => c.checked)
        bulkCount.textContent = selected.length
        bulkDelete.disabled = selected.length === 0
      }

      document.addEventListener('change', function(e){
        if(e.target && e.target.classList && e.target.classList.contains('pub-select')) updateCount()
      })

      bulkDelete.addEventListener('click', async function(){
        const selected = checkboxes().filter(c => c.checked).map(c => ({ groupId: c.dataset.group, index: parseInt(c.dataset.index) }))
        if(selected.length === 0) return
        if(!confirm('¿Eliminar ' + selected.length + ' publicaciones seleccionadas?')) return

        try{
          const res = await fetch('/delete-pubs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: selected })
          })
          const json = await res.json()
          if(res.ok){
            // reload page to reflect changes
            location.reload()
          } else {
            alert('Error al eliminar: ' + (json?.error || res.statusText))
          }
        }catch(err){
          alert('Error de red: ' + err.message)
        }
      })
    })()
  </script>`

  html += '</div></body></html>'
  res.send(html)
})

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
  await db.write()
  res.redirect('/pubs')
})

// Bulk delete publications endpoint
app.post('/delete-pubs', async (req, res) => {
  try {
    const items = req.body?.items || []
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items provided' })

    await db.read()
    // To avoid index shift issues, group deletions by groupId and sort indices desc
    const byGroup = {}
    for (const it of items) {
      if (!it || !it.groupId) continue
      const g = it.groupId
      byGroup[g] = byGroup[g] || []
      byGroup[g].push(parseInt(it.index))
    }

    for (const [groupId, indices] of Object.entries(byGroup)) {
      if (!db.data.publicaciones[groupId] || !Array.isArray(db.data.publicaciones[groupId].publications)) continue
      const uniq = Array.from(new Set(indices)).filter(i => !isNaN(i)).sort((a,b) => b - a)
      for (const index of uniq) {
        if (index < 0 || index >= db.data.publicaciones[groupId].publications.length) continue
        const pub = db.data.publicaciones[groupId].publications[index]
        if (pub && pub.image) {
          try {
            await fs.access(pub.image)
            await fs.unlink(pub.image)
          } catch (e) {
            // ignore missing files
          }
        }
        db.data.publicaciones[groupId].publications.splice(index, 1)
      }
    }

    await db.write()
    return res.json({ ok: true })
  } catch (e) {
    console.error('Error en delete-pubs:', e)
    return res.status(500).json({ error: e.message })
  }
})

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
