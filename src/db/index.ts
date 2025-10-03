import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Create the connection with better error handling and pooling
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Timeout for new connections
  prepare: false, // Disable prepared statements for better compatibility
});
export const db = drizzle(client);

// Export the schema for use in other files
export { profilesTable } from "./schema";
