# PHP + MySQL backend

This project uses a PHP/MySQL backend that exposes the same JSON API routes expected by the React frontend.

## Run locally

1. Create a MySQL database, for example `uvira_db`.
2. Copy `.env.example` to `.env` and update the database credentials.
3. Import the schema:
   ```bash
   mysql -u root -p uvira_db < schema.sql
   ```
4. Start the PHP built-in server:
   ```bash
   php -S 0.0.0.0:8000 -t public
   ```
5. Point the frontend to the backend URL, for example:
   ```bash
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```

## Notes

- The API is mounted under `/api`.
- Default services and a super-admin account are seeded automatically on first run.
- The default admin login is `+10000000000` with password `Admin@Elegante2026` unless you override it in `.env`.
