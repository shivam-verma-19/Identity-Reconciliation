const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Database setup
let db = new sqlite3.Database(':memory:'); // Use an in-memory database for simplicity

db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS Contact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phoneNumber TEXT,
      email TEXT,
      linkedId INTEGER,
      linkPrecedence TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      deletedAt DATETIME
    )
  `);
});

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the Contact Service API');
});

// Identify endpoint
app.post('/identify', (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
        return res.status(400).json({ error: 'Email or phone number is required' });
    }

    let query = 'SELECT * FROM Contact WHERE email = ? OR phoneNumber = ?';
    db.all(query, [email, phoneNumber], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        let primaryContact = rows.find(row => row.linkPrecedence === 'primary') || rows[0];

        if (!primaryContact) {
            db.run('INSERT INTO Contact (email, phoneNumber, linkPrecedence) VALUES (?, ?, ?)',
                [email, phoneNumber, 'primary'], function (err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    primaryContact = { id: this.lastID, email, phoneNumber, linkedId: null, linkPrecedence: 'primary' };
                    res.json({
                        contact: {
                            primaryContactId: primaryContact.id,
                            emails: [primaryContact.email],
                            phoneNumbers: [primaryContact.phoneNumber],
                            secondaryContactIds: []
                        }
                    });
                }
            );
        } else {
            res.json({
                contact: {
                    primaryContactId: primaryContact.id,
                    emails: rows.map(row => row.email),
                    phoneNumbers: rows.map(row => row.phoneNumber),
                    secondaryContactIds: rows.filter(row => row.linkPrecedence === 'secondary').map(row => row.id)
                }
            });
        }
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
