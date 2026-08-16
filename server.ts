import express from "express";
import { Pool } from 'pg';
import dotenv from 'dotenv';

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

app.post('/movies', async (req, res) => {
    const { title, description, release_date, end_date } = req.body;

    if(!title || !description || !release_date || !end_date) {
        return res.status(400).json({ status: 'error', message: 'title and description '})
    }

    try {
        const result = await pool.query(
            'INSERT INTO movies (title, description, release_date, end_date) VALUES ($1, $2, $3) RETURNING *',
            [title, description, release_date, end_date]
        );
        res.status(201).json(result.rows[0])
        } catch (error) {
            console.error(error);
            res.status(500).json({ status: 'error', message: 'Failed to create movie'})
        }
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`)
})