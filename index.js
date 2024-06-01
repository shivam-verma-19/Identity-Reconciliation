const express = require('express');
const bodyParser = require('body-parser');
const db = require('./setupDatabase');

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post('/identify', (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
        return res.status(400).json({ error: 'Either email or phoneNumber must be provided' });
    }

    // Find existing contacts
    db.all(
        `
    SELECT * FROM contacts WHERE email = ? OR phoneNumber = ?
    `,
        [email, phoneNumber],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (rows.length === 0) {
                // No existing contact, create a new primary contact
                db.run(
                    `
          INSERT INTO contacts (email, phoneNumber, linkPrecedence)
          VALUES (?, ?, 'primary')
          `,
                    [email, phoneNumber],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: 'Internal server error' });
                        }

                        const newContactId = this.lastID;
                        const response = {
                            contact: {
                                primaryContatctId: newContactId,
                                emails: [email],
                                phoneNumbers: [phoneNumber],
                                secondaryContactIds: []
                            }
                        };

                        res.status(200).json(response);
                    }
                );
            } else {
                let primaryContact = null;
                const secondaryContacts = [];

                for (const row of rows) {
                    if (row.linkPrecedence === 'primary') {
                        primaryContact = row;
                    } else {
                        secondaryContacts.push(row);
                    }
                }

                if (!primaryContact) {
                    // No primary contact found, make the oldest contact primary
                    primaryContact = rows[0];
                    db.run(
                        `
            UPDATE contacts SET linkPrecedence = 'primary' WHERE id = ?
            `,
                        [primaryContact.id],
                        (err) => {
                            if (err) {
                                return res.status(500).json({ error: 'Internal server error' });
                            }
                        }
                    );
                }

                // Create a new secondary contact if necessary
                if (!rows.find(r => r.email === email && r.phoneNumber === phoneNumber)) {
                    db.run(
                        `
            INSERT INTO contacts (email, phoneNumber, linkedId, linkPrecedence)
            VALUES (?, ?, ?, 'secondary')
            `,
                        [email, phoneNumber, primaryContact.id],
                        function (err) {
                            if (err) {
                                return res.status(500).json({ error: 'Internal server error' });
                            }

                            secondaryContacts.push({
                                id: this.lastID,
                                email: email,
                                phoneNumber: phoneNumber
                            });

                            sendResponse(primaryContact, secondaryContacts, res);
                        }
                    );
                } else {
                    sendResponse(primaryContact, secondaryContacts, res);
                }
            }
        }
    );
});

function sendResponse(primaryContact, secondaryContacts, res) {
    const emails = [primaryContact.email, ...secondaryContacts.map(c => c.email)].filter(Boolean);
    const phoneNumbers = [primaryContact.phoneNumber, ...secondaryContacts.map(c => c.phoneNumber)].filter(Boolean);
    const secondaryContactIds = secondaryContacts.map(c => c.id);

    const response = {
        contact: {
            primaryContatctId: primaryContact.id,
            emails: emails,
            phoneNumbers: phoneNumbers,
            secondaryContactIds: secondaryContactIds
        }
    };

    res.status(200).json(response);
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
