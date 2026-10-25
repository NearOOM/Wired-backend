import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import cors from 'cors';

const app = express();
const PORT = 3000;
const msgdb = './msg.db';
const db = new DatabaseSync(msgdb);

app.use(cors());
app.use(express.json());

// INIT DB
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
