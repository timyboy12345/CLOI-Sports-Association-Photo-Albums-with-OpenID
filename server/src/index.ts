import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import session from 'express-session';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import exifr from 'exifr';
import { Issuer, Strategy, Client } from 'openid-client';
import db from './db';

const app = express();
const port: string = process.env.PORT || '3001';

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const THUMBNAIL_SUFFIX = '.thumb.webp';
const COMPRESSED_SUFFIX = '.compressed.webp';
const currentlyProcessingPhotos = new Set<string>();

const getVariantPaths = (originalPath: string) => {
  const parsedPath = path.parse(originalPath);
  return {
    thumbnailPath: path.join(parsedPath.dir, `${parsedPath.name}${THUMBNAIL_SUFFIX}`),
    compressedPath: path.join(parsedPath.dir, `${parsedPath.name}${COMPRESSED_SUFFIX}`)
  };
};

const processPhotoVariants = async (relativeFilename: string) => {
  if (currentlyProcessingPhotos.has(relativeFilename)) return;
  currentlyProcessingPhotos.add(relativeFilename);

  console.log('Processing photo:', relativeFilename);

  try {
    const sourcePath = path.join(uploadsDir, relativeFilename);
    if (!fs.existsSync(sourcePath)) return;

    const { thumbnailPath, compressedPath } = getVariantPaths(sourcePath);
    const sourceBuffer = await fs.promises.readFile(sourcePath);
    const baseImage = sharp(sourceBuffer, { failOn: 'none' }).rotate();

    // Ensure metadata is in DB
    const photoRecord = db.prepare('SELECT id, metadata FROM photos WHERE filename = ?').get(relativeFilename) as { id: number, metadata: string | null } | undefined;
    if (photoRecord && (!photoRecord.metadata || photoRecord.metadata === 'null')) {
      console.log(' - Updating missing metadata for:', relativeFilename);
      try {
        const [sharpMeta, exifrMeta] = await Promise.all([
          baseImage.metadata(),
          exifr.parse(sourcePath, { pick: ['Make', 'Model', 'DateTimeOriginal', 'ExposureTime', 'FNumber', 'ISO', 'FocalLength'] }).catch(() => null)
        ]);

        const refinedMeta = {
          width: sharpMeta.width,
          height: sharpMeta.height,
          format: sharpMeta.format,
          space: sharpMeta.space,
          density: sharpMeta.density,
          camera: exifrMeta ? {
            make: exifrMeta.Make,
            model: exifrMeta.Model,
          } : null,
          exposure: exifrMeta ? {
            time: exifrMeta.ExposureTime,
            fNumber: exifrMeta.FNumber,
            iso: exifrMeta.ISO,
            focalLength: exifrMeta.FocalLength
          } : null,
          date: exifrMeta?.DateTimeOriginal
        };
        db.prepare('UPDATE photos SET metadata = ? WHERE id = ?').run(JSON.stringify(refinedMeta), photoRecord.id);
      } catch (e) {
        console.error('Failed to update metadata in background for', relativeFilename, e);
      }
    }

    if (!fs.existsSync(thumbnailPath)) {
      console.log(' - Generating thumbnail for:', relativeFilename);

      await baseImage
        .clone()
        .resize(520, 520, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    }

    if (!fs.existsSync(compressedPath)) {
      console.log(' - Generating compressed variant for:', relativeFilename);

      await baseImage
        .clone()
        .webp({ quality: 90 })
        .toFile(compressedPath);
    }

    console.log(' - Photo variants generated for:', relativeFilename);
  } catch (err) {
    console.error('Failed variant generation for file:', relativeFilename, err);
  } finally {
    currentlyProcessingPhotos.delete(relativeFilename);
  }
};

const processPhotosInBackground = async (relativeFilenames: string[]) => {
  for (const filename of relativeFilenames) {
    await processPhotoVariants(filename);
  }

  console.log('All photos processed');
};

const processAllPhotosInBackground = () => {
  const photos = db.prepare('SELECT filename FROM photos').all() as { filename: string }[];
  processPhotosInBackground(photos.map((photo) => photo.filename));
};

app.use(cors({origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true}));
app.use(express.json());

// Session config
app.use(session({
  secret: process.env.SESSION_SECRET || 'photo-viewer-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using https
}));
app.use('/api/uploads', requirePublicAccess, express.static(uploadsDir));

// Placeholder OIDC Config (Should be moved to .env)
const OIDC_ISSUER = process.env.OIDC_ISSUER || 'https://accounts.google.com';
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || 'your-client-id';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || 'your-client-secret';
const REDIRECT_URI = (process.env.SERVER_URL || 'http://localhost:3001') + '/api/auth/callback';

let client: Client;

// Initialize OIDC Client
async function initOidc() {
  try {
    const issuer = await Issuer.discover(OIDC_ISSUER);
    client = new issuer.Client({
      client_id: OIDC_CLIENT_ID,
      client_secret: OIDC_CLIENT_SECRET,
      redirect_uris: [REDIRECT_URI],
      response_types: ['code'],
    });
    console.log('OIDC Client initialized');
  } catch (err) {
    console.error('OIDC Initialization failed:', err);
  }
}

initOidc();

// Helper to sanitize folder names
const sanitizeFolderName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const hashAlbumPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyHashedPassword = (password: string, storedHash: string) => {
  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;

  const storedBuffer = Buffer.from(hashHex, 'hex');
  const suppliedBuffer = crypto.scryptSync(password, salt, storedBuffer.length);
  return crypto.timingSafeEqual(storedBuffer, suppliedBuffer);
};

function hasMasterPasswords() {
  const result = db.prepare('SELECT COUNT(*) as count FROM master_passwords').get() as { count: number };
  return result.count > 0;
}

function hasPublicAccess(req: express.Request) {
  const sessionData = req.session as any;
  if (!sessionData) return false;
  const user = sessionData.user;
  if (user) return true;
  return Boolean(sessionData.publicAccessGranted);
}

function requirePublicAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!hasMasterPasswords()) return next();
  if (hasPublicAccess(req)) return next();
  return res.status(401).json({ error: 'Master password required', requiresMasterPassword: true });
}

// Auth Middleware
const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req.session as any).user;
  if (user && user.role === 'admin') {
    next();
  } else if (user) {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const mutationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests' }
});

const albumAccessRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests' }
});

// --- Auth Routes ---
app.get('/api/auth/login', (req, res) => {
  if (!client) return res.status(500).send('OIDC not initialized');
  const url = client.authorizationUrl({
    scope: 'openid email profile',
  });
  res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
  if (!client) return res.status(500).send('OIDC not initialized');
  const params = client.callbackParams(req);
  try {
    const tokenSet = await client.callback(REDIRECT_URI, params);
    const userinfo = await client.userinfo(tokenSet);

    // Persist user in DB
    const email = userinfo.email;
    const name = (userinfo as any).name || (userinfo as any).preferred_username || email;

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const role = userCount.count === 0 ? 'admin' : 'guest';

    db.prepare(`
      INSERT INTO users (email, name, role, last_login) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET 
        name = excluded.name,
        last_login = CURRENT_TIMESTAMP
    `).run(email, name, role);

    const dbUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    (req.session as any).user = {
      ...userinfo,
      role: dbUser.role
    };
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/admin`);
  } catch (err) {
    console.error('Auth callback failed:', err);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json((req.session as any).user || null);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/users', isAuthenticated, (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, last_login FROM users ORDER BY last_login DESC').all();
  res.json(users);
});

app.get('/api/public-access/status', (req, res) => {
  const requiresMasterPassword = hasMasterPasswords();
  const user = (req.session as any).user;
  const hasAccess = !requiresMasterPassword || Boolean(user) || Boolean((req.session as any).publicAccessGranted);
  res.json({ requiresMasterPassword, hasAccess });
});

app.post('/api/public-access/verify', albumAccessRateLimit, (req, res) => {
  const { password } = req.body as { password?: string };
  if (typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const rows = db.prepare('SELECT password_hash FROM master_passwords').all() as { password_hash: string }[];
  if (rows.length === 0) {
    return res.json({ success: true, requiresMasterPassword: false });
  }

  const isValid = rows.some((row) => verifyHashedPassword(password, row.password_hash));
  if (!isValid) {
    return res.status(403).json({ error: 'Invalid master password', requiresMasterPassword: true });
  }

  (req.session as any).publicAccessGranted = true;
  res.json({ success: true });
});

app.get('/api/master-passwords', isAuthenticated, albumAccessRateLimit, (req, res) => {
  const passwords = db
    .prepare('SELECT id, name, created_at FROM master_passwords ORDER BY created_at DESC')
    .all();
  res.json(passwords);
});

app.post('/api/master-passwords', isAuthenticated, mutationRateLimit, (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string };
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const info = db
    .prepare('INSERT INTO master_passwords (name, password_hash) VALUES (?, ?)')
    .run(name.trim(), hashAlbumPassword(password));
  res.json({ id: info.lastInsertRowid, name: name.trim() });
});

app.delete('/api/master-passwords/:id', isAuthenticated, mutationRateLimit, (req, res) => {
  db.prepare('DELETE FROM master_passwords WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.patch('/api/users/:id/role', isAuthenticated, mutationRateLimit, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'guest'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Prevent self-demotion if desired, or just allow it
  const currentUser = (req.session as any).user;
  const targetUser = db.prepare('SELECT email FROM users WHERE id = ?').get(req.params.id) as any;

  if (targetUser && targetUser.email === currentUser.email && role !== 'admin') {
     // Optional: check if there are other admins before allowing self-demotion
     const otherAdmins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND id != ?").get(req.params.id) as { count: number };
     if (otherAdmins.count === 0) {
       return res.status(400).json({ error: 'Cannot demote the last admin' });
     }
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ success: true });
});

// --- Gallery Routes ---
app.get('/api/albums', (req, res) => {
  if (!hasPublicAccess(req) && hasMasterPasswords()) {
    return res.status(401).json({ error: 'Master password required', requiresMasterPassword: true });
  }

  const albums = db.prepare(`
    SELECT a.id, a.name, a.date,
      CASE WHEN a.password_hash IS NULL OR a.password_hash = '' THEN 0 ELSE 1 END as has_password,
      (SELECT filename FROM photos WHERE album_id = a.id LIMIT 1) as cover_photo,
      (SELECT COUNT(*) FROM photos WHERE album_id = a.id) as photo_count
    FROM albums a 
    ORDER BY date DESC
  `).all();
  res.json(albums);
});

app.get('/api/albums/:id', albumAccessRateLimit, (req, res) => {
  if (!hasPublicAccess(req) && hasMasterPasswords()) {
    return res.status(401).json({ error: 'Master password required', requiresMasterPassword: true });
  }

  const album = db.prepare(`
    SELECT *,
      CASE WHEN password_hash IS NULL OR password_hash = '' THEN 0 ELSE 1 END as has_password
    FROM albums
    WHERE id = ?
  `).get(req.params.id) as any;
  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }

  const user = (req.session as any).user;
  const requiresPassword = Boolean(album.password_hash);
  if (requiresPassword && !user) {
    const pass = typeof req.query.pass === 'string' ? req.query.pass : '';
    if (!pass || !verifyHashedPassword(pass, album.password_hash)) {
      return res.status(403).json({ error: 'Album is password protected', requiresPassword: true });
    }
  }

  const photos = db.prepare('SELECT * FROM photos WHERE album_id = ?').all(req.params.id);
  res.json({
    album: {
      id: album.id,
      name: album.name,
      date: album.date,
      has_password: album.has_password
    },
    photos
  });
});

// --- Protected Routes ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const albumId = req.params.id;
    const album = db.prepare('SELECT name FROM albums WHERE id = ?').get(albumId) as any;
    if (!album) return cb(new Error('Album not found'), '');

    const folderName = sanitizeFolderName(album.name);
    const albumDir = path.join(uploadsDir, folderName);

    if (!fs.existsSync(albumDir)) {
      fs.mkdirSync(albumDir, { recursive: true });
    }
    cb(null, albumDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/api/albums', isAuthenticated, mutationRateLimit, (req, res) => {
  const { name, password } = req.body;
  const passwordHash = typeof password === 'string' && password.trim() ? hashAlbumPassword(password) : null;
  const info = db.prepare('INSERT INTO albums (name, password_hash) VALUES (?, ?)').run(name, passwordHash);
  res.json({ id: info.lastInsertRowid, name });
});

app.patch('/api/albums/:id', isAuthenticated, mutationRateLimit, (req, res) => {
  const { date, name, password } = req.body;
  const updates: string[] = ['date = ?', 'name = ?'];
  const values: any[] = [date, name];

  if (typeof password === 'string') {
    if (password.trim()) {
      updates.push('password_hash = ?');
      values.push(hashAlbumPassword(password));
    } else {
      updates.push('password_hash = NULL');
    }
  }

  values.push(req.params.id);
  db.prepare(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ success: true });
});

app.delete('/api/albums/:id', isAuthenticated, mutationRateLimit, (req, res) => {
  const albumId = req.params.id;
  const album = db.prepare('SELECT id FROM albums WHERE id = ?').get(albumId) as { id: number } | undefined;

  if (!album) {
    return res.status(404).json({ error: 'Album not found' });
  }

  const photoCount = db.prepare('SELECT COUNT(*) as count FROM photos WHERE album_id = ?').get(albumId) as { count: number };
  if (photoCount.count > 0) {
    return res.status(400).json({ error: 'Album is not empty' });
  }

  db.prepare('DELETE FROM albums WHERE id = ?').run(albumId);
  res.json({ success: true });
});

app.delete('/api/photos/:id', isAuthenticated, mutationRateLimit, (req, res) => {
  const photo = db.prepare('SELECT filename FROM photos WHERE id = ?').get(req.params.id) as any;
  if (photo) {
    const filePath = path.join(uploadsDir, photo.filename);
    const { thumbnailPath, compressedPath } = getVariantPaths(filePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    if (fs.existsSync(compressedPath)) {
      fs.unlinkSync(compressedPath);
    }

    db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

app.post('/api/albums/:id/upload', isAuthenticated, mutationRateLimit, upload.array('photos'), async (req, res) => {
  const albumId = req.params.id;
  const files = req.files as Express.Multer.File[];

  const album = db.prepare('SELECT name FROM albums WHERE id = ?').get(albumId) as any;
  const folderName = sanitizeFolderName(album.name);

  try {
    const photosWithMetadata = await Promise.all(files.map(async (file) => {
      let metadata = null;
      try {
        const [sharpMeta, exifrMeta] = await Promise.all([
          sharp(file.path).metadata(),
          exifr.parse(file.path, { pick: ['Make', 'Model', 'DateTimeOriginal', 'ExposureTime', 'FNumber', 'ISO', 'FocalLength'] }).catch(() => null)
        ]);

        const refinedMeta = {
          width: sharpMeta.width,
          height: sharpMeta.height,
          format: sharpMeta.format,
          space: sharpMeta.space,
          density: sharpMeta.density,
          camera: exifrMeta ? {
            make: exifrMeta.Make,
            model: exifrMeta.Model,
          } : null,
          exposure: exifrMeta ? {
            time: exifrMeta.ExposureTime,
            fNumber: exifrMeta.FNumber,
            iso: exifrMeta.ISO,
            focalLength: exifrMeta.FocalLength
          } : null,
          date: exifrMeta?.DateTimeOriginal
        };
        metadata = JSON.stringify(refinedMeta);
      } catch (e) {
        console.error('Failed to extract metadata for', file.filename, e);
      }
      return { filename: file.filename, metadata };
    }));

    const insert = db.prepare('INSERT INTO photos (album_id, filename, metadata) VALUES (?, ?, ?)');
    const transaction = db.transaction((photos: any[]) => {
      for (const photo of photos) {
        // Store relative path (folder/filename) in DB
        insert.run(albumId, `${folderName}/${photo.filename}`, photo.metadata);
      }
    });

    transaction(photosWithMetadata);
    processPhotosInBackground(files.map((photo) => `${folderName}/${photo.filename}`));
    res.json({ success: true, count: files.length });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Failed to process upload' });
  }
});

processAllPhotosInBackground();
setInterval(processAllPhotosInBackground, 60 * 60 * 1000);

app.listen(parseInt(port), '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
