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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`)
})