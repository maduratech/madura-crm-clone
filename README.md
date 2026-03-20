Designed & Developed By <a href="www.builtbybrevia.com">BuiltByBrevia</a>

## CRM Setup (from `git clone`)

This project is the CRM frontend (Vite/React). It expects environment variables to be present in a local `.env`.

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd madura-crm-clone
```

### 2. Create your environment file

1. Copy the template:

#### PowerShell (Windows)
```powershell
Copy-Item .\example.env .\.env
```

#### CMD (Windows)
```bat
copy example.env .env
```

2. If needed, update `.env` values (for example, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`).

### 3. Install dependencies

```bash
npm install
```

### 4. Run the CRM

```bash
npm run dev
```

Then open the URL shown in the terminal (Vite typically uses `http://localhost:5173`).

### Notes

- The dev server proxies `/api` requests to the remote API configured in the project (see `vite.config.ts`).
- Keep your local `.env` out of git; edit/copy from `example.env` for local development.
