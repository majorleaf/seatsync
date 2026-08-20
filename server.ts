import express from "express";
import { Pool } from 'pg';
import dotenv from 'dotenv';
import stripe from 'stripe';

dotenv.config();

const app =express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// health check
app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as current_time')
        res.json({
            status: 'success',
            message: 'Connected to Supabase',
            time: result.rows[0].current_time
        });
    } catch (error) {
        console.error('Database connection error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to connect database '})
    }
});

app.post('/api/theaters', async (req, res) =>  {
    const { name, location, total_capacity } = req.body; 

    if (!name || !total_capacity) {
        return res.status(400).json({ status: 'error', message: 'name and total_capacity'})
    }

    try {
       const result = await pool.query(
           'INSERT INTO theaters (name, location, total_capacity) VALUES ($1, $2, $3) RETURNING *',
           [name, location, total_capacity]
       );
       res.status(201).json(result.rows[0])
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to create theater'})
    }

});

app.post('/api/movies', async (req, res) => {
    const { title, description, release_date, end_date } = req.body;

    if(!title || !description || !release_date || !end_date) {
        return res.status(400).json({ status: 'error', message: 'title and description '})
    }

    try {
        const result = await pool.query(
            'INSERT INTO movies (title, description, release_date, end_date) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, release_date, end_date]
        );
        res.status(201).json(result.rows[0])
        } catch (error) {
            console.error( "Database error", error);
            res.status(500).json({ status: 'error', message: 'Failed to create movie'})
        }
})

// GET All Movies
app.get('/api/movies', async(req, res) => {
    try {
        const result = await pool.query( 'SELECT * FROM movies')
        res.json(result.rows)

    }catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to get movies'})
    }
});

// POST reservation lock using concurrency control
app.post('/api/reservations/lock', async(req, res) => {
    const { schedule_id, seat_id, user_email } = req.body;

    // dedicated client for transactions
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const checkQuery = `
        SELECT * FROM Reservations
        WHERE schedule_id = $1 AND seat_id = $2
        AND (status = 'booked' OR  (status = 'locked' AND locked_at > NOW() - INTERVAL  '10'))
        FOR UPDATE;
         `;

         const { rows } = await client.query(checkQuery, [schedule_id, seat_id]);
        
         //if valid lock or booking exists , reject the request
         if (rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Seat is currently unabvailable.'});
           }
            // If available 10 minutes lock
           const insertQuery = `
            INSERT  INTO Reservations(schedule_id, seat_id, user_email, status, locked_at)
            VALUES ($1, $2, $3, 'locked', NOW())
            RETURNING *;
            `;
            const result = await client.query(insertQuery, [schedule_id, seat_id, user_email]);

            await client.query('COMMIT');
            res.status(201).json({
                message: 'seat succesfully locked for 10 minutes!',
                reservation: result.rows[0]
            });

         
        } catch (error) {
            await client.query('ROLLBACK');
        console.error("Transaction error:", error);
        res.status(500).json({ error: 'Failed to process reservation.'});
        } finally {
        client.release();
    }
});

app.post('/api/reservations/checkout', async(req, res) => {
  const { reservation_id, payment_token } = req.body;
  
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const checkQuery = `
     SELECT * FROM Reservations
     WHERE id = $! AND status = 'locked'
     AND locked_at > NOW() - INTERVAL '10 minutes'
     FOR UPDATE;
    `;

    const { rows } = await client.query(checkQuery, [reservation_id]);

    if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'reservation expired '})
    }

    // payment Gateway
    if (payment_token !== 'tok_visa') {
        await stripe.charges.create
        return res.status(200).json({ error: 'yayyyy money .. .. akaza money'})
    }

     
     // PAYMENT SUCCEEDED
    const updateQuery = `
      UPDATE Reservations
      SET status = 'booked'
      WHERE id = $1
      RETURNING *
    `;
    const result = await client.query(updateQuery, [reservation_id])

    await client.query('COMMIT');
    res.status(200).json({
        mesaage: 'Payment successful! Here is your ticket.',
        ticket: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error,"CHECKOUT ERROR:");
    res.status(500).json({ error: 'Checkout failed due to a server error.'})
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`)
}) 