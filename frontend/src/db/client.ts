import { Pool } from 'pg'

// Create a new PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Optional SSL configuration for production environments (like Heroku)
  // ...(process.env.NODE_ENV === 'production' && {
  //   ssl: {
  //     rejectUnauthorized: false
  //   }
  // })
})

// Test the connection
async function connectDb() {
  try {
    const client = await pool.connect()
    console.log('✅ Successfully connected to PostgreSQL database')
    client.release()
  } catch (error) {
    console.error('❌ could not to connect to database:', error)
  }
}

// Call the function to test connection
// connectDb()

// Export both the pool and a query helper function
export default {
  query: (text: string, params?: any[]) => pool.query(text, params),
  pool
}
