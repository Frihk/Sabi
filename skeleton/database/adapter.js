const db = require('./db')
const sqliteAdapter = require('./sqlite_adapter')

/**
 * The main adapter entry point.
 * This file serves as a facade to the specific database implementation (SQLite in this case).
 * It allows the rest of the application to interact with the database using a consistent interface.
 */

module.exports = {
  /**
   * Initializes the database connection and schema.
   * This is called by the server on startup.
   */
  init: () => db.init(),

  /**
   * Returns the underlying database instance if raw access is needed.
   */
  getDb: () => db.getDb(),

  /**
   * Spread all methods from the sqlite_adapter to expose them.
   * If we wanted to support multiple adapters, we could add logic here 
   * to choose between them based on environment variables.
   */
  ...sqliteAdapter
}
