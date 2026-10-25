import 'dotenv/config';

import express from 'express';
import Database from 'better-sqlite3-multiple-ciphers';
import { randomUUID, scryptSync } from 'node:crypto';
import cors from 'cors';

// CONFIG FROM .ENV
const DB_KEY = process.env.DB_KEY;
if (!DB_KEY) throw new Error('DB_KEY env var is required');
let msgdb = process.env.MSG_DB;
if (!msgdb) { msgdb = './msg.db' };
let usersdb = process.env.USERS_DB;
if (!usersdb) { usersdb = './users.db' };

const app = express();
const PORT = 3000;
const SCRYPT_KEYLEN = 64;

// DATABASES
const logindb = new Database(usersdb);
logindb.pragma(`key='${DB_KEY}'`);
logindb.pragma('journal_mode = WAL');

const db = new Database(msgdb);
db.pragma(`key='${DB_KEY}'`);
db.pragma('journal_mode = WAL');


// EXPRESS CONFIG
app.use(cors());
app.use(express.json());

// INIT DB
logindb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    user          TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user TEXT NOT NULL,
    msg TEXT NOT NULL
  );
`);

function storeMsg(db, data) {
    try {
      const { id, user, msg } = data
      
      db.prepare('INSERT INTO messages (id, user, msg) VALUES (?, ?, ?)').run(id, user, msg);

      return true;
    
    } catch (error) {
      return false;
    }
};

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHashHex) {
  const computed = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

app.get('/', (req, res) => {
    res.send('THIS IS WIRED-BACKEND API.');
});

app.get('/receive', async (req, res) => {
     const data = db.prepare('SELECT * FROM messages').all();
    if (data) {
        res.status(200).json({
            success: true,
            data: data
        });
    } else {
        res.status(500).json({
            success: false
        })
    };
});

app.post('/send', async (req, res) => {
    const data = {
        id: randomUUID(),
        user: req.body.user,
        msg: req.body.msg
    };
    
    try {
        await storeMsg(db, data);

        res.status(200).json({
            success: true
        });
    } catch (error) {
        res.status(500).json({
            success: false
        });
    }
    
});


app.delete('/messages/:id', async (req, res) => {
    try {
        
        const id = req.params.id;

        if (!db.prepare('SELECT id FROM messages WHERE id = ?').get(id)) {
            return res.status(404).json({
                error: 'Message not found'
            });
        }

        db.prepare('DELETE FROM messages WHERE id = ?').run(id);

        return res.json({
            success: true
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
